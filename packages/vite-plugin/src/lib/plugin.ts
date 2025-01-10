import type { ModuleNode, PluginOption, ResolvedConfig } from 'vite';

import { compile } from 'svelte/compiler';
import {
  splitSegmentsWithPosition,
  findVirtualSegmentFromFileContent,
} from './core/index.js';
import { _summary } from './core/helpers.js';

import { handleHotUpdate } from './svelte-vite-plugin/handle-hot-update.js';
import { createCompileSvelte } from './svelte-vite-plugin/utils/compile.js';
import {
  preResolveOptions,
  resolveOptions,
} from './svelte-vite-plugin/utils/options.js';
import { VitePluginSvelteCache } from './svelte-vite-plugin/utils/vite-plugin-svelte-cache.js';
import type { CompileSvelte } from './svelte-vite-plugin/types/compile.js';
import type { ResolvedOptions } from './svelte-vite-plugin/types/options.js';
import type { Options } from './svelte-vite-plugin/public.js';
import type { IdParser } from './svelte-vite-plugin/types/id.js';
import { buildIdParser } from './svelte-vite-plugin/utils/id.js';
import { toRollupError } from './svelte-vite-plugin/utils/error.js';
import { logCompilerWarnings } from './svelte-vite-plugin/utils/log.js';
import { ensureWatchedFile } from './svelte-vite-plugin/utils/watch.js';

export const SEP = '!';

export function infileComponentsVitePlugin(
  inlineOptions: Partial<Options> = {},
): PluginOption {
  const PREFIX = 'infile:';

  let options: ResolvedOptions;
  let viteConfig: ResolvedConfig;
  let compileSvelte: CompileSvelte;
  let requestParser: IdParser;

  // Track importing file contents
  const fileContentMap = new Map<string, string>();

  const cache = new VitePluginSvelteCache();

  return {
    name: 'infile-components',
    enforce: 'pre',

    async config(config, configEnv) {
      // @ts-expect-error temporarily lend the options variable until fixed in configResolved
      options = await preResolveOptions(inlineOptions, config, configEnv);
    },
    async configResolved(config) {
      viteConfig = config;
      options = resolveOptions(options, config, cache);
      requestParser = buildIdParser(options);
      compileSvelte = createCompileSvelte();
    },

    /**
     * Intercept any import that starts with "virtual:" and
     * save to the internal virtual importer map.
     */
    resolveId: function resolveId(
      source: string,
      importer: string | undefined,
      opts,
    ) {
      //return null; // XXX
      if (source.startsWith('__sveltekit/server')) return null;
      if (source.startsWith('\u0000virtual:__sveltekit/')) return null;
      if (source.startsWith('svelte/internal')) return null;
      if (source.includes('/.svelte-kit/generated/')) return null;
      if (importer?.includes('/node_modules/')) return null;
      if (importer?.includes('/.svelte-kit/generated/')) return null;

      logHook(source)(
        '\n[resolveId]',
        JSON.stringify(source),
        { importer },
        {
          startsWith_Prefix: source.startsWith(PREFIX),
          startsWith_Void0: source.startsWith(`\0${PREFIX}`),
        },
      );

      // style imports: ".../App.svelte!MyCounter.svelte?svelte&type=style&lang.css"
      // perform only on infile modules
      if (source.includes(SEP)) {
        const svelteRequest = requestParser(source, Boolean(opts?.ssr));
        if (svelteRequest?.query.svelte) {
          if (svelteRequest.query.type === 'style' && !svelteRequest.raw) {
            // return cssId with root prefix so postcss pipeline of vite finds the directory correctly
            // see https://github.com/sveltejs/vite-plugin-svelte/issues/14
            //console.log(`[DEBUG] [resolve] resolveId resolved virtual css module ${svelteRequest.cssId}`);
            return svelteRequest.cssId;
          }
        }
      }

      if (!source.startsWith(PREFIX)) {
        return null;
      }

      if (!importer) {
        throw new Error(
          `Unable to resolve virtual import without an importer.`,
        );
      }

      // save filepath + module name
      //   id => `infile:filename!moduleName`
      let resolvedId = `${importer}${SEP}${source.slice(PREFIX.length)}`;
      if (!importer.startsWith(`\0${PREFIX}`)) {
        resolvedId = `\0${PREFIX}` + resolvedId; // XXX
      }
      //if (!importer.startsWith(`${PREFIX}`)) {
      //  resolvedId = `${PREFIX}` + resolvedId; // XXX
      //}

      logHook(source)('=>', JSON.stringify(resolvedId));
      return resolvedId;
    },

    /**
     * Load the content based on the virtual module's name.
     */
    async load(id, opts) {
      //return null; // XXX
      if (id.startsWith('__sveltekit/server')) return null;
      if (id.startsWith('\u0000virtual:__sveltekit/')) return null;
      if (id.startsWith('svelte/internal')) return null;
      if (id.includes('/.svelte-kit/generated/')) return null;

      logHook(id)('\n[load]', JSON.stringify(id), {
        idStartsWithVoid0: id.startsWith(`\0${PREFIX}`),
        'fileContentMap.keys': [...fileContentMap.keys()],
        //'_virtualImporterMap.keys': [..._virtualImporterMap.keys()],
      });

      if (id.includes(SEP)) {
        const svelteRequest = requestParser(id, Boolean(opts?.ssr));
        //console.log( '🚀 ~ file: plugin.ts:146 ~ load ~ svelteRequest:', svelteRequest, { id },);
        if (svelteRequest?.query) {
          const { query } = svelteRequest;
          //console.log("🚀 ~ file: vite-plugin-svelte/index.js:152 ~ load ~ svelteRequest:", svelteRequest)
          if (query.svelte && query.type === 'style') {
            const css = cache.getCSS(svelteRequest);
            //console.log("🚀 ~ file: vite-plugin-svelte/index.js:155 ~ load ~ css:", css)
            if (css) {
              return css;
            }
          }
        }
      }

      if (!id.startsWith(`\0${PREFIX}`)) return null;
      //if (!id.startsWith(`${PREFIX}`)) return null;

      // ---

      // Extract the name

      // load virtual module w/ importer
      // id: `virtual:filename#moduleName`
      //   importer: filename
      //   virtual name: moduleName
      const _splits = id.slice(PREFIX.length + 1).split(SEP);
      const [importer] = _splits;
      let virtualName = _splits.at(-1)!;
      logHook(id)(
        '🚀 ~ file: plugin.ts:103 ~ load ~ [importer, virtualName]:',
        [importer, virtualName],
      );
      virtualName = virtualName.replace(/[.]svelte$/i, ''); // strip out svelte extension

      // load the original file content from the importer path
      const content = fileContentMap.get(importer);
      //logHook(id)('LOAD FROM fileContentMap:', JSON.stringify(importer), { id, virtualName, content: _summary(content), 'fileContentMap.keys': [...fileContentMap.keys()], });

      // no such content. revert to default behavior
      if (content === undefined) {
        //throw new Error(`Failed to find file content for "${importer}"`);
        return null;
      }

      // find the matching virtual segment for the virtual name
      const { name, exportedCode } = findVirtualSegmentFromFileContent(
        content,
        virtualName,
      );

      logHook(id)(
        '=> 🚀 ~ file: plugin.js:125 ~ [load] ~ content:',
        JSON.stringify(name),
        JSON.stringify(_summary(exportedCode)),
        { id, importer, virtualName, content: _summary(content) },
      );
      if (id.match(/(svelte!.*){5,}/)) {
        throw new Error('too many nestings');
      }

      if (!name || !exportedCode) {
        throw new Error(`Virtual module "${virtualName}" not found.`);
      }

      return exportedCode; // Inject the code dynamically
    },

    /**
     * Transform the original file by removing everything after the first '---'.
     * As it holds the code, we set the { id => file content } map, so
     * it can
     */
    async transform(code, id, opts) {
      //return null; // XXX
      if (id.includes('/node_modules/')) return null;
      if (id.includes('/.svelte-kit/generated/')) return null;
      if (id.startsWith('\u0000virtual:__sveltekit/')) return null;
      if (!id.endsWith('.svelte')) return null;

      logHook(id)('\n[transform]', JSON.stringify(id), {
        code: _summary(code, 150),
      });
      // print out full code
      //// prettier-ignore
      //logHook(id)('[transform]', JSON.stringify(id) + `\n${'='.repeat(40)}\n${code}\n${'='.repeat(40)}`);

      //const parsed = this.parse(code);
      //const resolvedId = await this.resolve(code, id);
      //logHook(id)('[transform]2', JSON.stringify(id), { code, parsed, resolvedId, });

      let requestIdFile = id.startsWith(`\0${PREFIX}`)
        ? id.slice(`\0${PREFIX}`.length)
        : id;
      const svelteRequest = requestParser(requestIdFile, Boolean(opts?.ssr));
    //  console.log( '🚀 ~ file: vite-plugin-svelte/plugin.ts:244 ~ transform ~ svelteRequest:', svelteRequest,);
      //if (!svelteRequest || svelteRequest.query.type === 'style' || svelteRequest.raw) {
      //  return;
      //}
      let compileData;
      if (
        svelteRequest &&
        svelteRequest.query.type !== 'style' &&
        !svelteRequest.raw
      ) {
        try {
          let code1 = id.startsWith(`\0${PREFIX}`)
            ? extractTemplateComponentInnerCode(code)
            : code;
          compileData = await compileSvelte(svelteRequest, code1, options);
          //console.log('🚀 ~ file: vite-plugin-svelte/plugin.js:260 ~ transform ~ compileData:', compileData, { svelteRequest, options },);
        } catch (e) {
          cache.setError(svelteRequest, e);
          throw toRollupError(e as any, options);
        }
        logCompilerWarnings(
          svelteRequest,
          compileData.compiled.warnings,
          options,
        );
        cache.update(compileData);
        if (compileData.dependencies?.length) {
          if (options.server) {
            for (const dep of compileData.dependencies) {
              ensureWatchedFile(options.server.watcher, dep, options.root);
            }
          } else if (options.isBuild && viteConfig.build.watch) {
            for (const dep of compileData.dependencies) {
              this.addWatchFile(dep);
            }
          }
        }
      }

      // transform virtual module content
      if (id.startsWith(`\0${PREFIX}`)) {
        if (compileData) {
          //console.log("🚀 ~ file: vite-plugin-svelte/index.js:285 ~ transform ~ returning:", { ...compileData.compiled.js, meta: { vite: { lang: compileData.lang } } });
          return {
            ...compileData.compiled.js,
            meta: {
              vite: {
                lang: compileData.lang,
              },
            },
          };
        } else {
          const cleanCode = extractTemplateComponentInnerCode(code);
          logHook(id)('=> 🚀 cleanCode:', {
            id,
            code: _summary(code),
            cleanCode: _summary(cleanCode),
            options: opts,
          });
          const compiled = compile(cleanCode, {
            generate: opts?.ssr ? 'server' : 'client',
          });
          logHook(id)('🚀 ~ file: plugin.ts:264 ~ compiled.js:', {
            compiled: compiled.js,
          });
          return compiled.js;
        }
      }
      // check segments
      else {
        const [mainSegment, segments] = splitSegmentsWithPosition(code);
        logHook(id)(
          '[transform]',
          '🚀 ~ file: plugin.ts:188 ~ transform segments:',
          JSON.stringify(id),
          {
            mainSegment,
            'segments.length': segments.length,
            hasSegments: segments.length > 1,
          },
        );

        const hasSegments = segments.length > 1;
        if (hasSegments) {
          // return clean code for the main segment
          const cleanCode = mainSegment.text;

          fileContentMap.set(id, code);
          logHook(id)('SAVE TO fileContentMap:', JSON.stringify(id));
          logHook(id)('=> 🚀 cleanCode:', {
            id,
            code: _summary(code),
            cleanCode: _summary(cleanCode),
          });
          return cleanCode;
        }
      }

      // Leave other files unchanged
      return null;
    },
    ///
    //moduleParsed(info) { logHook()( '[moduleParsed]', JSON.stringify(info.id), { ...info, importedIds: info.importedIds, }, { importedIds: info.importedIds },); },
    //buildEnd(error) { logHook()('[buildEnd]', { error }); },
    //closeBundle() { logHook()('[closeBundle]'); },
    //shouldTransformCachedModule(options) { logHook()('[shouldTransformCachedModule]', options); },
    ///

    // HMR support: Reload the virtual module when content changes
    async handleHotUpdate(ctx) {
      logHook()('[handleHotUpdate]', ctx);

      const moduleIds = [...ctx.server.moduleGraph.idToModuleMap.keys()];
      const mod = ctx.modules[0];
      const otherModuleIds = moduleIds.filter((id) =>
        id.startsWith('\x00infile:' + mod.id + SEP),
      );
      const otherModules = otherModuleIds
        .map((modId) => ctx.server.moduleGraph.getModuleById(modId))
        .filter(Boolean) as ModuleNode[];

      logHook()('🚀 ~ file: plugin.ts:366 ~ handleHotUpdate:', {
        //moduleFiles: moduleFiles.filter((file) => !file.includes('/node_modules/')),
        moduleIds: moduleIds.filter((id) => !id.includes('/node_modules/')),
        modId: mod.id,
        otherModuleIds,
        //otherModules,
      });

      if (options.compilerOptions.hmr && options.emitCss) {
        const svelteRequest = requestParser(ctx.file, false, ctx.timestamp);
        //console.log('🚀 ~ file: plugin.ts:376 ~ svelteRequest:', svelteRequest, { file: ctx.file, timestamp: ctx.timestamp, compileSvelte, cache, options, });
        if (svelteRequest) {
          const updateResult = await handleHotUpdate(
            compileSvelte,
            ctx,
            svelteRequest,
            cache,
            options,
          );
        //  console.log('🚀 ~ file: plugin.ts:386 ~ updateResult:', updateResult, { cached: cache.has(svelteRequest) });
          return (updateResult ?? []).concat(otherModules);
        }
      }

      // request updating other modules too
      if (otherModuleIds.length > 0) {
        return otherModules;
      }

      if (ctx.modules.some((mod) => mod.id?.startsWith(`\0${PREFIX}`))) {
        return ctx.server.moduleGraph.invalidateModule(mod);
      }
    },
  };
}

function logHook(id?: string) {
  if (id?.includes('node_modules')) return () => undefined;
  return (...args: unknown[]) => {
    return;
    console.log(...args);
  };
}

function extractTemplateComponentInnerCode(code: string) {
  const matchData = code.match(/^\s*<template[^>]*>(.*)<\/template>\s*$/s);
  if (!matchData) {
    throw new Error('cannot find inner content');
  }

  return matchData[1];
}
