import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

import type { PluginOption } from 'vite';
import {
  infileComponentsVitePlugin,
  dummyVitePlugin,
} from 'vite-plugin-svelte-infile-components';
import type { PluginOptions } from '@sveltejs/vite-plugin-svelte';

//console.log('sveltekit-vite-plugin:', await sveltekit());

function postSvelteVitePlugin(): PluginOption {
  const name = 'post-svelte-vite-plugin';

  function logHook(id?: string) {
    if (id?.includes('node_modules')) return () => undefined;

    return (...args: unknown[]) => {
      let prefix = `[${name}]`;
      if (typeof args[0] === 'string') {
        const [matchedString] = args[0].match(/\s*/) ?? [];
        if (matchedString) {
          args[0] = args[0].slice(matchedString.length);
          prefix = matchedString + prefix;
        }
      }

      console.log(prefix, ...args);
    };
  }

  function _summary(code: string | undefined | null, length = 100) {
    if (!code) return code;
    if (!Number.isFinite(length) || length <= 0) return code;
    if (code.length < length * 2) return code;

    return code.slice(0, length) + '...' + code.slice(-length);
  }

  return {
    name,
    resolveId(source: string, importer: string | undefined) {
      if (source.startsWith('__sveltekit/server')) return null;
      if (source.startsWith('\u0000virtual:__sveltekit/')) return null;
      if (source.startsWith('svelte/internal')) return null;
      if (source.includes('/.svelte-kit/generated/')) return null;
      if (importer?.includes('/node_modules/')) return null;
      if (importer?.includes('/.svelte-kit/generated/')) return null;

      logHook(source)('\n[resolveId]', JSON.stringify(source), { importer });
      return null;
    },
    load(id) {
      if (id.startsWith('__sveltekit/server')) return null;
      if (id.startsWith('\u0000virtual:__sveltekit/')) return null;
      if (id.startsWith('svelte/internal')) return null;
      if (id.includes('/.svelte-kit/generated/')) return null;

      //if (!id.startsWith(`${PREFIX}`)) return null;

      logHook(id)('\n[load]', JSON.stringify(id));
      return null;
    },
    async transform(code, id, options) {
      //return null; // XXX
      if (id.includes('/node_modules/')) return null;
      if (id.includes('/.svelte-kit/generated/')) return null;
      if (id.startsWith('\u0000virtual:__sveltekit/')) return null;
      if (!id.includes('.svelte')) return null;

      logHook(id)('\n[transform]', JSON.stringify(id), {
        code: _summary(code, 0),
      });
    },
  };
}

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
