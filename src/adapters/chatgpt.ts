import { SiteAdapter } from './types';
import { ConversationMessage } from '../types/messages';
import { MAX_CONTEXT_MESSAGES, MAX_CONTEXT_CHARS_PER_MESSAGE } from '../lib/constants';

export const chatgptAdapter: SiteAdapter = {
  id: 'chatgpt',
  name: 'ChatGPT',
  targetModel: 'chatgpt',

  findInput() {
    return document.querySelector<HTMLElement>('#prompt-textarea')
      ?? document.querySelector<HTMLElement>('div[contenteditable="true"][id="prompt-textarea"]')
      ?? document.querySelector<HTMLElement>('form textarea')
      ?? null;
  },

  findButtonAnchor() {
    return document.querySelector<HTMLElement>('button[data-testid="send-button"]')
      ?? document.querySelector<HTMLElement>('button[aria-label="Send prompt"]')
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
    const els = document.querySelectorAll('[data-message-author-role]');
    els.forEach((el) => {
      const role = el.getAttribute('data-message-author-role');
      if (role === 'user' || role === 'assistant') {
        const content = (el.textContent || '').trim().slice(0, MAX_CONTEXT_CHARS_PER_MESSAGE);
        if (content) messages.push({ role, content });
      }
    });
    return messages.slice(-MAX_CONTEXT_MESSAGES);
  },

  hasContent() {
    return this.getPromptText().trim().length > 3;
  },
};
