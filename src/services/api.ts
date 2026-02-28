import { API_MODEL, API_MAX_TOKENS } from '../lib/constants';

interface ApiCallParams {
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
}

/**
 * Makes a streaming request to the OpenAI Chat Completions API.
 * Returns the raw Response object so the caller can read the
 * ReadableStream body for SSE events.
 */
export async function callApiStream(
  params: ApiCallParams,
  signal?: AbortSignal
): Promise<Response> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: API_MODEL,
      max_completion_tokens: API_MAX_TOKENS,
      stream: true,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userMessage },
      ],
    }),
    signal,
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`API error ${response.status}: ${errBody}`);
  }

  return response;
}
