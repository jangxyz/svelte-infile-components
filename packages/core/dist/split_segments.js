"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseError = void 0;
exports.splitSegmentsWithPosition = splitSegmentsWithPosition;
const parse_utils_js_1 = require("./parse_utils.js");
const parse_helpers_js_1 = require("./parse_helpers.js");
//const SPLIT_PATTERN = /\n---\nname=(?<name>.*)\n/;
const SPLIT_PATTERN = /(?<header>\n---\n)\s*<template\b[^>]*\bid="(?<name>[^"]*)">/m;
const THREE_DASHES = '\n---\n';
class ParseError extends Error {
    constructor(input) {
        super(input.toString());
        this.error = null;
        if (input instanceof Error) {
            this.error = input;
        }
    }
}
exports.ParseError = ParseError;
/**
 * Take only code *before* the content separator.
 * Check code validity incrementally.
 *
 * @returns - tuple of [main segment, array of [segment name, code] tuples]
 */
function splitSegmentsWithPosition(codeInput) {
    // TODO: make more robust, only modify files that have virtual imports
    // Step 1.
    //   snippets1: text snippets split by '\n---\n'
    const { snippets: snippets1 } = splitCodeIntoSnippets(codeInput);
    if (snippets1 === undefined) {
        const { start, end } = { start: 0, end: codeInput.length };
        const _tree = (0, parse_utils_js_1.parseModuleLoose)(codeInput);
        let exportedNames;
        try {
            exportedNames = (0, parse_helpers_js_1.findExportNames)(_tree);
        }
        catch (error) {
            console.error('error while findExportNames:', '\n' + '='.repeat(40) + '\n' + codeInput + '\n' + '='.repeat(40));
            throw error;
        }
        const importedNames = (0, parse_helpers_js_1.findImportNames)(_tree);
        const names = (0, parse_helpers_js_1.findLocalDeclaredNames)(_tree);
        const segment = {
            name: undefined,
            header: '',
            text: codeInput,
            start,
            end,
            names,
            importedNames,
            exportedNames,
        };
        return [segment, [segment]];
    }
    //console.log('🚀 ~ file: split_segments.ts:86 ~ snippets1:', snippets1);
    // Step 2.
    //   group snippets by valid js code.
    // FIXME: we should check valid svelte, intead of valid javascript
    const validSnippetGroups2 = groupByVaildJavascript(snippets1, codeInput);
    //console.log( '🚀 ~ file: split_segments.ts:92 ~ validSnippetGroups2:', inspect(validSnippetGroups2, { depth: 3 }),);
    // Step 3.
    //   rejoin each group with the splitter and the snippet name,
    //   together with parsed results.
    const segments = groupIntoSegments(validSnippetGroups2);
    //console.log('🚀 ~ file: split_segments.ts:101 ~ segments:', segments);
    return [segments[0], segments];
}
/** split every piece by '\n---\n' */
function splitCodeIntoSnippets(codeInput) {
    let restCode = codeInput;
    let matchIndex = restCode.search(SPLIT_PATTERN);
    //console.log('🚀 ~ file: split_segments.ts:108 ~ matchIndex:', matchIndex, { restCode: _summary(restCode),});
    if (matchIndex === -1) {
        return { snippets: undefined, matchIndex, restCode };
    }
    const snippets = [];
    while (matchIndex >= 0) {
        const _lastSnippet = snippets.at(-1);
        const start = _lastSnippet ? _lastSnippet.end + THREE_DASHES.length : 0;
        const text = restCode.slice(0, matchIndex);
        const newSnippet = {
            text,
            start,
            end: start + text.length,
        };
        snippets.push(newSnippet);
        //console.log('🚀 ~ file: split_segments.ts:146 ~ matchIndex:', matchIndex, { _lastSnippet, newSnippet, snippets: [...snippets], restCode: _summary(restCode.slice(matchIndex + THREE_DASHES.length)), });
        // next
        restCode = restCode.slice(matchIndex + THREE_DASHES.length);
        matchIndex = restCode.search(SPLIT_PATTERN);
    }
    // finalize
    if (matchIndex === -1) {
        const _lastSnippet = snippets.at(-1);
        const start = _lastSnippet ? _lastSnippet.end + THREE_DASHES.length : 0;
        const text = restCode;
        const newSnippet = {
            text,
            start,
            end: start + text.length,
        };
        snippets.push(newSnippet);
        //console.log('🚀 ~ file: split_segments.ts:147 ~ final:', matchIndex, { _lastSnippet, newSnippet, snippets: [...snippets], restCode: _summary(restCode), });
    }
    return { snippets, matchIndex, restCode };
}
/**
 * Group snippets by valid js code.
 * keeps info of whether each group is complete, and an array of code snippets that belong to the group.
 */
function groupByVaildJavascript(snippets1, codeInput) {
    var _a;
    let validSnippetGroups2 = [
        [null, []],
    ];
    validSnippetGroups2 = snippets1.reduce((memo, thisSnippet) => {
        const lastGroup = memo[memo.length - 1];
        //console.log('-', index, JSON.stringify(thisSnippet), JSON.stringify({ lastGroup, memo }),);
        // currently have errors, or is first time
        if (lastGroup[0] !== true) {
            lastGroup[1].push(thisSnippet);
            const groupSnippetText = lastGroup[1]
                .map(({ text }) => text)
                .join(THREE_DASHES);
            // check whether the code is valid javascript
            const parseError = (0, parse_utils_js_1.checkInvalidJavascript)(groupSnippetText);
            //const parseError = checkInvalidJavascript(groupSnippetText + THREE_DASHES); // XXX
            const isDashedError = (function checkDashedError(parseError) {
                if (!parseError)
                    return false;
                const errorMsg = parseError.message;
                const md1 = errorMsg.match(/SyntaxError: Assigning to rvalue \((?<lineNum>[0-9]+):(?<offset>[0-9])\)/);
                if (!md1)
                    return false;
                const { lineNum, offset } = md1.groups;
                if (offset !== '2')
                    return false;
                const errorLine = codeInput.split('\n')[Number(lineNum)];
                if (errorLine !== '---') {
                    //console.log('🚀 ~ file: split_segments.ts:245 ~ isDashedError ~ errorLine:', errorLine,);
                    return false;
                }
                return true;
            })(parseError);
            // invalid, not combined yet. keep current state and keep on
            if (isDashedError) {
                // FIXME: check error type and proceed if it has nothing to do with the separator.
                // "SyntaxError: Assigning to rvalue"
                // prettier-ignore
                console.warn('DEBUG parse error:', JSON.stringify(parseError === null || parseError === void 0 ? void 0 : parseError.message), JSON.stringify({ groupSnippetText }));
                // currently does nothing, hoping it will be valid with next snippet.
                lastGroup[0] = parseError;
            }
            // there are errors, but not from dash separator.
            else if (parseError) {
                // close current last group
                lastGroup[0] = true;
                // insert a new group
                memo.push([null, []]);
            }
            // valid js. combined to valid js
            else {
                // close current last group
                lastGroup[0] = true;
                // insert a new group
                memo.push([null, []]);
            }
            return memo;
        }
        //
        //if (checkValidJavascript(thisSnippet.text)) {
        //  memo.push([true, [thisSnippet]], [null, []]);
        //}
        return memo;
    }, validSnippetGroups2);
    // trim empty group at the end
    if (validSnippetGroups2.at(-1)[1].length === 0)
        validSnippetGroups2.pop();
    //console.log('🚀 ~ file: split_segments.ts:226 ~ splitSnippets2 ~ validSnippetGroups2:', JSON.stringify(validSnippetGroups2));
    // assert there are no incomplete groups.
    for (const group of validSnippetGroups2) {
        if (group[0] !== true) {
            console.error('ERROR invalid snippet group:', JSON.stringify(group));
            // FIXME: do something instead of
            throw new ParseError((_a = group[0]) !== null && _a !== void 0 ? _a : 'not a valid snippet');
        }
    }
    return validSnippetGroups2;
}
/**
 * rejoin each group with the splitter and the snippet name,
 * together with parsed results.
 */
function groupIntoSegments(validSnippetGroups) {
    return validSnippetGroups.map(([_isValid, snippetGroup], groupIndex) => {
        // first item: main segment
        if (groupIndex === 0) {
            const text = snippetGroup.map(({ text }) => text).join(THREE_DASHES);
            const _tree = (0, parse_utils_js_1.parseModuleLoose)(text);
            const importedNames = (0, parse_helpers_js_1.findImportNames)(_tree);
            const exportedNames = (0, parse_helpers_js_1.findExportNames)(_tree);
            const names = (0, parse_helpers_js_1.findLocalDeclaredNames)(_tree);
            return {
                name: undefined,
                header: '',
                text,
                start: snippetGroup[0].start,
                end: snippetGroup[snippetGroup.length - 1].end,
                names,
                importedNames,
                exportedNames,
            };
        }
        // extract segment name
        const fullSnippetText = THREE_DASHES + snippetGroup.map(({ text }) => text).join(THREE_DASHES);
        const matchData = fullSnippetText.match(SPLIT_PATTERN);
        if (!(matchData === null || matchData === void 0 ? void 0 : matchData.groups)) {
            // prettier-ignore
            console.error('ERROR pattern does not match the pattern:', `/${SPLIT_PATTERN.source}/`, 'text:', JSON.stringify(fullSnippetText));
            throw new ParseError('cannot extract segment name');
        }
        const name = matchData.groups['name'];
        const header = matchData.groups['header'];
        // merge with prev group
        const [_isComplete, prevSnippetGroup] = validSnippetGroups[groupIndex - 1];
        //console.log('🚀 ~ file: split_segments.ts:384 ~ snippets3 ~ matchData:', matchData, { fullSnippetText, groups: matchData.groups, header, 'matchData[0]': matchData[0], },);
        const text = fullSnippetText.slice(header.length);
        const start = prevSnippetGroup.at(-1).end;
        //const end = start + text.length;
        const end = snippetGroup.at(-1).end;
        const _tree = (0, parse_utils_js_1.parseModuleLoose)(text);
        const importedNames = (0, parse_helpers_js_1.findImportNames)(_tree);
        const exportedNames = (0, parse_helpers_js_1.findExportNames)(_tree);
        const names = (0, parse_helpers_js_1.findLocalDeclaredNames)(_tree);
        return {
            name,
            header,
            text,
            start,
            end,
            names,
            importedNames,
            exportedNames,
        };
    });
}
//# sourceMappingURL=split_segments.js.map