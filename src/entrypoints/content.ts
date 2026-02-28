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

    let buttonUi: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;
    let modalUi: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;
    let isModalOpen = false;
    let isEnhancing = false;

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
        if (injected || ctx.isInvalid) return;
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
        if (injected) {
          const anchor = adapter.findButtonAnchor();
          if (!anchor || !document.contains(buttonUi?.shadowHost ?? null)) {
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

      buttonUi = await createShadowRootUi(ctx, {
        name: 'rafined-button',
        position: 'inline',
        anchor,
        append: 'before',
        css: buttonCss,
        onMount(container) {
          const root = ReactDOM.createRoot(container);
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
              adapter.setPromptText(finalText);
              closeModal();
              port.disconnect();
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

      // Open modal
      isModalOpen = true;
      modalUi = await createShadowRootUi(ctx, {
        name: 'rafined-modal',
        position: 'modal',
        zIndex: 2147483647,
        anchor: document.body,
        append: 'last',
        css: modalCss,
        isolateEvents: true,
        onMount(container) {
          const root = ReactDOM.createRoot(container);
          modalRoot = root;
          renderModal();
          return root;
        },
        onRemove(root) {
          root?.unmount();
          modalRoot = null;
        },
      });
      modalUi.mount();

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
