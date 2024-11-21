import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

import {
  infileComponentsVitePlugin,
  dummyVitePlugin,
} from 'vite-plugin-svelte-infile-components';

//console.log('sveltekit-vite-plugin:', await sveltekit());

export default defineConfig({
  plugins: [
    infileComponentsVitePlugin(),
    //dummyVitePlugin(),
    sveltekit(),
  ],

  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
  },
});

//function infileComponentsVitePlugin() {
//  return {
//    name: 'vite-svelte-infile-components-plugin',
//    enforce: 'pre',
//    resolveId(source: string) {
//      if (source.endsWith('!MyCounter.svelte')) {
//        console.log(
//          '🚀 ~ file: vite.config.ts:28 ~ resolveId ~ source:',
//          source,
//        );
//        // Return a virtual file path with a `.svelte` extension
//        return `infile:${source.replace('!', '_')}`;
//      }
//      return null;
//    },
//    load(id: string) {
//      if (id.startsWith('infile:_')) {
//        console.log('🚀 ~ file: vite.config.ts:37 ~ load ~ id:', id);
//        // Provide Svelte component code
//        return `
//          <script>
//            export let count = 0;
//          </script>
//          <button on:click={() => count++}>Count here: {count}</button>
//        `;
//      }
//      return null;
//    },
//  };
//}
