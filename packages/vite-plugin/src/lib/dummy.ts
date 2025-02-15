import type { PluginOption } from 'vite';

import {
  splitSegmentsWithPosition,
  findVirtualSegmentFromFileContent,
} from './core/index.js';
import { _summary } from './core/helpers.js';

export const SEP = '!';

export function dummyVitePlugin(): PluginOption {
  const PREFIX = 'infile:';

  return {
    name: 'dummy',
    enforce: 'pre',

    /**
     * Intercept any import that starts with "virtual:",
     * and save to the internal virtual importer map.
     */
    resolveId(source, importer) {
      //return null; // XXX
      if (source.startsWith('__sveltekit/server')) return null;
      if (source.startsWith('\u0000virtual:__sveltekit/')) return null;
      if (source.startsWith('svelte/internal')) return null;
      if (source.includes('/.svelte-kit/generated/')) return null;
      if (importer?.includes('/node_modules/')) return null;
      if (importer?.includes('/.svelte-kit/generated/')) return null;

      logHook(source)('[resolveId]', JSON.stringify(source), { importer });

      if (!importer) {
        throw new Error(
          `Unable to resolve virtual import without an importer.`,
        );
      }

      return null;
    },

    /**
     * Load the content based on the virtual module's name.
     */
    load(id) {
      //return null; // XXX
      if (!id.startsWith(`\0${PREFIX}`)) return null;

      logHook(id)('[load]', JSON.stringify(id), id.startsWith(`\0${PREFIX}`));

      return null;

      // ---

      // Extract the name

      // load virtual module w/ importer
      // id: `virtual:filename#moduleName`
      //   importer: filename
      //   virtual name: moduleName
      let [importer, virtualName] = id.slice(PREFIX.length + 1).split(SEP);
      virtualName = virtualName.replace(/[.]svelte$/i, '');

      // load the original file content from the importer path
      const content = fileContentMap.get(importer);
      //console.log('LOAD FROM fileContentMap:', JSON.stringify(importer), { id, virtualName, content: _summary(content), 'fileContentMap.keys': [...fileContentMap.keys()], '_virtualImporterMap.keys': [..._virtualImporterMap.keys()], });

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
        '=> 🚀 ~ file: plugin.js:99 ~ [load] ~ content:',
        JSON.stringify(name),
        JSON.stringify(_summary(exportedCode)),
        { id, importer, virtualName, content: _summary(content) },
      );

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
    async transform(code, id) {
      //return null; // XXX
      if (id.includes('/node_modules/')) return null;
      if (id.includes('/.svelte-kit/generated/')) return null;
      if (id.startsWith('\u0000virtual:__sveltekit/')) return null;

      logHook(id)('[transform]', JSON.stringify(id), {
        code: _summary(code, 150),
      });

      if (id.endsWith('.svelte')) {
        const cleanCode = code;
        console.log('=> 🚀 cleanCode:', {
          id,
          code: _summary(code),
          cleanCode: _summary(cleanCode),
        });
        return cleanCode;
      }

      return null;

      // print out full code
      //// prettier-ignore
      //logHook(id)('[transform]', JSON.stringify(id) + `\n${'='.repeat(40)}\n${code}\n${'='.repeat(40)}`);

      //const parsed = this.parse(code);
      //const resolvedId = await this.resolve(code, id);
      //console.log('[transform]2', JSON.stringify(id), { code, parsed, resolvedId, });

      // transform virtual module content
      if (id.startsWith(`\0${PREFIX}`)) {
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
        });
        return cleanCode;
      }
      // check segments
      else {
        const [mainSegment, segments] = splitSegmentsWithPosition(code);
        logHook(id)(
          '[transform]',
          '🚀 ~ file: plugin.ts:135 ~ transform segments:',
          JSON.stringify(id),
          { mainSegment, 'segments.length': segments.length },
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
      console.log('[handleHotUpdate]');
      if (ctx.modules.some((mod) => mod.id?.startsWith('\0' + PREFIX))) {
        return ctx.server.moduleGraph.invalidateModule(ctx.modules[0]);
      }
    },
  };
}

function logHook(id?: string) {
  if (id?.includes('node_modules')) return () => undefined;
  return (...args: unknown[]) => console.log(...args);
}
