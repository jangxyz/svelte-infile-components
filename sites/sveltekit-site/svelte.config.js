import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

//import { svelteInfileComponents } from './dist/svelte-preprocessor.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: [
    //svelteInfileComponents(),
    loggingPreprocessor(),
    vitePreprocess(),
  ],

  kit: {
    // adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
    // If your environment is not supported, or you settled on a specific environment, switch out the adapter.
    // See https://svelte.dev/docs/kit/adapters for more information about adapters.
    adapter: adapter(),
    alias: {
      // Though not required for the code to run, this sends 'Go to Definitions' command
      // in vscode directly to the source code, instead of the build.
      'vite-plugin-svelte-infile-components':
        '../../packages/vite-plugin/src/lib/index.ts',
    },
  },
};

export default config;

function loggingPreprocessor() {
  return {
    markup({ content, filename }) {
      if (filename.includes('/node_modules/')) return null;
      if (filename.includes('/.svelte-kit/generated/')) return null;

      console.log(`[PREPROCESSOR: MARKUP] Processing file: ${filename}`);
      //console.log(`[PREPROCESSOR: MARKUP] Original content:\n${content}`);
      // Optionally modify the markup content here
      return { code: content };
    },
    script({ content, attributes, filename }) {
      //console.log(`[PREPROCESSOR: SCRIPT] Processing file: ${filename}`);
      //console.log(`[PREPROCESSOR: SCRIPT] Script attributes:`, attributes);
      //console.log(`[PREPROCESSOR: SCRIPT] Original content:\n${content}`);
      // Optionally modify the script content here
      return { code: content };
    },
    style({ content, attributes, filename }) {
      //console.log(`[PREPROCESSOR: STYLE] Processing file: ${filename}`);
      //console.log(`[PREPROCESSOR: STYLE] Style attributes:`, attributes);
      //console.log(`[PREPROCESSOR: STYLE] Original content:\n${content}`);
      // Optionally modify the style content here
      return { code: content };
    },
  };
}
