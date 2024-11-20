import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

import { infileComponentsVitePlugin } from 'vite-svelte-infile-components-plugin';

export default defineConfig({
  plugins: [infileComponentsVitePlugin(), sveltekit()],

  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
  },
});
