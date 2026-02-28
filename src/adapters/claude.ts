import { SiteAdapter } from './types';
import { ConversationMessage } from '../types/messages';
import { MAX_CONTEXT_MESSAGES, MAX_CONTEXT_CHARS_PER_MESSAGE } from '../lib/constants';

export const claudeAdapter: SiteAdapter = {
  id: 'claude',
  name: 'Claude',
  targetModel: 'claude',

  findInput() {
    return document.querySelector<HTMLElement>('div.ProseMirror[contenteditable="true"]')
      ?? document.querySelector<HTMLElement>('[contenteditable="true"][translate="no"]')
      ?? null;
  },

  findButtonAnchor() {
    return document.querySelector<HTMLElement>('button[aria-label="Send Message"]')
      ?? document.querySelector<HTMLElement>('button[aria-label="Send message"]')
      ?? document.querySelector<HTMLElement>('fieldset button[type="button"]:last-child')
      ?? null;
  },

  getPromptText() {
    const input = this.findInput();
    if (!input) return '';
    return input.innerText || '';
  },

  setPromptText(text: string) {
    const input = this.findInput();
    if (!input) return;
    input.focus();
    document.execCommand('selectAll', false);
    document.execCommand('insertText', false, text);
  },

  getConversationContext() {
    const messages: ConversationMessage[] = [];
    // Claude.ai uses [data-is-streaming] on assistant messages and specific containers
    const humanEls = document.querySelectorAll('[data-testid="user-message"]');
    const assistantEls = document.querySelectorAll('[data-testid="assistant-message"]');

    // Fallback: look for message containers by role
    const allMessages = document.querySelectorAll('.font-user-message, .font-claude-message');

    if (humanEls.length > 0 || assistantEls.length > 0) {
      // Interleave based on DOM order
      const allEls = document.querySelectorAll('[data-testid="user-message"], [data-testid="assistant-message"]');
      allEls.forEach((el) => {
        const isUser = el.matches('[data-testid="user-message"]');
        const content = (el.textContent || '').trim().slice(0, MAX_CONTEXT_CHARS_PER_MESSAGE);
        if (content) {
          messages.push({ role: isUser ? 'user' : 'assistant', content });
        }
      });
    } else if (allMessages.length > 0) {
      allMessages.forEach((el) => {
        const isUser = el.classList.contains('font-user-message');
        const content = (el.textContent || '').trim().slice(0, MAX_CONTEXT_CHARS_PER_MESSAGE);
        if (content) {
          messages.push({ role: isUser ? 'user' : 'assistant', content });
        }
      });
    }

    return messages.slice(-MAX_CONTEXT_MESSAGES);
  },

  hasContent() {
    return this.getPromptText().trim().length > 3;
  },
};
