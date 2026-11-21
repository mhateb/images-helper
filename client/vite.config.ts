import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function inlineMainCss(): Plugin {
  return {
    name: 'inline-main-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find(
        (item) => item.type === 'asset' && item.fileName === 'index.html',
      );
      const css = Object.values(bundle).find(
        (item) =>
          item.type === 'asset' &&
          item.fileName.startsWith('assets/index-') &&
          item.fileName.endsWith('.css'),
      );
      if (!html || html.type !== 'asset' || !css || css.type !== 'asset') return;

      const sheet =
        typeof css.source === 'string' ? css.source : new TextDecoder().decode(css.source);
      const page =
        typeof html.source === 'string' ? html.source : new TextDecoder().decode(html.source);
      const link = new RegExp(`<link rel="stylesheet"[^>]*href="/${css.fileName}"[^>]*>`);
      if (!link.test(page)) return;

      html.source = page.replace(link, () => `<style>${sheet}</style>`);
      delete bundle[css.fileName];
    },
  };
}

export default defineConfig({
  plugins: [react(), inlineMainCss()],
  // Monorepo: shared secrets/config live in the repo root `.env`
  envDir: '..',
  optimizeDeps: {
    exclude: ['shared'],
  },
  server: {
    port: 5173,
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
