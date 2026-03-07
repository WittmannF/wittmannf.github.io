import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://fernandowittmann.com',

  integrations: [mdx(), sitemap()],

  markdown: {
    shikiConfig: {
      theme: 'tokyo-night',
      wrap: true
    }
  },

  vite: {
    plugins: [tailwindcss()]
  }
});