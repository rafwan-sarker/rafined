import { ConversationMessage } from '../types/messages';

export interface SiteAdapter {
  id: 'chatgpt' | 'claude' | 'gemini';
  name: string;
  targetModel: string;
  findInput(): HTMLElement | null;
  findButtonAnchor(): HTMLElement | null;
  getPromptText(): string;
  setPromptText(text: string): void;
  getConversationContext(): ConversationMessage[];
  hasContent(): boolean;
}
