export interface SSEEvent {
  event: string;
  data: string;
}

/**
 * Parse SSE text buffer into events. Returns { events, remaining } where
 * remaining is the incomplete buffer to carry forward.
 *
 * OpenAI returns `data:` lines separated by blank lines. No `event:` lines.
 */
export function parseSSE(buffer: string): {
  events: SSEEvent[];
  remaining: string;
} {
  const events: SSEEvent[] = [];
  const lines = buffer.split('\n');
  let remaining = '';
  let currentEvent = '';
  let currentData = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // If this is the last line and doesn't end with newline, it's incomplete
    if (i === lines.length - 1 && !buffer.endsWith('\n')) {
      remaining = line;
      if (currentEvent || currentData) {
        remaining =
          (currentEvent ? `event: ${currentEvent}\n` : '') +
          (currentData ? `data: ${currentData}\n` : '') +
          remaining;
      }
      break;
    }

    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      currentData = line.slice(6);
    } else if (line === '') {
      // Empty line = end of event
      if (currentEvent || currentData) {
        events.push({ event: currentEvent, data: currentData });
        currentEvent = '';
        currentData = '';
      }
    }
  }

  return { events, remaining };
}

/**
 * Extract text delta from an OpenAI SSE event.
 * OpenAI sends `choices[0].delta.content` for text chunks.
 */
export function extractTextDelta(event: SSEEvent): string | null {
  if (event.data === '[DONE]') return null;
  try {
    const parsed = JSON.parse(event.data);
    const content = parsed.choices?.[0]?.delta?.content;
    if (typeof content === 'string') {
      return content;
    }
  } catch {
    // Skip unparseable events
  }
  return null;
}

/**
 * Check if the event signals the end of the stream.
 * OpenAI signals completion with `data: [DONE]`.
 */
export function isStreamEnd(event: SSEEvent): boolean {
  return event.data === '[DONE]';
}
