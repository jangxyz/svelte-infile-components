// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';
import { infileComponentsVitePlugin } from 'vite-plugin-svelte-infile-components';

// https://astro.build/config
export default defineConfig({
  integrations: [svelte()],
  vite: {
    plugins: [infileComponentsVitePlugin()],
  },
});
