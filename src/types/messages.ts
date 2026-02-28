export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type MessageToBackground =
  | {
      type: 'ENHANCE_REQUEST';
      prompt: string;
      context: ConversationMessage[];
      targetModel: 'chatgpt' | 'claude' | 'gemini';
    }
  | { type: 'CANCEL_STREAM' };

export type MessageToContent =
  | { type: 'STREAM_CHUNK'; text: string }
  | { type: 'STREAM_DONE'; fullText: string }
  | { type: 'STREAM_ERROR'; error: string }
  | { type: 'NO_API_KEY' };
