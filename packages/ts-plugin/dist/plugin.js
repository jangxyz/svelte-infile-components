"use strict";
/**
 * Try to transform code before tsserver runs, using `info.languageServiceHost.getScriptSnapshot`
 * touch.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = void 0;
const core_1 = require("core");
const helpers_js_1 = require("./helpers.js");
const utils_js_1 = require("./utils.js");
const moduleName_serializers_js_1 = require("./moduleName_serializers.js");
//const PREFIX = 'virtual:';
const PREFIX = 'infile:';
let _print = (0, helpers_js_1.buildPrint)();
function init({ typescript: ts }) {
    const moduleNameSerializer = (0, moduleName_serializers_js_1.createModuleNameSerializer_query)(ts);
    //const moduleNameSerializer = createSerializer_hash(ts);
    //const moduleNameSerializer = createSerializer_base64(ts);
    const { encodeVirtualModuleFilename, decodeVirtualModuleFilename } = createVirtualModuleFilenameEncoder(moduleNameSerializer);
    const virtualFiles = new Set();
    function create(info) {
        const logger = info.project.projectService.logger;
        _print = (0, helpers_js_1.buildPrint)(`[${info.config.name}]`);
        _print('🚀 ~ file: plugin.ts:22 ~ create ~ info:', JSON.stringify(Object.keys(info)));
        //const _debug = buildPrint(`[${info.config.name}] DEBUG`);
        const _info = (...args) => {
            const content = args.map((x) => (0, helpers_js_1.tryStringify)(x)).join(' ');
            logger.info(content);
        };
        const _debug = (...args) => {
            if (logger.hasLevel(ts.server.LogLevel.verbose)) {
                const content = args.map((x) => (0, helpers_js_1.tryStringify)(x)).join(' ');
                console.log('DEBUG', content);
            }
        };
        // states (managed per file)
        const [__segmentEntriesMap, { saveSegmentsForFile, loadSegmentsForFile, getSegmentFromFile, findSegmentWithIndexFromPos, },] = createSegmentManager({ logger: { info: _info, debug: _debug } });
        function findSegmentWithVirtualFilename(fileName, position) {
            const [segment, segmentIndex] = findSegmentWithIndexFromPos(fileName, position);
            if (!(segment === null || segment === void 0 ? void 0 : segment.name))
                return null;
            // ... and its corresponding virtual filename
            const virtualFilename = encodeVirtualModuleFilename(segment.name, fileName);
            return [virtualFilename, segment, segmentIndex];
        }
        //
        const _serviceHost = info.languageServiceHost;
        const serviceHostProxy = (0, helpers_js_1.proxy_languageServiceHost)(_serviceHost);
        // override resolveModuleNames
        serviceHostProxy.resolveModuleNames = (moduleNames, containingFile, reusedNames, redirectedReference, options) => {
            var _a, _b;
            const _resolvedModules = (_b = (_a = _serviceHost.resolveModuleNames) === null || _a === void 0 ? void 0 : _a.call(_serviceHost, moduleNames, containingFile, reusedNames, redirectedReference, options)) !== null && _b !== void 0 ? _b : moduleNames.map((moduleName) => ts.resolveModuleName(moduleName, containingFile, options, ts.sys)
                .resolvedModule);
            if (containingFile.includes('/node_modules/'))
                return _resolvedModules;
            if (containingFile.includes('/.svelte-kit/'))
                return _resolvedModules;
            // svelte specific: like 'svelte/elements'
            if (containingFile.startsWith('svelte/'))
                return _resolvedModules;
            if (!containingFile.endsWith('.svelte'))
                return _resolvedModules;
            _print('🚀 ~ file: plugin.ts:137 ~ resolveModuleNames:', JSON.stringify(containingFile.split('/').at(-1)), _resolvedModules, {
                moduleNames,
                containingFile,
                reusedNames,
                redirectedReference,
                //options,
            });
            const customResolvedModules = moduleNames.map(_customResolveModule);
            /** Convert 'infile:module' to '/virtual-resolved-path/${serializedModuleName}' */
            function _customResolveModule(moduleName) {
                if (!moduleName.startsWith(PREFIX)) {
                    return undefined;
                }
                //const innerModuleName = moduleName.slice(PREFIX.length);
                //const resolvedFileName = `/virtual-resolved-path/${serializeModuleName(containingFile, innerModuleName)}`;
                const resolvedFileName = encodeVirtualModuleFilename(moduleName, containingFile);
                //const extension = ts.Extension.Js;
                const extension = ts.Extension.Ts;
                //const extension = '.svelte';
                _debug('** converting:', moduleName, '=>', { resolvedFileName, extension }, { moduleName });
                return { resolvedFileName, extension };
            }
            _print('🚀 ~ file: plugin.ts:180 ~ customResolvedModules ~ customResolvedModules:', {
                customResolvedModules,
                _resolvedModules,
                result: customResolvedModules.map((customModule, i) => customModule !== null && customModule !== void 0 ? customModule : _resolvedModules === null || _resolvedModules === void 0 ? void 0 : _resolvedModules[i]),
            });
            return customResolvedModules.map((customModule, i) => customModule !== null && customModule !== void 0 ? customModule : _resolvedModules === null || _resolvedModules === void 0 ? void 0 : _resolvedModules[i]);
        };
        // override getScriptSnapshot
        serviceHostProxy.getScriptSnapshot = (filename) => {
            var _a;
            const priorSnapshot = _serviceHost.getScriptSnapshot(filename);
            // skip node_modules
            if (filename.includes('/node_modules/'))
                return priorSnapshot;
            if (filename.includes('/.svelte-kit/'))
                return priorSnapshot;
            //if (!filename.endsWith('.svelte')) return priorSnapshot;
            console.log('🚀 ~ file: plugin.ts:212 ~ getScriptSnapshot:', JSON.stringify(filename.split('/').slice(-3).join('/')), (0, helpers_js_1.tryStringify)({
                filename,
                priorSnapshot,
                isVirtualModuleFilename: checkIsVirtualModuleFilename(filename),
            }));
            // is a virtual module
            if (checkIsVirtualModuleFilename(filename)) {
                //let [origFilepath, segmentName] = split( filename.slice('/virtual-resolved-path/'.length), ':', 2,);
                //let [segmentName, origFilepath] = deserializeModuleName(filename.slice('/virtual-resolved-path/'.length));
                //if (segmentName.endsWith('.js')) {
                //  segmentName = segmentName.slice(0, -3);
                //}
                const [segmentName, origFilepath] = decodeVirtualModuleFilename(filename);
                const [segments] = (_a = loadSegmentsForFile(origFilepath)) !== null && _a !== void 0 ? _a : [];
                if (!segments) {
                    console.warn('WARN could not find matching segments for filepath:', origFilepath, (0, helpers_js_1.tryStringify)({
                        filename,
                        segmentEntryKeys: [...__segmentEntriesMap.keys()],
                    }));
                    return;
                }
                const segmentIndex = segments.findIndex(({ name }) => name === segmentName);
                const targetSegment = segments[segmentIndex];
                if (!targetSegment) {
                    console.warn('WARN could not find matching target segment for:', filename);
                    return;
                }
                //console.log('🚀 ~ file: plugin.ts:178 ~ getScriptSnapshot ~ segment:', JSON.stringify(filename), tryStringify({ origFilepath, targetSegment, segmentName, segmentIndex, segments, }),);
                // preemptively register ScriptInfo
                const _scriptInfo = info.project.projectService.getOrCreateScriptInfoForNormalizedPath(ts.server.toNormalizedPath(filename), true, targetSegment.text);
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
                };
            }
            //
            else if (priorSnapshot) {
                const originalText = priorSnapshot.getText(0, priorSnapshot.getLength());
                // TODO: check if it contains a segment
                // save segments
                const [main, segments] = (0, core_1.splitSegmentsWithPosition)(originalText);
                const hasSegments = segments.length > 1;
                console.log('🚀 ~ file: plugin.ts:293 ~ getScriptSnapshot ~ hasSegments:', JSON.stringify(filename.split('/').slice(-3).join('/')), hasSegments, JSON.stringify(originalText), (0, helpers_js_1.tryStringify)({ main, segments }));
                // has no other segments
                if (!hasSegments)
                    return priorSnapshot;
                _print('🚀 ~ file: plugin.ts:282 ~ getScriptsnapshot: saving segments', JSON.stringify(filename), { main, segments });
                saveSegmentsForFile(filename, segments);
                //const transformedText = transformMainText(originalText, main);
                const transformedText = transformSegmentText(segments, 0, originalText);
                //_print('🚀 ~ file: plugin.ts:233 ~ create ~ transformedText:', JSON.stringify(transformedText), { segments, originalText },);
                //return ts.ScriptSnapshot.fromString(transformedText);
                return {
                    getText: (start, end) => transformedText.slice(start, end),
                    getLength: () => transformedText.length,
                    getChangeRange: () => undefined,
                };
            }
            function transformSegmentText(segments, segmentIndex, fileContent) {
                fileContent = fileContent !== null && fileContent !== void 0 ? fileContent : segments.map(({ text }) => text).join('');
                const thisSegment = segments[segmentIndex];
                const segmentText = thisSegment.header.replace(/./g, ' ') + thisSegment.text;
                const segmentPrevText = fileContent.slice(0, thisSegment.start);
                const segmentPostText = fileContent.slice(thisSegment.end);
                //console.log('🚀 ~ file: plugin.ts:307 ~ getScriptSnapshot ~ transformSegmentText:', JSON.stringify(filename), `#${segmentIndex}:${thisSegment.name}`, tryStringify({ segmentPrevText, segmentText, segmentPostText, segments, thisSegment, result: segmentPrevText.replace(/./g, ' ') + segmentText + segmentPostText.replace(/./g, ' '), }),);
                return (segmentPrevText.replace(/./g, ' ') +
                    segmentText +
                    segmentPostText.replace(/./g, ' '));
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
        const serviceProxy = (0, utils_js_1.buildObjectProxy)(_langService);
        // log methods
        for (const _key of Object.keys(serviceProxy)) {
            const key = _key;
            const _frequentMethodNames = [
                'getProgram',
                'getCurrentProgram',
                'getApplicableRefactors',
            ];
            if (!_frequentMethodNames.includes(key)) {
                serviceProxy[key] = (...args) => {
                    const result = _langService[key](...args);
                    console.log(`🚀 ~ file: plugin.ts:: ~ ${_key}:`, ...(_frequentMethodNames.includes(key)
                        ? []
                        : [(0, helpers_js_1.tryStringify)(result), (0, helpers_js_1.tryStringify)({ args })]));
                    return result;
                };
            }
        }
        //
        // Diagnostics
        serviceProxy.getSyntacticDiagnostics = (filename) => {
            const result = _langService.getSyntacticDiagnostics(filename);
            console.log('🚀 ~ file: plugin.ts:150 ~ getSyntacticDiagnostics ~ result:', (0, helpers_js_1.tryStringify)(result));
            return result;
        };
        serviceProxy.getSemanticDiagnostics = (filename) => {
            var _a;
            const result = _langService.getSemanticDiagnostics(filename);
            console.log('🚀 ~ file: plugin.ts:350 ~ getSemanticDiagnostics ~ result:', JSON.stringify(filename), (0, helpers_js_1.tryStringify)(result.map(helpers_js_1.serializeDiagnostic)));
            // TODO: manually append parse results for other segments
            const [segments] = (_a = loadSegmentsForFile(filename)) !== null && _a !== void 0 ? _a : [];
            for (const segment of segments !== null && segments !== void 0 ? segments : []) {
                if (!segment.name)
                    continue; // skip main segment
                const encodedFilename = encodeVirtualModuleFilename(`${PREFIX}${segment.name}`, filename);
                const segmentDiagEntries = serviceProxy.getSemanticDiagnostics(encodedFilename);
                console.log('🚀 ~ file: plugin.ts:371 ~ create ~ segmentDiagEntries:', JSON.stringify(encodedFilename), JSON.stringify(segment.name), (0, helpers_js_1.tryStringify)({
                    filename,
                    diagEntries: segmentDiagEntries.map(helpers_js_1.serializeDiagnostic),
                    //segment
                }));
                result.push(...segmentDiagEntries);
            }
            //_serviceHost.
            //ts.createSemanticDiagnosticsBuilderProgram();
            //ts.getPreEmitDiagnostics;
            const program = info.languageService.getProgram();
            program === null || program === void 0 ? void 0 : program.getSemanticDiagnostics;
            return result;
        };
        serviceProxy.getSuggestionDiagnostics = (fileName) => {
            let priorDiagEntries = _langService.getSuggestionDiagnostics(fileName);
            console.log('🚀 ~ file: plugin.ts:764 ~ getSuggestionDiagnostics:', (0, helpers_js_1.tryStringify)(priorDiagEntries.map(helpers_js_1.serializeDiagnostic), { depth: 4 }), (0, helpers_js_1.tryStringify)({ fileName }));
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
            var _a;
            const [segment, segmentIndex] = findSegmentWithIndexFromPos(fileName, position);
            if (!segment) {
                console.warn('WARN cannot find segment');
                return;
            }
            let prior;
            // one of non-main segments
            if (segment.name) {
                const resolvedFileName = encodeVirtualModuleFilename(segment.name, fileName);
                // remap filename and position
                const newDefInfo = _langService.getDefinitionAndBoundSpan(resolvedFileName, position);
                if (newDefInfo === null || newDefInfo === void 0 ? void 0 : newDefInfo.definitions) {
                    newDefInfo.definitions = (_a = newDefInfo === null || newDefInfo === void 0 ? void 0 : newDefInfo.definitions) === null || _a === void 0 ? void 0 : _a.map((defEntry) => ({
                        ...defEntry,
                        //fileName,
                        unverified: false,
                    }));
                }
                console.log('🚀 ~ file: plugin.ts:365 ~ getDefinitionAndBoundSpan ~ resolvedFileName:', JSON.stringify(resolvedFileName), (0, helpers_js_1.tryStringify)({
                    newDefInfo,
                    prior,
                }, { depth: 4 }), (0, helpers_js_1.tryStringify)({
                    fileName,
                    position,
                    segmentName: segment.name,
                }));
                prior = newDefInfo;
            }
            // main segment
            else {
                prior = _langService.getDefinitionAndBoundSpan(fileName, position);
            }
            console.log('🚀 ~ file: plugin.ts:379 ~ getDefinitionAndBoundSpan ~ prior:', (0, helpers_js_1.tryStringify)(prior, { depth: 4 }), (0, helpers_js_1.tryStringify)({ fileName, position, segment, segmentIndex }));
            if (!(prior === null || prior === void 0 ? void 0 : prior.definitions))
                return prior;
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
            function mapDefinitionEntry(defEntry) {
                if (!checkIsVirtualModuleFilename(defEntry.fileName))
                    return defEntry;
                // adjust filename and textSpan
                const [segmentName, originalFilepath] = decodeVirtualModuleFilename(defEntry.fileName);
                const segment = getSegmentFromFile(originalFilepath, segmentName);
                if (!segment) {
                    // prettier-ignore
                    console.error('ERROR failed finding segment:', JSON.stringify(segmentName), defEntry.fileName, (0, helpers_js_1.tryStringify)({ originalFilepath, defEntry, }));
                    return defEntry;
                }
                // TODO: flat vs hierarchical?
                defEntry.fileName = originalFilepath;
                //defEntry.textSpan.start += segment.start + segment.header.length;
                defEntry.failedAliasResolution = false;
                //defEntry.fileName = originalFilepath;
                //defEntry.textSpan = { start: 336, length: 8 };
                //(defEntry as any).failedAliasResolution = false;
                // TODO: adjust container name & span
                //findSegmentWithIndexFromPos
                defEntry.containerName = JSON.stringify(defEntry.fileName.replace(/[.]js$/, '')); // ???
                defEntry.contextSpan = { ...defEntry.textSpan };
                _print('🚀 ~ file: plugin.ts:459 ~ getDefinitionAndBoundSpan ~ mapDefinitionEntry ~ defEntry:', defEntry, {
                    segment,
                    mainSegment: getSegmentFromFile(originalFilepath, undefined),
                });
                return defEntry;
            }
            return prior;
        };
        //
        serviceProxy.findReferences = (fileName, position) => {
            const priorRefSymbols = _langService.findReferences(fileName, position);
            console.log('🚀 ~ file: plugin.ts:529 ~ findReferences:', (0, helpers_js_1.tryStringify)(priorRefSymbols, { depth: 4 }), (0, helpers_js_1.tryStringify)({
                fileName,
                position,
            }));
            if (!priorRefSymbols) {
                // TODO: check if this file has segments at all
                const [segment] = findSegmentWithIndexFromPos(fileName, position);
                if (!(segment === null || segment === void 0 ? void 0 : segment.name))
                    return priorRefSymbols;
                const virtualFilename = encodeVirtualModuleFilename(segment.name, fileName);
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
                console.log('🚀 ~ file: plugin.ts:561 ~ create ~ ref:', JSON.stringify(virtualFilename), (0, helpers_js_1.tryStringify)(refSymbols, { depth: 4 }), (0, helpers_js_1.tryStringify)({
                    virtualFilename,
                    segment,
                }));
                return refSymbols;
            }
            return priorRefSymbols;
        };
        //
        // rename
        serviceProxy.getRenameInfo = (fileName, position, preferences) => {
            const prior = _langService.getRenameInfo(fileName, position, preferences);
            console.log('🚀 ~ file: plugin.ts:624 ~ getRenameInfo:', (0, helpers_js_1.tryStringify)(prior, { depth: 4 }), (0, helpers_js_1.tryStringify)({
                fileName,
                position,
            }));
            if (!prior.canRename) {
                // TODO: check if this file has segments at all
                const [segment] = findSegmentWithIndexFromPos(fileName, position);
                if (!(segment === null || segment === void 0 ? void 0 : segment.name))
                    return prior;
                const virtualFilename = encodeVirtualModuleFilename(segment.name, fileName);
                let renameInfo = _langService.getRenameInfo(virtualFilename, position, preferences);
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
                console.log('🚀 ~ file: plugin.ts:663 ~ getRenameInfo ~ renameInfo:', JSON.stringify(virtualFilename), (0, helpers_js_1.tryStringify)(renameInfo, { depth: 4 }), (0, helpers_js_1.tryStringify)({ virtualFilename, segment }));
                return renameInfo;
            }
            return prior;
        };
        serviceProxy.findRenameLocations = (fileName, position, findInStrings, findInComments, providePrefixAndSuffixTextForRename) => {
            const prior = _langService.findRenameLocations(fileName, position, findInStrings, findInComments, providePrefixAndSuffixTextForRename);
            console.log('🚀 ~ file: plugin.ts:680 ~ findRenameLocations:', (0, helpers_js_1.tryStringify)(prior, { depth: 4 }), (0, helpers_js_1.tryStringify)({
                fileName,
                position,
                findInStrings,
                findInComments,
            }));
            if (!prior) {
                // TODO: check if this file has segments at all
                const [segment] = findSegmentWithIndexFromPos(fileName, position);
                if (!(segment === null || segment === void 0 ? void 0 : segment.name))
                    return prior;
                const virtualFilename = encodeVirtualModuleFilename(segment.name, fileName);
                // apply to the segment
                let renameLocs = _langService.findRenameLocations(virtualFilename, position, findInStrings, findInComments, providePrefixAndSuffixTextForRename);
                // adjust fileName for and references
                if (renameLocs) {
                    const origFilename = decodeVirtualModuleFilename(virtualFilename)[1];
                    renameLocs = renameLocs.map((loc) => (0, utils_js_1.replace)(loc, 'fileName', origFilename));
                }
                console.log('🚀 ~ file: plugin.ts:663 ~ getRenameInfo ~ renameInfo:', JSON.stringify(virtualFilename), (0, helpers_js_1.tryStringify)(renameLocs, { depth: 4 }), (0, helpers_js_1.tryStringify)({ virtualFilename, segment }));
                return renameLocs;
            }
            return prior;
        };
        //
        // Completion
        serviceProxy.getDocumentHighlights = (fileName, position, filesToSearch) => {
            let prior = _langService.getDocumentHighlights(fileName, position, filesToSearch);
            console.log('🚀 ~ file: plugin.ts:748 ~ getDocumentHighlights ~ prior:', (0, helpers_js_1.tryStringify)(prior, { depth: 4 }), (0, helpers_js_1.tryStringify)({
                fileName,
                position,
                filesToSearch,
            }));
            if (!prior) {
                const [segment] = findSegmentWithIndexFromPos(fileName, position);
                if (!(segment === null || segment === void 0 ? void 0 : segment.name))
                    return prior;
                const segmentName = segment.name;
                const virtualFilename = encodeVirtualModuleFilename(segmentName, fileName);
                const filesToSearchVirtual = filesToSearch.map((filename) => encodeVirtualModuleFilename(segmentName, filename));
                // apply to the segment
                let newHighlights = _langService.getDocumentHighlights(virtualFilename, position, filesToSearchVirtual);
                //console.log('🚀 ~ file: plugin.ts:773 ~ getDocumentHighlights ~ newHighlights:', JSON.stringify(virtualFilename), tryStringify(newHighlights, { depth: 4 }), tryStringify({ virtualFilename, segment }));
                if (newHighlights) {
                    const origFilename = decodeVirtualModuleFilename(virtualFilename)[1];
                    newHighlights = newHighlights.map((highlight) => (0, utils_js_1.replace)(highlight, 'fileName', origFilename));
                    return newHighlights;
                }
            }
            return prior;
        };
        serviceProxy.getCompletionsAtPosition = (fileName, position, options, formattingSettings) => {
            let prior = _langService.getCompletionsAtPosition(fileName, position, options, formattingSettings);
            console.log('🚀 ~ file: plugin.ts:826 ~ getCompletionsAtPosition:', (0, helpers_js_1.tryStringify)(prior, { depth: 4 }), (0, helpers_js_1.tryStringify)({
                fileName,
                position,
                options,
                formattingSettings,
            }));
            if (!prior) {
                // TODO: check if this file has segments at all
                const [segment] = findSegmentWithIndexFromPos(fileName, position);
                if (!(segment === null || segment === void 0 ? void 0 : segment.name))
                    return prior;
                const virtualFilename = encodeVirtualModuleFilename(segment.name, fileName);
                // apply to the segment
                let compInfo = _langService.getCompletionsAtPosition(virtualFilename, position, options, formattingSettings);
                // adjust fileName for and references
                if (compInfo) {
                    const origFilename = decodeVirtualModuleFilename(virtualFilename)[1];
                    //compInfo = compInfo.map((loc) => {
                    //  return replace(loc, 'fileName', origFilename);
                    //});
                    // TODO: implement me
                }
                console.log('🚀 ~ file: plugin.ts:893 ~ getCompletionsAtPosition ~ compInfo:', JSON.stringify(virtualFilename), (0, helpers_js_1.tryStringify)(compInfo, { depth: 4 }), (0, helpers_js_1.tryStringify)({ virtualFilename, segment }));
                return compInfo;
            }
            return prior;
        };
        serviceProxy.getCompletionEntryDetails;
        serviceProxy.getQuickInfoAtPosition = wrapLangServiceMethod(_langService.getQuickInfoAtPosition, (method, [fileName, position], prior) => {
            var _a;
            if (prior !== undefined)
                return prior;
            const [virtualFilename, _segment, _segmentIndex] = (_a = findSegmentWithVirtualFilename(fileName, position)) !== null && _a !== void 0 ? _a : [];
            let newValue = method(virtualFilename, position);
            console.log('🚀 ~ file: plugin.ts:972 ~ getQuickInfoAtPosition ~ newValue:', (0, helpers_js_1.tryStringify)(newValue), (0, helpers_js_1.tryStringify)({ fileName, virtualFilename, position }));
            return newValue;
        });
        serviceProxy.getSignatureHelpItems = (fileName, position, options) => {
            let prior = _langService.getSignatureHelpItems(fileName, position, options);
            console.log('🚀 ~ file: plugin.ts:828 ~ getSignatureHelpItems:', (0, helpers_js_1.tryStringify)(prior, { depth: 4 }), (0, helpers_js_1.tryStringify)({
                fileName,
                position,
                options,
            }));
            if (!prior) {
                // TODO: check if this file has segments at all
                const [segment] = findSegmentWithIndexFromPos(fileName, position);
                if (!(segment === null || segment === void 0 ? void 0 : segment.name))
                    return prior;
                const virtualFilename = encodeVirtualModuleFilename(segment.name, fileName);
                // apply to the segment
                let helpItems = _langService.getSignatureHelpItems(virtualFilename, position, options);
                // adjust fileName for and references
                if (helpItems) {
                    const origFilename = decodeVirtualModuleFilename(virtualFilename)[1];
                    //compInfo = compInfo.map((loc) => {
                    //  return replace(loc, 'fileName', origFilename);
                    //});
                }
                console.log('🚀 ~ file: plugin.ts:864 ~ getSignatureHelpItems ~ helpItems:', JSON.stringify(virtualFilename), (0, helpers_js_1.tryStringify)(helpItems, { depth: 4 }), (0, helpers_js_1.tryStringify)({ virtualFilename, segment }));
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
exports.init = init;
function transformCode(sourceText, fileName) {
    console.log('🚀 ~ file: plugin.ts:493 ~ transformCode ~ fileName:', fileName, '\n----------\n' + sourceText + '\n----------\n');
    // check if separator exists
    const matchData = sourceText.match(/^---\nname=.*/m);
    if (!matchData)
        return sourceText;
    if (matchData.index === undefined)
        return sourceText;
    // replace separators to blank code
    const length = matchData[0].length;
    return (sourceText.slice(0, matchData.index) +
        ' '.repeat(length) +
        sourceText.slice(matchData.index + length));
}
function createSegmentManager({ logger: { debug, info } }) {
    const segmentEntriesMap = new Map();
    function saveSegmentsForFile(filename, segments) {
        segmentEntriesMap.set(filename, segments);
    }
    function loadSegmentsForFile(filename) {
        var _a;
        if (typeof filename === 'string') {
            return [(_a = segmentEntriesMap.get(filename)) !== null && _a !== void 0 ? _a : null];
        }
        else {
            for (const key of segmentEntriesMap.keys()) {
                if (filename(key)) {
                    return [segmentEntriesMap.get(key), key];
                }
            }
            return null;
        }
    }
    function getSegmentFromFile(filename, segmentName) {
        var _a, _b;
        const segments = (_a = loadSegmentsForFile(filename)) === null || _a === void 0 ? void 0 : _a[0];
        return (_b = segments === null || segments === void 0 ? void 0 : segments.find(({ name }) => name === segmentName)) !== null && _b !== void 0 ? _b : null;
    }
    /**
     * @returns [segment, index] if found, [null, -1] if not
     */
    function findSegmentWithIndexFromPos(filename, pos) {
        const segmentEntries = segmentEntriesMap.get(filename);
        if (!segmentEntries)
            return [null, -1];
        for (let i = 0; i < segmentEntries.length; i += 1) {
            const segment = segmentEntries[i];
            if (segment.start <= pos && pos < segment.end) {
                return [segment, i];
            }
        }
        // segment not found
        return [null, -1];
    }
    function getOtherSegments(filename, index) {
        const otherSegments = [];
        const segmentEntries = segmentEntriesMap.get(filename);
        for (let i = 0; i < segmentEntries.length; i += 1) {
            if (i === index)
                continue;
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
    ];
}
function checkIsVirtualModuleFilename(filename) {
    return filename.startsWith('/virtual-resolved-path/');
}
function createVirtualModuleFilenameEncoder([serializeModuleName, deserializeModuleName,]) {
    function encodeVirtualModuleFilename(moduleName, containingFile) {
        if (moduleName.startsWith(PREFIX)) {
            moduleName = moduleName.slice(PREFIX.length);
        }
        const resolvedFileName = `/virtual-resolved-path/${serializeModuleName(containingFile, moduleName)}`;
        return resolvedFileName;
    }
    function decodeVirtualModuleFilename(filename, options = { recursive: true }) {
        let [segmentName, origFilepath] = deserializeModuleName(filename.slice('/virtual-resolved-path/'.length));
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
function wrapLangServiceMethod(method, callback) {
    return function (...args) {
        let prior = method(...args);
        console.log(`🚀 ~ file: plugin.ts:1226 ~ [${method.name}]:`, (0, helpers_js_1.tryStringify)(prior, { depth: 4 }), (0, helpers_js_1.tryStringify)(args));
        return callback(method, args, prior);
    };
}
//# sourceMappingURL=plugin.js.map