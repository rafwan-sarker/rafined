# RAFined — AI Prompt Enhancer (Chrome Extension)

## Project Overview
Chrome extension that injects an "Enhance" button into ChatGPT, Claude.ai, and Gemini. Reads your prompt + conversation context, sends to Claude Sonnet API for enhancement, streams the result in a modal overlay. User can Use Enhanced / Edit / Keep Original.

## Tech Stack
- **Framework:** WXT (Vite-based, Manifest V3)
- **UI:** React + TypeScript
- **Styling:** CSS in Shadow DOM (style isolation from host sites)
- **API:** Anthropic Claude Sonnet (user provides own API key)
- **Storage:** Chrome Storage API (local)

## Architecture
- **Content Script** — Detects site, injects button + modal via Shadow DOM, MutationObserver for SPA navigation
- **Background Worker** — Handles Anthropic API calls (CORS), SSE streaming, relays chunks via chrome.runtime.connect() ports
- **Popup** — Settings (API key, tone, defaults) + History (before/after prompt pairs)
- **Site Adapters** — Modular per-site DOM interaction (ChatGPT, Claude, Gemini)

## Key Patterns
- Site adapter interface in `src/adapters/types.ts` — add new sites by creating one adapter file + registry entry
- Streaming via persistent ports (not sendMessage) for real-time relay
- `document.execCommand('insertText')` for contenteditable/ProseMirror editors
- Enhancement engine ported from `~/AI/projects/prompt-enhancer-bot/enhancer.py`

## Commands
- `npm run dev` — Start dev mode with HMR
- `npm run build` — Production build to `.output/chrome-mv3/`
- `npm run zip` — Build + zip for distribution

## Project Structure
```
src/
├── entrypoints/          # WXT entry points
│   ├── background.ts     # Service worker (API + streaming)
│   ├── content.ts        # Content script (UI injection)
│   └── popup/            # Extension popup (React)
├── adapters/             # Site-specific DOM logic
├── components/           # React components
├── services/             # Enhancement engine, API client, SSE parser
├── lib/                  # Storage, messaging, constants
├── hooks/                # React hooks (useSettings, useHistory)
├── styles/               # CSS for button, modal, popup
└── types/                # TypeScript interfaces
```
