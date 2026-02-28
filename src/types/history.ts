export interface HistoryEntry {
  id: string;
  originalPrompt: string;
  enhancedPrompt: string;
  targetModel: 'chatgpt' | 'claude' | 'gemini';
  timestamp: number;
  used: boolean;
}
