# RAFined — AI Prompt Enhancer

A Chrome extension that enhances your AI prompts with one click. Works directly inside ChatGPT, Claude.ai, and Gemini.

## What It Does

Type a simple prompt, click **Enhance**, and RAFined rewrites it using prompt engineering best practices — optimized for the specific AI model you're talking to. The enhanced prompt streams in a modal overlay where you can:

- **Use Enhanced** — Replace your original prompt with the enhanced version
- **Edit** — Modify the enhanced prompt before using it
- **Keep Original** — Dismiss and keep your original prompt

## Features

- **Model-specific optimization** — Different prompting strategies for ChatGPT, Claude, and Gemini
- **Context awareness** — Reads conversation history to enhance follow-up prompts appropriately
- **Streaming output** — See the enhanced prompt appear word-by-word
- **Tone settings** — Professional, casual, or technical
- **Prompt history** — Browse past enhancements with before/after comparison
- **Shadow DOM isolation** — No style conflicts with host sites

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Build the extension

```bash
npm run build
```

### 3. Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `.output/chrome-mv3/` folder

### 4. Add your API key

1. Click the RAFined extension icon in Chrome toolbar
2. Enter your [Anthropic API key](https://console.anthropic.com/settings/keys)
3. Choose your preferred tone and settings

### 5. Enhance prompts

1. Go to [ChatGPT](https://chatgpt.com), [Claude.ai](https://claude.ai), or [Gemini](https://gemini.google.com)
2. Type a prompt in the input box
3. Click the **Enhance** button (appears near the send button)
4. Review the enhanced version in the modal
5. Click **Use Enhanced** to replace your prompt

## Development

```bash
# Start dev mode with hot reload
npm run dev

# Production build
npm run build

# Build + zip for distribution
npm run zip
```

## How It Works

1. **Content script** detects which AI site you're on and injects an Enhance button next to the send button (via Shadow DOM for style isolation)
2. On click, it reads your prompt text and conversation context through a site-specific adapter
3. The request is sent to the **background service worker** (required for CORS with the Anthropic API)
4. The background worker calls the **Anthropic Claude Sonnet API** with a specialized system prompt that includes model-specific optimization, your tone preference, and conversation context
5. SSE streaming chunks are relayed back to the content script via a persistent port
6. The **modal overlay** renders the streaming text with a blinking cursor, and presents action buttons when complete

## Supported Sites

| Site | Status |
|------|--------|
| ChatGPT (chatgpt.com) | Supported |
| Claude.ai (claude.ai) | Supported |
| Gemini (gemini.google.com) | Supported |

Adding a new site requires only one new adapter file in `src/adapters/` and a registry entry in `src/adapters/index.ts`.

## Tech Stack

- [WXT](https://wxt.dev) — Vite-based Chrome extension framework
- [React](https://react.dev) + TypeScript
- [Anthropic Claude API](https://docs.anthropic.com) — Enhancement engine
- Chrome Storage API — Settings + history persistence
