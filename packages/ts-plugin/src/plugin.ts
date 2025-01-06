/**
 * Try to transform code before tsserver runs, using `info.languageServiceHost.getScriptSnapshot`
 * touch.
 */

import type {
  CompletionInfo,
  DefinitionInfo,
  Diagnostic,
  DiagnosticWithLocation,
  DocumentHighlights,
  FormatCodeSettings,
  GetCompletionsAtPositionOptions,
  IScriptSnapshot,
  LanguageService,
  QuickInfo,
  RenameInfo,
  RenameLocation,
  ResolvedModule,
  SignatureHelpItems,
  SignatureHelpItemsOptions,
  UserPreferences,
  WithMetadata,
} from 'typescript';
import { splitSegmentsWithPosition, type Segment } from 'core';
import {
  buildPrint,
  proxy_languageServiceHost,
  serializeDiagnostic,
  tryStringify,
} from './helpers.js';
import { buildObjectProxy, replace } from './utils.js';
import { createModuleNameSerializer_query } from './moduleName_serializers.js';
import type { NotUndefined } from './types.js';

type TS = typeof import('typescript/lib/tsserverlibrary');

//const PREFIX = 'virtual:';
const PREFIX = 'infile:';

let _print = buildPrint();

type Logger = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
};

export function init({ typescript: ts }: { typescript: TS }) {
  const moduleNameSerializer = createModuleNameSerializer_query(ts);
  //const moduleNameSerializer = createSerializer_hash(ts);
  //const moduleNameSerializer = createSerializer_base64(ts);
  const { encodeVirtualModuleFilename, decodeVirtualModuleFilename } =
    createVirtualModuleFilenameEncoder(moduleNameSerializer);

  const virtualFiles = new Set<string>();

  function create(info: ts.server.PluginCreateInfo) {
    const logger = info.project.projectService.logger;

    _print = buildPrint(`[${info.config.name}]`);
    _print(
      '🚀 ~ file: plugin.ts:22 ~ create ~ info:',
      JSON.stringify(Object.keys(info)),
    );
    //const _debug = buildPrint(`[${info.config.name}] DEBUG`);

    const _info = (...args: unknown[]) => {
      const content = args.map((x) => tryStringify(x)).join(' ');
      logger.info(content);
    };
    const _debug = (...args: unknown[]) => {
      if (logger.hasLevel(ts.server.LogLevel.verbose)) {
        const content = args.map((x) => tryStringify(x)).join(' ');
        console.log('DEBUG', content);
      }
    };

    // states (managed per file)
    const [
      __segmentEntriesMap,
      {
        saveSegmentsForFile,
        loadSegmentsForFile,
        getSegmentFromFile,
        findSegmentWithIndexFromPos,
      },
    ] = createSegmentManager({ logger: { info: _info, debug: _debug } });

    function findSegmentWithVirtualFilename(
      fileName: string,
      position: number,
    ) {
      const [segment, segmentIndex] = findSegmentWithIndexFromPos(
        fileName,
        position,
      );
      if (!segment?.name) return null;

      // ... and its corresponding virtual filename
      const virtualFilename = encodeVirtualModuleFilename(
        segment.name,
        fileName,
      );

      return [virtualFilename, segment, segmentIndex] as const;
    }

    //

    const _serviceHost = info.languageServiceHost;
    const serviceHostProxy = proxy_languageServiceHost(_serviceHost);

    // override resolveModuleNames
    serviceHostProxy.resolveModuleNames = (
      moduleNames,
      containingFile,
      reusedNames,
      redirectedReference,
      options,
    ): (ResolvedModule | undefined)[] => {
      const _resolvedModules =
        _serviceHost.resolveModuleNames?.(
          moduleNames,
          containingFile,
          reusedNames,
          redirectedReference,
          options,
        ) ??
        moduleNames.map(
          (moduleName) =>
            ts.resolveModuleName(moduleName, containingFile, options, ts.sys)
              .resolvedModule,
        );

      if (containingFile.includes('/node_modules/')) return _resolvedModules;
      if (containingFile.includes('/.svelte-kit/')) return _resolvedModules;
      // svelte specific: like 'svelte/elements'
      if (containingFile.startsWith('svelte/')) return _resolvedModules;

      if (!containingFile.endsWith('.svelte')) return _resolvedModules;

      _print(
        '🚀 ~ file: plugin.ts:137 ~ resolveModuleNames:',
        JSON.stringify(containingFile.split('/').at(-1)),
        _resolvedModules,
        {
          moduleNames,
          containingFile,
          reusedNames,
          redirectedReference,
          //options,
        },
      );

      const customResolvedModules = moduleNames.map(_customResolveModule);

      /** Convert 'infile:module' to '/virtual-resolved-path/${serializedModuleName}' */
      function _customResolveModule(moduleName: string) {
        if (!moduleName.startsWith(PREFIX)) {
          return undefined;
        }

        //const innerModuleName = moduleName.slice(PREFIX.length);
        //const resolvedFileName = `/virtual-resolved-path/${serializeModuleName(containingFile, innerModuleName)}`;

        const resolvedFileName = encodeVirtualModuleFilename(
          moduleName,
          containingFile,
        );

        //const extension = ts.Extension.Js;
        const extension = ts.Extension.Ts;
        //const extension = '.svelte';

        _debug(
          '** converting:',
          moduleName,
          '=>',
          { resolvedFileName, extension },
          { moduleName },
        );

        return { resolvedFileName, extension };
      }

      _print(
        '🚀 ~ file: plugin.ts:180 ~ customResolvedModules ~ customResolvedModules:',
        {
          customResolvedModules,
          _resolvedModules,
          result: customResolvedModules.map(
            (customModule, i) => customModule ?? _resolvedModules?.[i],
          ),
        },
      );

      return customResolvedModules.map(
        (customModule, i) => customModule ?? _resolvedModules?.[i],
      );
    };

    // override getScriptSnapshot
    serviceHostProxy.getScriptSnapshot = (
      filename: string,
    ): IScriptSnapshot | undefined => {
      const priorSnapshot = _serviceHost.getScriptSnapshot(filename);

      // skip node_modules
      if (filename.includes('/node_modules/')) return priorSnapshot;
      if (filename.includes('/.svelte-kit/')) return priorSnapshot;
      //if (!filename.endsWith('.svelte')) return priorSnapshot;

      console.log(
        '🚀 ~ file: plugin.ts:212 ~ getScriptSnapshot:',
        JSON.stringify(filename.split('/').slice(-3).join('/')),
        tryStringify({
          filename,
          priorSnapshot,
          isVirtualModuleFilename: checkIsVirtualModuleFilename(filename),
        }),
      );

      // is a virtual module
      if (checkIsVirtualModuleFilename(filename)) {
        //let [origFilepath, segmentName] = split( filename.slice('/virtual-resolved-path/'.length), ':', 2,);

        //let [segmentName, origFilepath] = deserializeModuleName(filename.slice('/virtual-resolved-path/'.length));
        //if (segmentName.endsWith('.js')) {
        //  segmentName = segmentName.slice(0, -3);
        //}
        const [segmentName, origFilepath] =
          decodeVirtualModuleFilename(filename);

        const [segments] = loadSegmentsForFile(origFilepath) ?? [];
        if (!segments) {
          console.warn(
            'WARN could not find matching segments for filepath:',
            origFilepath,
            tryStringify({
              filename,
              segmentEntryKeys: [...__segmentEntriesMap.keys()],
            }),
          );
          return;
        }
        const segmentIndex = segments.findIndex(
          ({ name }) => name === segmentName,
        );
        const targetSegment = segments[segmentIndex];
        if (!targetSegment) {
          console.warn(
            'WARN could not find matching target segment for:',
            filename,
          );
          return;
        }

        //console.log('🚀 ~ file: plugin.ts:178 ~ getScriptSnapshot ~ segment:', JSON.stringify(filename), tryStringify({ origFilepath, targetSegment, segmentName, segmentIndex, segments, }),);

        // preemptively register ScriptInfo
        const _scriptInfo =
          info.project.projectService.getOrCreateScriptInfoForNormalizedPath(
            ts.server.toNormalizedPath(filename),
            true,
            targetSegment.text,
          );
        //console.log('🚀 ~ file: plugin.ts:195 ~ getScriptSnapshot ~ scriptInfo:', JSON.stringify(filename), tryStringify(scriptInfo, { depth: 2 }),);
        //
        virtualFiles.add(filename);

        //const text = ts.sys.readFile(filename);

        //const text = targetSegment.text;
        const text = transformSegmentText(segments, segmentIndex);

        return {
          getText: (start, end) => text.slice(start, end),
          getLength: () => text.length,
          getChangeRange: (_old) => undefined,
        } satisfies IScriptSnapshot;
      }
      //
      else if (priorSnapshot) {
        const originalText = priorSnapshot.getText(
          0,
          priorSnapshot.getLength(),
        );

        // TODO: check if it contains a segment

        // save segments
        const [main, segments] = splitSegmentsWithPosition(originalText);
        const hasSegments = segments.length > 1;
        console.log(
          '🚀 ~ file: plugin.ts:293 ~ getScriptSnapshot ~ hasSegments:',
          JSON.stringify(filename.split('/').slice(-3).join('/')),
          hasSegments,
          JSON.stringify(originalText),
          tryStringify({ main, segments }),
        );

        // has no other segments
        if (!hasSegments) return priorSnapshot;

        _print(
          '🚀 ~ file: plugin.ts:282 ~ getScriptsnapshot: saving segments',
          JSON.stringify(filename),
          { main, segments },
        );
        saveSegmentsForFile(filename, segments);

        //const transformedText = transformMainText(originalText, main);
        const transformedText = transformSegmentText(segments, 0, originalText);

        //_print('🚀 ~ file: plugin.ts:233 ~ create ~ transformedText:', JSON.stringify(transformedText), { segments, originalText },);

        //return ts.ScriptSnapshot.fromString(transformedText);
        return {
          getText: (start, end) => transformedText.slice(start, end),
          getLength: () => transformedText.length,
          getChangeRange: () => undefined,
        } satisfies IScriptSnapshot;
      }

      function transformSegmentText(
        segments: Segment[],
        segmentIndex: number,
        fileContent?: string,
      ) {
        fileContent = fileContent ?? segments.map(({ text }) => text).join('');

        const thisSegment = segments[segmentIndex];
        const segmentText =
          thisSegment.header.replace(/./g, ' ') + thisSegment.text;

        const segmentPrevText = fileContent.slice(0, thisSegment.start);
        const segmentPostText = fileContent.slice(thisSegment.end);

        //console.log('🚀 ~ file: plugin.ts:307 ~ getScriptSnapshot ~ transformSegmentText:', JSON.stringify(filename), `#${segmentIndex}:${thisSegment.name}`, tryStringify({ segmentPrevText, segmentText, segmentPostText, segments, thisSegment, result: segmentPrevText.replace(/./g, ' ') + segmentText + segmentPostText.replace(/./g, ' '), }),);

        return (
          segmentPrevText.replace(/./g, ' ') +
          segmentText +
          segmentPostText.replace(/./g, ' ')
        );
      }
    };

    //// override readFile
    //// readFile is typically called to read config files.
    //serviceHostProxy.readFile = (fileName) => {
    //  let fileContent = _serviceHost.readFile(fileName);
    //  //console.log('🚀 ~ file: plugin.ts:124 ~ readFile ~ fileName:', JSON.stringify(fileName), '\n' + JSON.stringify(fileContent));
    //  //if (fileContent && fileName.endsWith('.ts')) {
    //  //  fileContent = fileContent.replace(/console\.log/g, 'customLog'); // Example transformation
    //  //}
    //  return fileContent;
    //};

    // Create a new language service using the proxied host
    const _langService = ts.createLanguageService(serviceHostProxy);

    // decorator object
    const serviceProxy = buildObjectProxy(_langService);

    // log methods
    for (const _key of Object.keys(serviceProxy)) {
      const key = _key as keyof typeof serviceProxy;
      const _frequentMethodNames = [
        'getProgram',
        'getCurrentProgram',
        'getApplicableRefactors',
      ];
      if (!_frequentMethodNames.includes(key)) {
        serviceProxy[key] = (...args: unknown[]) => {
          const result = (_langService[key] as any)(...args);

          console.log(
            `🚀 ~ file: plugin.ts:: ~ ${_key}:`,
            ...(_frequentMethodNames.includes(key)
              ? []
              : [tryStringify(result), tryStringify({ args })]),
          );
          return result;
        };
      }
    }

    //
    // Diagnostics

    serviceProxy.getSyntacticDiagnostics = (filename) => {
      const result = _langService.getSyntacticDiagnostics(filename);
      console.log(
        '🚀 ~ file: plugin.ts:150 ~ getSyntacticDiagnostics ~ result:',
        tryStringify(result),
      );
      return result;
    };

    serviceProxy.getSemanticDiagnostics = (filename): Diagnostic[] => {
      const result = _langService.getSemanticDiagnostics(filename);
      console.log(
        '🚀 ~ file: plugin.ts:350 ~ getSemanticDiagnostics ~ result:',
        JSON.stringify(filename),
        tryStringify(result.map(serializeDiagnostic)),
      );

      // TODO: manually append parse results for other segments

      const [segments] = loadSegmentsForFile(filename) ?? [];
      for (const segment of segments ?? []) {
        if (!segment.name) continue; // skip main segment

        const encodedFilename = encodeVirtualModuleFilename(
          `${PREFIX}${segment.name}`,
          filename,
        );
        const segmentDiagEntries =
          serviceProxy.getSemanticDiagnostics(encodedFilename);

        console.log(
          '🚀 ~ file: plugin.ts:371 ~ create ~ segmentDiagEntries:',
          JSON.stringify(encodedFilename),
          JSON.stringify(segment.name),
          tryStringify({
            filename,
            diagEntries: segmentDiagEntries.map(serializeDiagnostic),
            //segment
          }),
        );

        result.push(...segmentDiagEntries);
      }

      //_serviceHost.
      //ts.createSemanticDiagnosticsBuilderProgram();
      //ts.getPreEmitDiagnostics;
      const program = info.languageService.getProgram();
      program?.getSemanticDiagnostics;

      return result;
    };

    serviceProxy.getSuggestionDiagnostics = (
      fileName: string,
    ): DiagnosticWithLocation[] => {
      let priorDiagEntries = _langService.getSuggestionDiagnostics(fileName);
      console.log(
        '🚀 ~ file: plugin.ts:764 ~ getSuggestionDiagnostics:',
        tryStringify(priorDiagEntries.map(serializeDiagnostic), { depth: 4 }),
        tryStringify({ fileName }),
      );

      //if (!prior) {
      //  // TODO: check if this file has segments at all

      //  const [segment] = findSegmentWithIndexFromPos(fileName, position);
      //  if (!segment?.name) return prior;
      //  const virtualFilename = encodeVirtualModuleFilename(
      //    segment.name,
      //    fileName,
      //  );

      //  // apply to the segment

      //  let compInfo = _langService.getSuggestionDiagnostics(
      //    virtualFilename,
      //    position,
      //    options,
      //    formattingSettings,
      //  );

      //  // adjust fileName for and references
      //  if (compInfo) {
      //    const origFilename = decodeVirtualModuleFilename(virtualFilename)[1];
      //    //compInfo = compInfo.map((loc) => {
      //    //  return replace(loc, 'fileName', origFilename);
      //    //});
      //  }

      //  console.log(
      //    '🚀 ~ file: plugin.ts:803 ~ getSuggestionDiagnostics ~ compInfo:',
      //    JSON.stringify(virtualFilename),
      //    tryStringify(compInfo, { depth: 4 }),
      //    tryStringify({ virtualFilename, segment }),
      //  );

      //  return compInfo;
      //}

      return priorDiagEntries;
    };

    //
    //serviceProxy.getQuickInfoAtPosition = (fileName: string, position: number): QuickInfo | undefined => {
    //  const prior = _langService.getQuickInfoAtPosition(fileName, position);
    //  console.log('🚀 ~ file: plugin.ts:409 ~ create ~ prior:', tryStringify(prior), tryStringify({ fileName, position }));
    //  return prior;
    //};

    //
    serviceProxy.getDefinitionAndBoundSpan = (fileName, position) => {
      // TODO: ts may not be seeing the hidden text. we need to restore the text by segments,
      // and remap filename & position.

      const [segment, segmentIndex] = findSegmentWithIndexFromPos(
        fileName,
        position,
      );
      if (!segment) {
        console.warn('WARN cannot find segment');
        return;
      }

      let prior: ts.DefinitionInfoAndBoundSpan | undefined;

      // one of non-main segments
      if (segment.name) {
        const resolvedFileName = encodeVirtualModuleFilename(
          segment.name,
          fileName,
        );

        // remap filename and position

        const newDefInfo = _langService.getDefinitionAndBoundSpan(
          resolvedFileName,
          position,
        );
        if (newDefInfo?.definitions) {
          newDefInfo.definitions = newDefInfo?.definitions?.map((defEntry) => ({
            ...defEntry,
            //fileName,
            unverified: false,
          }));
        }

        console.log(
          '🚀 ~ file: plugin.ts:365 ~ getDefinitionAndBoundSpan ~ resolvedFileName:',
          JSON.stringify(resolvedFileName),
          tryStringify(
            {
              newDefInfo,
              prior,
            },
            { depth: 4 },
          ),
          tryStringify({
            fileName,
            position,
            segmentName: segment.name,
          }),
        );

        prior = newDefInfo;
      }
      // main segment
      else {
        prior = _langService.getDefinitionAndBoundSpan(fileName, position);
      }

      console.log(
        '🚀 ~ file: plugin.ts:379 ~ getDefinitionAndBoundSpan ~ prior:',
        tryStringify(prior, { depth: 4 }),
        tryStringify({ fileName, position, segment, segmentIndex }),
      );

      if (!prior?.definitions) return prior;

      //return prior; // XXX

      prior.definitions = prior.definitions.map(mapDefinitionEntry);

      /*
       * {
       *   fileName: '/virtual-resolved-path/misc?from=%2FUsers%2Fjangxyz%2Fplay%2Fsvelte-innerfile-components%2Fjavascript-innerfile-module%2Fexamples%2Ftypescript-plugin-example%2Fsamples%2Fcode2-2.js',
       *   textSpan: { start: 35, length: 8 },
       *   kind: 'function',
       *   name: 'getValue',
       *   containerKind: undefined,
       *   containerName: '"/virtual-resolved-path/misc?from=%2FUsers%2Fjangxyz%2Fplay%2Fsvelte-innerfile-components%2Fjavascript-innerfile-module%2Fexamples%2Ftypescript-plugin-example%2Fsamples%2Fcode2-2"',
       *   contextSpan: { start: 19, length: 43 },
       *   isLocal: false,
       *   isAmbient: false,
       *   unverified: false,
       *   failedAliasResolution: undefined
       * }
       */
      function mapDefinitionEntry(defEntry: DefinitionInfo) {
        if (!checkIsVirtualModuleFilename(defEntry.fileName)) return defEntry;

        // adjust filename and textSpan

        const [segmentName, originalFilepath] = decodeVirtualModuleFilename(
          defEntry.fileName,
        );
        const segment = getSegmentFromFile(originalFilepath, segmentName);
        if (!segment) {
          // prettier-ignore
          console.error('ERROR failed finding segment:', JSON.stringify(segmentName), defEntry.fileName, tryStringify({ originalFilepath, defEntry, }),);
          return defEntry;
        }

        // TODO: flat vs hierarchical?

        defEntry.fileName = originalFilepath;
        //defEntry.textSpan.start += segment.start + segment.header.length;
        (defEntry as any).failedAliasResolution = false;

        //defEntry.fileName = originalFilepath;
        //defEntry.textSpan = { start: 336, length: 8 };
        //(defEntry as any).failedAliasResolution = false;

        // TODO: adjust container name & span

        //findSegmentWithIndexFromPos
        defEntry.containerName = JSON.stringify(
          defEntry.fileName.replace(/[.]js$/, ''),
        ); // ???
        defEntry.contextSpan = { ...defEntry.textSpan };

        _print(
          '🚀 ~ file: plugin.ts:459 ~ getDefinitionAndBoundSpan ~ mapDefinitionEntry ~ defEntry:',
          defEntry,
          {
            segment,
            mainSegment: getSegmentFromFile(originalFilepath, undefined),
          },
        );

        return defEntry;
      }

      return prior;
    };

    //
    serviceProxy.findReferences = (fileName, position) => {
      const priorRefSymbols = _langService.findReferences(fileName, position);
      console.log(
        '🚀 ~ file: plugin.ts:529 ~ findReferences:',
        tryStringify(priorRefSymbols, { depth: 4 }),
        tryStringify({
          fileName,
          position,
        }),
      );

      if (!priorRefSymbols) {
        // TODO: check if this file has segments at all

        const [segment] = findSegmentWithIndexFromPos(fileName, position);
        if (!segment?.name) return priorRefSymbols;

        const virtualFilename = encodeVirtualModuleFilename(
          segment.name,
          fileName,
        );
        let refSymbols = _langService.findReferences(virtualFilename, position);

        // adjust fileName for and references
        if (refSymbols) {
          const origFilename = decodeVirtualModuleFilename(virtualFilename)[1];
          refSymbols = refSymbols.map((refSym) => {
            refSym.definition.fileName = origFilename;
            refSym.references.map((ref) => {
              ref.fileName = origFilename;
              return ref;
            });
            return refSym;
          });
        }

        console.log(
          '🚀 ~ file: plugin.ts:561 ~ create ~ ref:',
          JSON.stringify(virtualFilename),
          tryStringify(refSymbols, { depth: 4 }),
          tryStringify({
            virtualFilename,
            segment,
          }),
        );

        return refSymbols;
      }

      return priorRefSymbols;
    };

    //
    // rename

    serviceProxy.getRenameInfo = (
      fileName: string,
      position: number,
      preferences: UserPreferences,
    ): RenameInfo => {
      const prior = _langService.getRenameInfo(fileName, position, preferences);
      console.log(
        '🚀 ~ file: plugin.ts:624 ~ getRenameInfo:',
        tryStringify(prior, { depth: 4 }),
        tryStringify({
          fileName,
          position,
        }),
      );

      if (!prior.canRename) {
        // TODO: check if this file has segments at all

        const [segment] = findSegmentWithIndexFromPos(fileName, position);
        if (!segment?.name) return prior;
        const virtualFilename = encodeVirtualModuleFilename(
          segment.name,
          fileName,
        );

        let renameInfo = _langService.getRenameInfo(
          virtualFilename,
          position,
          preferences,
        );

        // adjust fileName for and references
        if (renameInfo) {
          const origFilename = decodeVirtualModuleFilename(virtualFilename)[1];
          //renameInfo = renameInfo.map((refSym) => {
          //  refSym.definition.fileName = origFilename;
          //  refSym.references.map((ref) => {
          //    ref.fileName = origFilename;
          //    return ref;
          //  });
          //  return refSym;
          //});
        }

        console.log(
          '🚀 ~ file: plugin.ts:663 ~ getRenameInfo ~ renameInfo:',
          JSON.stringify(virtualFilename),
          tryStringify(renameInfo, { depth: 4 }),
          tryStringify({ virtualFilename, segment }),
        );

        return renameInfo;
      }

      return prior;
    };

    serviceProxy.findRenameLocations = (
      fileName: string,
      position: number,
      findInStrings: boolean,
      findInComments: boolean,
      providePrefixAndSuffixTextForRename?: boolean,
    ): readonly RenameLocation[] | undefined => {
      const prior = _langService.findRenameLocations(
        fileName,
        position,
        findInStrings,
        findInComments,
        providePrefixAndSuffixTextForRename,
      );
      console.log(
        '🚀 ~ file: plugin.ts:680 ~ findRenameLocations:',
        tryStringify(prior, { depth: 4 }),
        tryStringify({
          fileName,
          position,
          findInStrings,
          findInComments,
        }),
      );

      if (!prior) {
        // TODO: check if this file has segments at all

        const [segment] = findSegmentWithIndexFromPos(fileName, position);
        if (!segment?.name) return prior;
        const virtualFilename = encodeVirtualModuleFilename(
          segment.name,
          fileName,
        );

        // apply to the segment

        let renameLocs = _langService.findRenameLocations(
          virtualFilename,
          position,
          findInStrings,
          findInComments,
          providePrefixAndSuffixTextForRename,
        );

        // adjust fileName for and references
        if (renameLocs) {
          const origFilename = decodeVirtualModuleFilename(virtualFilename)[1];
          renameLocs = renameLocs.map((loc) =>
            replace(loc, 'fileName', origFilename),
          );
        }

        console.log(
          '🚀 ~ file: plugin.ts:663 ~ getRenameInfo ~ renameInfo:',
          JSON.stringify(virtualFilename),
          tryStringify(renameLocs, { depth: 4 }),
          tryStringify({ virtualFilename, segment }),
        );

        return renameLocs;
      }

      return prior;
    };

    //
    // Completion

    serviceProxy.getDocumentHighlights = (
      fileName: string,
      position: number,
      filesToSearch: string[],
    ): DocumentHighlights[] | undefined => {
      let prior = _langService.getDocumentHighlights(
        fileName,
        position,
        filesToSearch,
      );
      console.log(
        '🚀 ~ file: plugin.ts:748 ~ getDocumentHighlights ~ prior:',
        tryStringify(prior, { depth: 4 }),
        tryStringify({
          fileName,
          position,
          filesToSearch,
        }),
      );

      if (!prior) {
        const [segment] = findSegmentWithIndexFromPos(fileName, position);
        if (!segment?.name) return prior;
        const segmentName = segment.name;

        const virtualFilename = encodeVirtualModuleFilename(
          segmentName,
          fileName,
        );
        const filesToSearchVirtual = filesToSearch.map((filename) =>
          encodeVirtualModuleFilename(segmentName, filename),
        );

        // apply to the segment

        let newHighlights = _langService.getDocumentHighlights(
          virtualFilename,
          position,
          filesToSearchVirtual,
        );

        //console.log('🚀 ~ file: plugin.ts:773 ~ getDocumentHighlights ~ newHighlights:', JSON.stringify(virtualFilename), tryStringify(newHighlights, { depth: 4 }), tryStringify({ virtualFilename, segment }));

        if (newHighlights) {
          const origFilename = decodeVirtualModuleFilename(virtualFilename)[1];
          newHighlights = newHighlights.map((highlight) =>
            replace(highlight, 'fileName', origFilename),
          );
          return newHighlights;
        }
      }

      return prior;
    };

    serviceProxy.getCompletionsAtPosition = (
      fileName: string,
      position: number,
      options: GetCompletionsAtPositionOptions | undefined,
      formattingSettings?: FormatCodeSettings,
    ): WithMetadata<CompletionInfo> | undefined => {
      let prior = _langService.getCompletionsAtPosition(
        fileName,
        position,
        options,
        formattingSettings,
      );
      console.log(
        '🚀 ~ file: plugin.ts:826 ~ getCompletionsAtPosition:',
        tryStringify(prior, { depth: 4 }),
        tryStringify({
          fileName,
          position,
          options,
          formattingSettings,
        }),
      );

      if (!prior) {
        // TODO: check if this file has segments at all

        const [segment] = findSegmentWithIndexFromPos(fileName, position);
        if (!segment?.name) return prior;
        const virtualFilename = encodeVirtualModuleFilename(
          segment.name,
          fileName,
        );

        // apply to the segment

        let compInfo = _langService.getCompletionsAtPosition(
          virtualFilename,
          position,
          options,
          formattingSettings,
        );

        // adjust fileName for and references
        if (compInfo) {
          const origFilename = decodeVirtualModuleFilename(virtualFilename)[1];
          //compInfo = compInfo.map((loc) => {
          //  return replace(loc, 'fileName', origFilename);
          //});

          // TODO: implement me
        }

        console.log(
          '🚀 ~ file: plugin.ts:893 ~ getCompletionsAtPosition ~ compInfo:',
          JSON.stringify(virtualFilename),
          tryStringify(compInfo, { depth: 4 }),
          tryStringify({ virtualFilename, segment }),
        );

        return compInfo;
      }

      return prior;
    };
    serviceProxy.getCompletionEntryDetails;

    serviceProxy.getQuickInfoAtPosition = wrapLangServiceMethod(
      _langService.getQuickInfoAtPosition,
      (
        method: (
          fileName: string,
          position: number,
        ) => ts.QuickInfo | undefined,
        [fileName, position],
        prior,
      ): QuickInfo | undefined => {
        if (prior !== undefined) return prior;

        const [virtualFilename, _segment, _segmentIndex] =
          findSegmentWithVirtualFilename(fileName, position) ?? [];
        let newValue = method(virtualFilename!, position);
        console.log(
          '🚀 ~ file: plugin.ts:972 ~ getQuickInfoAtPosition ~ newValue:',
          tryStringify(newValue),
          tryStringify({ fileName, virtualFilename, position }),
        );

        return newValue;
      },
    );

    serviceProxy.getSignatureHelpItems = (
      fileName: string,
      position: number,
      options: SignatureHelpItemsOptions | undefined,
    ): SignatureHelpItems | undefined => {
      let prior = _langService.getSignatureHelpItems(
        fileName,
        position,
        options,
      );
      console.log(
        '🚀 ~ file: plugin.ts:828 ~ getSignatureHelpItems:',
        tryStringify(prior, { depth: 4 }),
        tryStringify({
          fileName,
          position,
          options,
        }),
      );

      if (!prior) {
        // TODO: check if this file has segments at all

        const [segment] = findSegmentWithIndexFromPos(fileName, position);
        if (!segment?.name) return prior;
        const virtualFilename = encodeVirtualModuleFilename(
          segment.name,
          fileName,
        );

        // apply to the segment

        let helpItems = _langService.getSignatureHelpItems(
          virtualFilename,
          position,
          options,
        );

        // adjust fileName for and references
        if (helpItems) {
          const origFilename = decodeVirtualModuleFilename(virtualFilename)[1];
          //compInfo = compInfo.map((loc) => {
          //  return replace(loc, 'fileName', origFilename);
          //});
        }

        console.log(
          '🚀 ~ file: plugin.ts:864 ~ getSignatureHelpItems ~ helpItems:',
          JSON.stringify(virtualFilename),
          tryStringify(helpItems, { depth: 4 }),
          tryStringify({ virtualFilename, segment }),
        );

        return helpItems;
      }

      return prior;
    };

    //serviceProxy.toggleLineComment = (...args) => {
    //  const result = _langService.toggleLineComment(...args);
    //  //_print('🚀 ~ file: plugin.ts:539 ~ toggleLineComment ~ result:', result, { args });
    //  return result;
    //};
    //serviceProxy.toggleMultilineComment = (...args) => {
    //  const result = _langService.toggleMultilineComment(...args);
    //  //_print('🚀 ~ file: plugin.ts:544 ~ toggleMultilineComment ~ result:', result, { args },);
    //  return result;
    //};
    //serviceProxy.commentSelection = (...args) => {
    //  return returning(serviceProxy.commentSelection(...args), (result) => {
    //    _print('🚀 ~ file: plugin.ts:550 ~ commentSelection ~ result:', result, { args },;
    //  });
    //};

    //serviceProxy.getOutliningSpans = (fileName: string) => {
    //  return returning(serviceProxy.getOutliningSpans(fileName), (result) => {
    //    _print('🚀 ~ file: plugin.ts:974 ~ getOutliningSpans ~ result:', result, { fileName });
    //  });
    //};

    return serviceProxy;
  }

  // NOTE this method has been obsolete
  //function getExternalFiles(project: unknown) {
  //  console.log('🚀 ~ file: plugin.ts:477 ~ getExternalFiles ~ info:', tryStringify({ virtualFilesArray: [...virtualFiles] }));
  //  return [...virtualFiles];
  //}

  return {
    create,
    //getExternalFiles,
  };
}

function transformCode(sourceText: string, fileName: string) {
  console.log(
    '🚀 ~ file: plugin.ts:493 ~ transformCode ~ fileName:',
    fileName,
    '\n----------\n' + sourceText + '\n----------\n',
  );

  // check if separator exists
  const matchData = sourceText.match(/^---\nname=.*/m);
  if (!matchData) return sourceText;
  if (matchData.index === undefined) return sourceText;

  // replace separators to blank code
  const length = matchData[0].length;
  return (
    sourceText.slice(0, matchData.index) +
    ' '.repeat(length) +
    sourceText.slice(matchData.index + length)
  );
}

function createSegmentManager({ logger: { debug, info } }: { logger: Logger }) {
  const segmentEntriesMap = new Map<string, Segment[]>();

  function saveSegmentsForFile(filename: string, segments: Segment[]) {
    segmentEntriesMap.set(filename, segments);
  }

  function loadSegmentsForFile(
    filename: string | ((key: string) => boolean),
  ): readonly [segments: Segment[] | null, filename?: string] | null {
    if (typeof filename === 'string') {
      return [segmentEntriesMap.get(filename) ?? null] as const;
    } else {
      for (const key of segmentEntriesMap.keys()) {
        if (filename(key)) {
          return [segmentEntriesMap.get(key)!, key] as const;
        }
      }
      return null;
    }
  }

  function getSegmentFromFile(
    filename: string | ((key: string) => boolean),
    segmentName?: string,
  ) {
    const segments = loadSegmentsForFile(filename)?.[0];
    return segments?.find(({ name }) => name === segmentName) ?? null;
  }

  /**
   * @returns [segment, index] if found, [null, -1] if not
   */
  function findSegmentWithIndexFromPos(
    filename: string,
    pos: number,
  ):
    | readonly [segment: Segment, segmentIndex: number]
    | readonly [segment: null, segmentIndex: -1] {
    const segmentEntries = segmentEntriesMap.get(filename);
    if (!segmentEntries) return [null, -1];

    for (let i = 0; i < segmentEntries.length; i += 1) {
      const segment = segmentEntries[i];
      if (segment.start <= pos && pos < segment.end) {
        return [segment, i as number] as const;
      }
    }
    // segment not found
    return [null, -1] as const;
  }

  function getOtherSegments(filename: string, index: number) {
    const otherSegments: Segment[] = [];

    const segmentEntries = segmentEntriesMap.get(filename)!;
    for (let i = 0; i < segmentEntries.length; i += 1) {
      if (i === index) continue;
      otherSegments.push(segmentEntries[i]);
    }

    return otherSegments;
  }

  return [
    segmentEntriesMap,
    {
      saveSegmentsForFile,
      loadSegmentsForFile,
      findSegmentWithIndexFromPos,
      getOtherSegments,
      getSegmentFromFile,
    },
  ] as const;
}

function checkIsVirtualModuleFilename(filename: string) {
  return filename.startsWith('/virtual-resolved-path/');
}

function createVirtualModuleFilenameEncoder([
  serializeModuleName,
  deserializeModuleName,
]: readonly [
  serialize: (
    containingFile: string,
    moduleName: string,
  ) => ts.server.NormalizedPath,
  deserliaze: (
    resolvedName: string,
  ) => readonly [moduleName: string, containingFile: string],
]) {
  function encodeVirtualModuleFilename(
    moduleName: string,
    containingFile: string,
  ) {
    if (moduleName.startsWith(PREFIX)) {
      moduleName = moduleName.slice(PREFIX.length);
    }

    const resolvedFileName = `/virtual-resolved-path/${serializeModuleName(
      containingFile,
      moduleName,
    )}`;

    return resolvedFileName;
  }

  function decodeVirtualModuleFilename(
    filename: string,
    options = { recursive: true },
  ): [segmentName: string, originalFilepath: string] {
    let [segmentName, origFilepath] = deserializeModuleName(
      filename.slice('/virtual-resolved-path/'.length),
    );

    if (segmentName.endsWith('.js')) {
      segmentName = segmentName.slice(0, -3);
    }

    // NOTE or, we can do this on encode time.
    if (options.recursive && checkIsVirtualModuleFilename(origFilepath)) {
      return [
        segmentName,
        decodeVirtualModuleFilename(origFilepath, options)[1],
      ];
    }

    return [segmentName, origFilepath];
  }

  return {
    encodeVirtualModuleFilename,
    decodeVirtualModuleFilename,
  };
}

function wrapLangServiceMethod<
  K extends keyof LanguageService,
  F extends NotUndefined<LanguageService[K]>,
  A extends Parameters<F>,
  T extends ReturnType<F>,
>(method: F, callback: (method: F, args: A, prior: T) => T) {
  return function (...args: A) {
    let prior = (method as any)(...args) as T;
    console.log(
      `🚀 ~ file: plugin.ts:1226 ~ [${method.name}]:`,
      tryStringify(prior, { depth: 4 }),
      tryStringify(args),
    );
    return callback(method, args, prior);
  };
}
