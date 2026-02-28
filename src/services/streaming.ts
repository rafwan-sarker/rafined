export interface SSEEvent {
  event: string;
  data: string;
}

/**
 * Parse SSE text buffer into events. Returns { events, remaining } where
 * remaining is the incomplete buffer to carry forward.
 *
 * The Anthropic API returns Server-Sent Events when `stream: true` is set.
 * Each event block has an `event:` line, a `data:` line, and is terminated
 * by a blank line.
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
      // Reconstruct remaining from current state
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
 * Extract text delta from an Anthropic SSE event.
 * Only `content_block_delta` events with a `text_delta` type carry text.
 */
export function extractTextDelta(event: SSEEvent): string | null {
  if (event.event !== 'content_block_delta') return null;
  try {
    const parsed = JSON.parse(event.data);
    if (parsed.delta?.type === 'text_delta') {
      return parsed.delta.text;
    }
  } catch {
    // Skip unparseable events
  }
  return null;
}

/**
 * Check if the event signals the end of the stream.
 */
export function isStreamEnd(event: SSEEvent): boolean {
  return event.event === 'message_stop';
}
