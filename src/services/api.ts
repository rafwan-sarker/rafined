import { API_MODEL, API_MAX_TOKENS } from '../lib/constants';

interface ApiCallParams {
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
}

/**
 * Makes a streaming request to the Anthropic Messages API.
 * Returns the raw Response object so the caller can read the
 * ReadableStream body for SSE events.
 *
 * The `anthropic-dangerous-direct-browser-access` header is required
 * for direct browser-to-API calls (as opposed to server-side proxying).
 */
export async function callAnthropicStream(
  params: ApiCallParams,
  signal?: AbortSignal
): Promise<Response> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': params.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: API_MODEL,
      max_tokens: API_MAX_TOKENS,
      stream: true,
      system: params.systemPrompt,
      messages: [{ role: 'user', content: params.userMessage }],
    }),
    signal,
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`API error ${response.status}: ${errBody}`);
  }

  return response;
}
