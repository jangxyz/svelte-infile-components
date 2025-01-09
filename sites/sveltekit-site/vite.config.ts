import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

import {
  infileComponentsVitePlugin,
  //dummyVitePlugin,
  postSvelteVitePlugin,
} from 'vite-plugin-svelte-infile-components';

//console.log('sveltekit-vite-plugin:', await sveltekit());

export default defineConfig({
  plugins: [
    infileComponentsVitePlugin(),
    //dummyVitePlugin(),
    sveltekit(),
    postSvelteVitePlugin(),
  ],

  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
  },
});
