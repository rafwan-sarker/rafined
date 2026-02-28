import { ENHANCE_PORT } from '../lib/messaging';
import { getSettings } from '../lib/storage';
import { addToHistory } from '../lib/storage';
import { buildSystemPrompt, buildUserMessage, stripPreamble } from '../services/enhance';
import { callAnthropicStream } from '../services/api';
import { parseSSE, extractTextDelta, isStreamEnd } from '../services/streaming';
import type { MessageToBackground, MessageToContent } from '../types/messages';

export default defineBackground(() => {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== ENHANCE_PORT) return;

    let abortController: AbortController | null = null;

    port.onMessage.addListener(async (msg: MessageToBackground) => {
      if (msg.type === 'CANCEL_STREAM') {
        abortController?.abort();
        abortController = null;
        return;
      }

      if (msg.type !== 'ENHANCE_REQUEST') return;

      const { prompt, context, targetModel } = msg;

      try {
        const settings = await getSettings();

        if (!settings.apiKey) {
          sendMessage(port, { type: 'NO_API_KEY' });
          return;
        }

        const systemPrompt = buildSystemPrompt(targetModel, settings);
        const userMessage = buildUserMessage(prompt, context);

        abortController = new AbortController();

        const response = await callAnthropicStream(
          {
            apiKey: settings.apiKey,
            systemPrompt,
            userMessage,
          },
          abortController.signal,
        );

        const body = response.body;
        if (!body) {
          sendMessage(port, { type: 'STREAM_ERROR', error: 'No response body received' });
          return;
        }

        const reader = body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';
        let fullText = '';

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              // Process any remaining buffer
              if (sseBuffer.trim()) {
                const { events } = parseSSE(sseBuffer + '\n');
                for (const event of events) {
                  const delta = extractTextDelta(event);
                  if (delta) {
                    fullText += delta;
                    sendMessage(port, { type: 'STREAM_CHUNK', text: delta });
                  }
                  if (isStreamEnd(event)) {
                    break;
                  }
                }
              }

              // Stream finished -- finalize
              const cleaned = stripPreamble(fullText);
              await addToHistory({
                originalPrompt: prompt,
                enhancedPrompt: cleaned,
                targetModel,
                timestamp: Date.now(),
              });
              sendMessage(port, { type: 'STREAM_DONE', fullText: cleaned });
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            sseBuffer += chunk;

            const { events, remaining } = parseSSE(sseBuffer);
            sseBuffer = remaining;

            for (const event of events) {
              if (isStreamEnd(event)) {
                const cleaned = stripPreamble(fullText);
                await addToHistory({
                  originalPrompt: prompt,
                  enhancedPrompt: cleaned,
                  targetModel,
                  timestamp: Date.now(),
                });
                sendMessage(port, { type: 'STREAM_DONE', fullText: cleaned });
                abortController = null;
                return;
              }

              const delta = extractTextDelta(event);
              if (delta) {
                fullText += delta;
                sendMessage(port, { type: 'STREAM_CHUNK', text: delta });
              }
            }
          }
        } finally {
          abortController = null;
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // User cancelled -- no error to report
          return;
        }
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
        sendMessage(port, { type: 'STREAM_ERROR', error: errorMessage });
      }
    });

    port.onDisconnect.addListener(() => {
      abortController?.abort();
      abortController = null;
    });
  });
});

/**
 * Safely post a message through the port. If the port is already
 * disconnected (e.g. the content script navigated away), catch the error.
 */
function sendMessage(port: chrome.runtime.Port, msg: MessageToContent): void {
  try {
    port.postMessage(msg);
  } catch {
    // Port disconnected -- nothing to do
  }
}
