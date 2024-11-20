import type { PluginOption } from 'vite';

import {
  splitSegmentsWithPosition,
  findVirtualSegmentFromFileContent,
} from './core/index.js';

export const SEP = '!';

export function infileComponentsVitePlugin(): PluginOption {
  const PREFIX = 'infile:';

  // Track importing file contents
  const fileContentMap = new Map<string, string>();

  return {
    name: 'infile-components',

    /**
     * Intercept any import that starts with "virtual:",
     * and save to the internal virtual importer map.
     */
    resolveId(source, importer) {
      //return null; // XXX
      if (source.startsWith('__sveltekit/server')) return null;
      if (source.startsWith('\u0000virtual:__sveltekit/')) return null;

      if (!source.startsWith(PREFIX)) {
        return null;
      }

      logHook(source)(
        '[resolveId]',
        JSON.stringify(source),
        { importer },
        source.startsWith(PREFIX),
        source.startsWith(`\0${PREFIX}`),
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
        resolvedId = `\0${PREFIX}` + resolvedId;
      }

      //console.log('=>', JSON.stringify(resolvedId));
      return resolvedId;
    },

    /** Load the content based on the virtual module's name */
    load(id) {
      //return null; // XXX
      if (!id.startsWith('\0' + PREFIX)) return null;

      logHook(id)('[load]', JSON.stringify(id), id.startsWith('\0' + PREFIX), {
        'fileContentMap.keys': [...fileContentMap.keys()],
        //'_virtualImporterMap.keys': [..._virtualImporterMap.keys()],
      });

      // ---

      // Extract the name

      // load virtual module w/ importer
      // id: `virtual:filename#moduleName`
      //   importer: filename
      //   virtual name: moduleName
      const [importer, virtualName] = id.slice(PREFIX.length + 1).split(SEP);

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
      if (id.includes('/.svelte-kit/generated/')) return null;
      if (id.startsWith('\u0000virtual:__sveltekit/')) return null;

      logHook(id)('[transform]', JSON.stringify(id), {
        code: _summary(code, 150),
      });

      //const parsed = this.parse(code);
      //const resolvedId = await this.resolve(code, id);
      //console.log('[transform]2', JSON.stringify(id), { code, parsed, resolvedId, });

      const [mainSegment, segments] = splitSegmentsWithPosition(code);
      const hasSegments = segments.length > 1;
      const cleanCode = mainSegment.text;
      if (hasSegments) {
        fileContentMap.set(id, code);
        //console.log('SAVE TO fileContentMap:', JSON.stringify(id));
        console.log('=> 🚀 cleanCode:', {
          id,
          code: _summary(code),
          cleanCode: _summary(cleanCode),
        });
        return cleanCode;
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

function _summary(code: string | undefined | null, length = 100) {
  if (!code) return code;
  if (code.length < length * 2) return code;

  return code.slice(0, length) + '...' + code.slice(-length);
}
