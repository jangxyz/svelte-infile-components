import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

import {
  infileComponentsVitePlugin,
  dummyVitePlugin,
} from 'vite-plugin-svelte-infile-components';

// https://vite.dev/config/
export default defineConfig({
  plugins: [infileComponentsVitePlugin(), svelte()],
});
