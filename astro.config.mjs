import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://fernandowittmann.com',

  integrations: [mdx(), sitemap(), react()],

  markdown: {
    shikiConfig: {
      theme: 'tokyo-night',
      wrap: true
    }
  },

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ['framer-motion']
    }
  }
});