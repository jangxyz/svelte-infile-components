import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

//import { infileComponentsVitePlugin } from '$lib/vite-plugin/plugin.js';

export default defineConfig({
  plugins: [
    //infileComponentsVitePlugin(),
    sveltekit(),
  ],

  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
  },
});
