// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://progressivesforai.com',
  output: 'static',
  integrations: [mdx(), sitemap({ filter: (page) => !page.includes('/gcs/') })],
  vite: { server: { allowedHosts: ['jordans-mac-mini'] } },
});
