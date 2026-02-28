import React from 'react';
import ReactDOM from 'react-dom/client';
import { detectSite } from '../adapters/index';
import type { SiteAdapter } from '../adapters/types';
import { ENHANCE_PORT } from '../lib/messaging';
import { MIN_PROMPT_LENGTH } from '../lib/constants';
import { EnhanceButton } from '../components/EnhanceButton';
import type { MessageToBackground, MessageToContent } from '../types/messages';
import buttonCss from '../styles/button.css?inline';
import modalCss from '../styles/modal.css?inline';

export default defineContentScript({
  matches: [
    '*://chatgpt.com/*',
    '*://chat.openai.com/*',
    '*://claude.ai/*',
    '*://gemini.google.com/*',
  ],

  async main(ctx) {
    const detected = detectSite();
    if (!detected) return;
    const adapter: SiteAdapter = detected;

    let buttonUi: Awaited<ReturnType<typeof createIntegratedUi>> | null = null;
    let modalUi: { remove: () => void } | null = null;
    let isModalOpen = false;
    let isEnhancing = false;
    let isInjecting = false;

    // Inject button CSS into the page (no shadow DOM — avoids attachShadow
    // which fails on some sites like Gemini)
    injectStylesheet('rafined-button-css', buttonCss);
    injectStylesheet('rafined-modal-css', modalCss);

    // Watch for DOM changes to detect when the input and send button appear
    setupObserver(ctx, adapter);

    // Re-inject on SPA navigation
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      cleanup();
      setupObserver(ctx, adapter);
    });

    function setupObserver(
      ctx: InstanceType<typeof ContentScriptContext>,
      adapter: SiteAdapter,
    ) {
      let injected = false;

      const tryInject = () => {
        if (injected || isInjecting || ctx.isInvalid) return;
        const anchor = adapter.findButtonAnchor();
        const input = adapter.findInput();
        if (anchor && input) {
          injected = true;
          injectButton(ctx, adapter, anchor);
        }
      };

      // Try immediately
      tryInject();

      // Observe DOM for dynamic loading
      const observer = new MutationObserver(() => {
        if (ctx.isInvalid) {
          observer.disconnect();
          return;
        }

        // If button was injected but anchor disappeared (SPA nav), re-inject
        // Skip check while an injection is in progress to avoid race conditions
        if (injected && !isInjecting) {
          const anchor = adapter.findButtonAnchor();
          if (!anchor || !document.contains(buttonUi?.wrapper ?? null)) {
            injected = false;
            buttonUi?.remove();
            buttonUi = null;
          }
        }

        tryInject();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      ctx.onInvalidated(() => {
        observer.disconnect();
        cleanup();
      });
    }

    async function injectButton(
      ctx: InstanceType<typeof ContentScriptContext>,
      adapter: SiteAdapter,
      anchor: HTMLElement,
    ) {
      // Don't inject duplicate buttons
      if (buttonUi) {
        buttonUi.remove();
        buttonUi = null;
      }

      isInjecting = true;

      try {
        buttonUi = createIntegratedUi(ctx, {
          position: 'inline',
          anchor,
          append: 'before',
          onMount(wrapper) {
            const root = ReactDOM.createRoot(wrapper);
            root.render(
              React.createElement(EnhanceButton, {
                onClick: () => handleEnhanceClick(ctx, adapter),
                disabled: false,
                loading: isEnhancing,
              }),
            );
            return root;
          },
          onRemove(root) {
            root?.unmount();
          },
        });

        buttonUi.mount();
      } finally {
        isInjecting = false;
      }
    }

    async function handleEnhanceClick(
      ctx: InstanceType<typeof ContentScriptContext>,
      adapter: SiteAdapter,
    ) {
      if (isModalOpen || isEnhancing) return;

      const promptText = adapter.getPromptText().trim();
      if (promptText.length < MIN_PROMPT_LENGTH) return;

      const conversationContext = adapter.getConversationContext();
      isEnhancing = true;
      reRenderButton(adapter);

      // State for the streaming modal
      let streamedText = '';
      let streamDone = false;
      let streamError: string | null = null;
      let noApiKey = false;
      let modalRoot: ReactDOM.Root | null = null;

      const port = chrome.runtime.connect({ name: ENHANCE_PORT });

      const renderModal = () => {
        if (!modalRoot) return;
        modalRoot.render(
          React.createElement(EnhanceModal, {
            originalPrompt: promptText,
            enhancedText: streamedText,
            isStreaming: isEnhancing && !streamDone && !streamError && !noApiKey,
            isDone: streamDone,
            error: streamError,
            noApiKey,
            onUseEnhanced: (finalText: string) => {
              closeModal();
              port.disconnect();
              // Small delay to let the dialog close and release focus trap
              // before we try to focus + insert text into the chat input
              setTimeout(() => adapter.setPromptText(finalText), 50);
            },
            onKeepOriginal: () => {
              closeModal();
              port.disconnect();
            },
            onCancel: () => {
              const cancelMsg: MessageToBackground = { type: 'CANCEL_STREAM' };
              port.postMessage(cancelMsg);
              closeModal();
              port.disconnect();
            },
            onClose: () => {
              if (isEnhancing && !streamDone && !streamError) {
                const cancelMsg: MessageToBackground = { type: 'CANCEL_STREAM' };
                port.postMessage(cancelMsg);
              }
              closeModal();
              port.disconnect();
            },
          }),
        );
      };

      port.onMessage.addListener((msg: MessageToContent) => {
        switch (msg.type) {
          case 'STREAM_CHUNK':
            streamedText += msg.text;
            renderModal();
            break;

          case 'STREAM_DONE':
            streamedText = msg.fullText;
            streamDone = true;
            isEnhancing = false;
            reRenderButton(adapter);
            renderModal();
            break;

          case 'STREAM_ERROR':
            streamError = msg.error;
            isEnhancing = false;
            reRenderButton(adapter);
            renderModal();
            break;

          case 'NO_API_KEY':
            noApiKey = true;
            isEnhancing = false;
            reRenderButton(adapter);
            renderModal();
            break;
        }
      });

      port.onDisconnect.addListener(() => {
        if (isEnhancing) {
          isEnhancing = false;
          reRenderButton(adapter);
        }
      });

      // Open modal using native <dialog> for reliable top-layer rendering.
      // Avoids both z-index issues (Gemini) and attachShadow issues.
      // CSS is injected into the page head instead of shadow DOM.
      isModalOpen = true;

      const dialog = document.createElement('dialog');
      dialog.style.cssText = 'position:fixed;inset:0;border:none;padding:0;margin:0;background:transparent;max-width:none;max-height:none;width:100vw;height:100vh;overflow:visible;';

      // Hide default browser backdrop — our overlay handles the dimming
      injectStylesheet('rafined-dialog-css', 'dialog.rafined-dialog::backdrop{background:transparent}');
      dialog.className = 'rafined-dialog';

      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;inset:0;';
      dialog.appendChild(container);

      document.body.appendChild(dialog);
      dialog.showModal();

      // Handle Escape key through the dialog's cancel event
      dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        if (isEnhancing && !streamDone && !streamError) {
          const cancelMsg: MessageToBackground = { type: 'CANCEL_STREAM' };
          port.postMessage(cancelMsg);
        }
        closeModal();
        port.disconnect();
      });

      modalRoot = ReactDOM.createRoot(container);
      renderModal();

      modalUi = {
        remove: () => {
          modalRoot?.unmount();
          modalRoot = null;
          if (dialog.open) dialog.close();
          dialog.remove();
        },
      };

      // Send the enhance request
      const request: MessageToBackground = {
        type: 'ENHANCE_REQUEST',
        prompt: promptText,
        context: conversationContext,
        targetModel: adapter.id,
      };
      port.postMessage(request);
    }

    function reRenderButton(adapter: SiteAdapter) {
      if (!buttonUi?.mounted) return;
      const root = buttonUi.mounted as ReactDOM.Root;
      root.render(
        React.createElement(EnhanceButton, {
          onClick: () => handleEnhanceClick(ctx as any, adapter),
          disabled: false,
          loading: isEnhancing,
        }),
      );
    }

    function closeModal() {
      isModalOpen = false;
      isEnhancing = false;
      modalUi?.remove();
      modalUi = null;
      reRenderButton(adapter);
    }

    function cleanup() {
      buttonUi?.remove();
      buttonUi = null;
      closeModal();
    }
  },
});

/**
 * Inject a stylesheet into the page head (idempotent — skips if already present).
 * Used instead of shadow DOM to avoid attachShadow failures on some sites.
 */
function injectStylesheet(id: string, css: string) {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

// --------------------------------------------------------------------------
// EnhanceModal component -- defined inline to keep everything in one file
// and avoid an additional component file for the content script.
// --------------------------------------------------------------------------

interface EnhanceModalProps {
  originalPrompt: string;
  enhancedText: string;
  isStreaming: boolean;
  isDone: boolean;
  error: string | null;
  noApiKey: boolean;
  onUseEnhanced: (text: string) => void;
  onKeepOriginal: () => void;
  onCancel: () => void;
  onClose: () => void;
}

function EnhanceModal(props: EnhanceModalProps) {
  const {
    originalPrompt,
    enhancedText,
    isStreaming,
    isDone,
    error,
    noApiKey,
    onUseEnhanced,
    onKeepOriginal,
    onCancel,
    onClose,
  } = props;

  const [editedText, setEditedText] = React.useState('');
  const [isEditing, setIsEditing] = React.useState(false);
  const enhancedRef = React.useRef<HTMLDivElement>(null);

  // Keep editedText in sync with streamed text until user starts editing
  React.useEffect(() => {
    if (!isEditing) {
      setEditedText(enhancedText);
    }
  }, [enhancedText, isEditing]);

  // Auto-scroll enhanced text area during streaming
  React.useEffect(() => {
    if (isStreaming && enhancedRef.current) {
      enhancedRef.current.scrollTop = enhancedRef.current.scrollHeight;
    }
  }, [enhancedText, isStreaming]);

  const handleUse = () => {
    onUseEnhanced(isEditing ? editedText : enhancedText);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (noApiKey) {
    return React.createElement(
      'div',
      { className: 'rafined-overlay', onClick: handleOverlayClick },
      React.createElement(
        'div',
        { className: 'rafined-modal' },
        React.createElement(
          'div',
          { className: 'rafined-modal-header' },
          React.createElement(
            'div',
            { className: 'rafined-modal-title' },
            React.createElement('span', { className: 'brand' }, 'RAFined'),
          ),
          React.createElement(
            'button',
            { className: 'rafined-close-btn', onClick: onClose },
            '\u00D7',
          ),
        ),
        React.createElement(
          'div',
          { className: 'rafined-modal-body' },
          React.createElement(
            'div',
            { className: 'rafined-error' },
            'No API key configured. Open the RAFined extension popup to set your Anthropic API key.',
          ),
        ),
        React.createElement(
          'div',
          { className: 'rafined-modal-footer' },
          React.createElement(
            'button',
            { className: 'rafined-btn rafined-btn-secondary', onClick: onClose },
            'Close',
          ),
        ),
      ),
    );
  }

  return React.createElement(
    'div',
    { className: 'rafined-overlay', onClick: handleOverlayClick },
    React.createElement(
      'div',
      { className: 'rafined-modal' },
      // Header
      React.createElement(
        'div',
        { className: 'rafined-modal-header' },
        React.createElement(
          'div',
          { className: 'rafined-modal-title' },
          React.createElement('span', { className: 'brand' }, 'RAFined'),
          isStreaming
            ? React.createElement('span', null, '- Enhancing...')
            : isDone
              ? React.createElement('span', null, '- Enhanced')
              : error
                ? React.createElement('span', null, '- Error')
                : null,
        ),
        React.createElement(
          'button',
          { className: 'rafined-close-btn', onClick: onClose },
          '\u00D7',
        ),
      ),
      // Body
      React.createElement(
        'div',
        { className: 'rafined-modal-body' },
        // Original prompt section
        React.createElement(
          'div',
          { className: 'rafined-section' },
          React.createElement(
            'div',
            { className: 'rafined-section-label' },
            'Original',
          ),
          React.createElement(
            'div',
            { className: 'rafined-original' },
            originalPrompt,
          ),
        ),
        // Enhanced section
        React.createElement(
          'div',
          { className: 'rafined-section' },
          React.createElement(
            'div',
            { className: 'rafined-section-label' },
            isDone ? 'Enhanced (click to edit)' : 'Enhanced',
          ),
          error
            ? React.createElement(
                'div',
                { className: 'rafined-error' },
                error,
              )
            : isStreaming && !enhancedText
              ? React.createElement(
                  'div',
                  { className: 'rafined-loading' },
                  React.createElement('div', { className: 'rafined-spinner' }),
                  React.createElement('span', null, 'Generating enhanced prompt...'),
                )
              : isDone && isEditing
                ? React.createElement('textarea', {
                    className: 'rafined-enhanced-textarea',
                    value: editedText,
                    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
                      setEditedText(e.target.value);
                    },
                    autoFocus: true,
                  })
                : React.createElement(
                    'div',
                    {
                      ref: enhancedRef,
                      className: `rafined-enhanced${isDone ? ' editable' : ''}`,
                      onClick: isDone ? () => setIsEditing(true) : undefined,
                    },
                    enhancedText || '',
                    isStreaming
                      ? React.createElement('span', { className: 'rafined-cursor' })
                      : null,
                  ),
        ),
      ),
      // Footer
      React.createElement(
        'div',
        { className: 'rafined-modal-footer' },
        isStreaming
          ? React.createElement(
              'button',
              { className: 'rafined-btn rafined-btn-ghost', onClick: onCancel },
              'Cancel',
            )
          : React.createElement(
              React.Fragment,
              null,
              React.createElement(
                'button',
                { className: 'rafined-btn rafined-btn-ghost', onClick: onKeepOriginal },
                'Keep Original',
              ),
              isDone
                ? React.createElement(
                    'button',
                    { className: 'rafined-btn rafined-btn-primary', onClick: handleUse },
                    'Use Enhanced',
                  )
                : error
                  ? React.createElement(
                      'button',
                      { className: 'rafined-btn rafined-btn-secondary', onClick: onClose },
                      'Close',
                    )
                  : null,
            ),
      ),
    ),
  );
}
