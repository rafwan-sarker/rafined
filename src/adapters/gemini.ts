import { SiteAdapter } from './types';
import { ConversationMessage } from '../types/messages';
import { MAX_CONTEXT_MESSAGES, MAX_CONTEXT_CHARS_PER_MESSAGE } from '../lib/constants';

export const geminiAdapter: SiteAdapter = {
  id: 'gemini',
  name: 'Gemini',
  targetModel: 'gemini',

  findInput() {
    return document.querySelector<HTMLElement>('.ql-editor[contenteditable="true"]')
      ?? document.querySelector<HTMLElement>('rich-textarea div[contenteditable="true"]')
      ?? document.querySelector<HTMLElement>('div[contenteditable="true"][aria-label*="prompt"]')
      ?? document.querySelector<HTMLElement>('.text-input-field textarea')
      ?? null;
  },

  findButtonAnchor() {
    return document.querySelector<HTMLElement>('button[aria-label="Send message"]')
      ?? document.querySelector<HTMLElement>('button.send-button')
      ?? document.querySelector<HTMLElement>('button[aria-label*="Send"]')
      ?? null;
  },

  getPromptText() {
    const input = this.findInput();
    if (!input) return '';
    if (input instanceof HTMLTextAreaElement) return input.value;
    return input.innerText || '';
  },

  setPromptText(text: string) {
    const input = this.findInput();
    if (!input) return;
    if (input instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      input.focus();
      document.execCommand('selectAll', false);
      document.execCommand('insertText', false, text);
    }
  },

  getConversationContext() {
    const messages: ConversationMessage[] = [];
    // Gemini uses model-response-text and user-query containers
    const turns = document.querySelectorAll('message-content, .conversation-turn');
    turns.forEach((el) => {
      const isUser = el.closest('.user-query') !== null ||
                     el.closest('[data-turn-role="user"]') !== null;
      const isAssistant = el.closest('.model-response') !== null ||
                          el.closest('[data-turn-role="model"]') !== null;
      if (isUser || isAssistant) {
        const content = (el.textContent || '').trim().slice(0, MAX_CONTEXT_CHARS_PER_MESSAGE);
        if (content) {
          messages.push({ role: isUser ? 'user' : 'assistant', content });
        }
      }
    });
    return messages.slice(-MAX_CONTEXT_MESSAGES);
  },

  hasContent() {
    return this.getPromptText().trim().length > 3;
  },
};
