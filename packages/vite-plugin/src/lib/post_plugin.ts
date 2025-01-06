import type { PluginOption } from 'vite';

const name = 'post-svelte-vite-plugin';

export function postSvelteVitePlugin(): PluginOption {
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

function _summary(code: string | undefined | null, length = 100) {
  if (!code) return code;
  if (!Number.isFinite(length) || length <= 0) return code;
  if (code.length < length * 2) return code;

  return code.slice(0, length) + '...' + code.slice(-length);
}

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
