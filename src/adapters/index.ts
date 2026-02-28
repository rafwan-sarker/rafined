import { SiteAdapter } from './types';
import { chatgptAdapter } from './chatgpt';
import { claudeAdapter } from './claude';
import { geminiAdapter } from './gemini';

const adapters: Record<string, SiteAdapter> = {
  chatgpt: chatgptAdapter,
  claude: claudeAdapter,
  gemini: geminiAdapter,
};

export function detectSite(): SiteAdapter | null {
  const hostname = window.location.hostname;
  if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
    return adapters.chatgpt;
  }
  if (hostname.includes('claude.ai')) {
    return adapters.claude;
  }
  if (hostname.includes('gemini.google.com')) {
    return adapters.gemini;
  }
  return null;
}

export { chatgptAdapter, claudeAdapter, geminiAdapter };
export type { SiteAdapter };
