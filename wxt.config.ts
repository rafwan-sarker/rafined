import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'RAFined — AI Prompt Enhancer',
    description: 'Enhance your AI prompts with one click using prompt engineering best practices',
    permissions: ['storage'],
    host_permissions: ['https://api.anthropic.com/*'],
    icons: {
      '16': 'icons/icon-16.svg',
      '48': 'icons/icon-48.svg',
      '128': 'icons/icon-128.svg',
    },
  },
  vite: () => ({
    plugins: [react()],
  }),
});
