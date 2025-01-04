import type { ModuleNode, PluginOption } from 'vite';

import { compile } from 'svelte/compiler';
import {
  splitSegmentsWithPosition,
  findVirtualSegmentFromFileContent,
} from './core/index.js';
import { _summary } from './core/helpers.js';

export const SEP = '!';

export function infileComponentsVitePlugin(): PluginOption {
  const PREFIX = 'infile:';

  // Track importing file contents
  const fileContentMap = new Map<string, string>();

  return {
    name: 'infile-components',
    enforce: 'pre',

    /**
     * Intercept any import that starts with "virtual:" and
     * save to the internal virtual importer map.
     */
    resolveId: function resolveId(
      source: string,
      importer: string | undefined,
    ) {
      //return null; // XXX
      if (source.startsWith('__sveltekit/server')) return null;
      if (source.startsWith('\u0000virtual:__sveltekit/')) return null;
      if (source.startsWith('svelte/internal')) return null;
      if (source.includes('/.svelte-kit/generated/')) return null;
      if (importer?.includes('/node_modules/')) return null;
      if (importer?.includes('/.svelte-kit/generated/')) return null;

      if (!source.startsWith(PREFIX)) {
        return null;
      }

      logHook(source)(
        '\n[resolveId]',
        JSON.stringify(source),
        { importer },
        {
          startsWith_Prefix: source.startsWith(PREFIX),
          startsWith_Void0: source.startsWith(`\0${PREFIX}`),
        },
      );

      if (!importer) {
        throw new Error(
          `Unable to resolve virtual import without an importer.`,
        );
      }

      // save filepath + module name
      //   id => `virtual:filename!moduleName`
      let resolvedId = `${importer}${SEP}${source.slice(PREFIX.length)}`;
      if (!importer.startsWith(`\0${PREFIX}`)) {
        resolvedId = `\0${PREFIX}` + resolvedId; // XXX
      }
      //if (!importer.startsWith(`${PREFIX}`)) {
      //  resolvedId = `${PREFIX}` + resolvedId; // XXX
      //}

      console.log('=>', JSON.stringify(resolvedId));
      return resolvedId;
    },

    /**
     * Load the content based on the virtual module's name.
     */
    load(id) {
      //return null; // XXX
      if (id.startsWith('__sveltekit/server')) return null;
      if (id.startsWith('\u0000virtual:__sveltekit/')) return null;
      if (id.startsWith('svelte/internal')) return null;
      if (id.includes('/.svelte-kit/generated/')) return null;

      if (!id.startsWith(`\0${PREFIX}`)) return null;
      //if (!id.startsWith(`${PREFIX}`)) return null;

      logHook(id)('\n[load]', JSON.stringify(id), {
        idStartsWithVoid0: id.startsWith(`\0${PREFIX}`),
        'fileContentMap.keys': [...fileContentMap.keys()],
        //'_virtualImporterMap.keys': [..._virtualImporterMap.keys()],
      });

      // ---

      // Extract the name

      // load virtual module w/ importer
      // id: `virtual:filename#moduleName`
      //   importer: filename
      //   virtual name: moduleName
      const _splits = id.slice(PREFIX.length + 1).split(SEP);
      const [importer] = _splits;
      let virtualName = _splits.at(-1)!;
      console.log(
        '🚀 ~ file: plugin.ts:103 ~ load ~ [importer, virtualName]:',
        [importer, virtualName],
      );
      virtualName = virtualName.replace(/[.]svelte$/i, ''); // strip out svelte extension

      // load the original file content from the importer path
      const content = fileContentMap.get(importer);
      //console.log('LOAD FROM fileContentMap:', JSON.stringify(importer), { id, virtualName, content: _summary(content), 'fileContentMap.keys': [...fileContentMap.keys()], });

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

      console.log(
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
    async transform(code, id, options) {
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
      //console.log('[transform]2', JSON.stringify(id), { code, parsed, resolvedId, });

      // transform virtual module content
      if (id.startsWith(`\0${PREFIX}`)) {
        //if (id.startsWith(`${PREFIX}`)) {
        const matchData = code.match(
          /^\s*<template[^>]*>(.*)<\/template>\s*$/s,
        );
        if (!matchData) {
          throw new Error('cannot find inner content');
        }

        const cleanCode = matchData[1];
        console.log('=> 🚀 cleanCode:', {
          id,
          code: _summary(code),
          cleanCode: _summary(cleanCode),
          options,
        });

        const compiled = compile(cleanCode, {
          generate: options?.ssr ? 'server' : 'client',
        });

        console.log('🚀 ~ file: plugin.ts:186 ~ compiled.js:', {
          compiled: compiled.js,
        });

        return compiled.js;
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
          console.log('SAVE TO fileContentMap:', JSON.stringify(id));
          console.log('=> 🚀 cleanCode:', {
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
    handleHotUpdate(ctx) {
      console.log('[handleHotUpdate]', ctx);
      const { modules, server } = ctx;
      const moduleIds = [...server.moduleGraph.idToModuleMap.keys()];
      //const moduleFiles = [...server.moduleGraph.fileToModulesMap.keys()];
      //const moduleUrls = [...server.moduleGraph.urlToModuleMap.keys()];
      const mod = modules[0];
      const otherModuleIds = moduleIds.filter((id) =>
        id.startsWith('\x00infile:' + mod.id + SEP),
      );
      const otherModules = otherModuleIds
        .map((modId) => server.moduleGraph.getModuleById(modId))
        .filter(Boolean) as ModuleNode[];

      //console.log('🚀 ~ file: plugin.ts:239 ~ handleHotUpdate:', { moduleFiles: moduleFiles.filter( (file) => !file.includes('/node_modules/'),), moduleIds: moduleIds.filter((id) => !id.includes('/node_modules/')), moduleUrls: moduleUrls.filter((id) => !id.includes('/node_modules/')), modId: mod.id, otherModuleIds, otherModules, });

      // request updating other modules too
      if (otherModuleIds.length > 0) {
        return otherModules;
      }

      if (modules.some((mod) => mod.id?.startsWith(`\0${PREFIX}`))) {
        return server.moduleGraph.invalidateModule(mod);
      }
    },
  };
}

function logHook(id?: string) {
  if (id?.includes('node_modules')) return () => undefined;
  return (...args: unknown[]) => console.log(...args);
}
