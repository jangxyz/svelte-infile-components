import { checkInvalidJavascript, parseModuleLoose } from './parse_utils.js';
import {
  findExportNames,
  findImportNames,
  findLocalDeclaredNames,
} from './parse_helpers.js';

const SPLIT_PATTERN = /\n---\nname=(?<name>.*)\n/;
const THREE_DASHES = '\n---\n';

export class ParseError extends Error {
  error: Error | null = null;

  constructor(input: string | Error) {
    super(input.toString());

    if (input instanceof Error) {
      this.error = input;
    }
  }
}

type SnippetObject = {
  text: string;
  start: number;
  end: number;
};

export type Segment = SnippetObject & {
  name: string | undefined;
  header: string;
  exportedNames: ExportedNameTuple[];
  importedNames: ImportedNameTuple[];
  names: LocalNameTuple[];
};

export type ExportedNameTuple = ReturnType<typeof findExportNames>[number];
export type ImportedNameTuple = ReturnType<typeof findImportNames>[number];
export type LocalNameTuple = ReturnType<typeof findLocalDeclaredNames>[number];

/**
 * Take only code *before* the content separator.
 * Check code validity incrementally.
 *
 * @returns - tuple of [main segment, array of [segment name, code] tuples]
 */
export function splitSegmentsWithPosition(
  codeInput: string,
): [Segment, Segment[]] {
  // TODO: make more robust, only modify files that have virtual imports

  // snippets1: text snippets split by '\n---\n'
  const { snippets: snippets1 } = splitCodeIntoSnippets(codeInput);
  if (snippets1 === undefined) {
    const { start, end } = { start: 0, end: codeInput.length };
    const _tree = parseModuleLoose(codeInput);
    const exportedNames = findExportNames(_tree);
    const importedNames = findImportNames(_tree);
    const names = findLocalDeclaredNames(_tree);
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
  //console.log('🚀 ~ file: split_segments.ts:74 ~ snippets1:', JSON.stringify(snippets1),);

  // group snippets by valid js code.
  const validSnippetGroups2: [null | true | Error, SnippetObject[]][] =
    groupByVaildJavascript(snippets1, codeInput);
  //console.log('🚀 ~ file: split_segments.ts:82 ~ validSnippetGroups2:', JSON.stringify(validSnippetGroups2),);

  // rejoin each group with the splitter and the snippet name,
  // together with parsed results.
  const segments = groupIntoSegments(validSnippetGroups2);
  //console.log('🚀 ~ file: split_segments.ts:88 ~ segments:', JSON.stringify(segments),);

  return [segments[0], segments];
}

/** split every piece by '\n---\n' */
function splitCodeIntoSnippets(codeInput: string): {
  snippets: SnippetObject[] | undefined;
  matchIndex: number;
  restCode: string;
} {
  let restCode = codeInput;
  let matchIndex = restCode.search(SPLIT_PATTERN);

  if (matchIndex === -1) {
    return { snippets: undefined!, matchIndex, restCode } as const;
  }

  const snippets: SnippetObject[] = [];
  while (matchIndex >= 0) {
    //console.log( '🚀 ~ file: split_virtual_code.ts:146 ~ matchIndex:', matchIndex, { restCode: _summary(restCode) });
    const _lastSnippet = snippets.at(-1);
    const start = _lastSnippet ? _lastSnippet.end + THREE_DASHES.length : 0;
    const text = restCode.slice(0, matchIndex);
    snippets.push({
      text,
      start,
      end: start + text.length,
    });

    // next
    restCode = restCode.slice(matchIndex + THREE_DASHES.length);
    matchIndex = restCode.search(SPLIT_PATTERN);
  }
  if (matchIndex === -1) {
    const _lastSnippet = snippets.at(-1);
    const start = _lastSnippet ? _lastSnippet.end + THREE_DASHES.length : 0;
    const text = restCode;
    snippets.push({
      text,
      start,
      end: start + text.length,
    });
  }

  return { snippets, matchIndex, restCode };
}

/**
 * Group snippets by valid js code.
 * keeps info of whether each group is complete, and an array of code snippets that belong to the group.
 */
function groupByVaildJavascript(snippets1: SnippetObject[], codeInput: string) {
  let validSnippetGroups2: [null | true | Error, SnippetObject[]][] = [
    [null, []],
  ];

  validSnippetGroups2 = snippets1.reduce((memo, thisSnippet) => {
    const lastGroup = memo[memo.length - 1];
    //console.log('-', index, JSON.stringify(thisSnippet), JSON.stringify({ lastGroup, memo }),);
    // currently have errors, or is first time
    if (lastGroup[0] !== true) {
      lastGroup[1].push(thisSnippet);

      const groupSnippetText = (lastGroup[1] as SnippetObject[])
        .map(({ text }) => text)
        .join(THREE_DASHES);

      // check whether the code is valid javascript
      const parseError = checkInvalidJavascript(groupSnippetText);
      //const parseError = checkInvalidJavascript(groupSnippetText + THREE_DASHES); // XXX
      const isDashedError = (function checkDashedError(parseError) {
        if (!parseError) return false;

        const errorMsg = parseError.message;

        const md1 = errorMsg.match(
          /SyntaxError: Assigning to rvalue \((?<lineNum>[0-9]+):(?<offset>[0-9])\)/,
        );
        if (!md1) return false;

        const { lineNum, offset } = md1.groups!;
        if (offset !== '2') return false;
        const errorLine = codeInput.split('\n')[Number(lineNum)];
        if (errorLine !== '---') {
          //console.log('🚀 ~ file: split_virtual_code.ts:245 ~ isDashedError ~ errorLine:', errorLine,);
          return false;
        }

        return true;
      })(parseError);

      // invalid, not combined yet. keep current state and keep on
      if (isDashedError) {
        // FIXME: check error type and proceed if it has nothing to do with the separator.
        // "SyntaxError: Assigning to rvalue"
        // prettier-ignore
        console.warn('DEBUG parse error:', JSON.stringify(parseError?.message), JSON.stringify({ groupSnippetText }));

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
  if (validSnippetGroups2.at(-1)![1].length === 0) validSnippetGroups2.pop();

  //console.log('🚀 ~ file: split_segments.ts:226 ~ splitSnippets2 ~ validSnippetGroups2:', JSON.stringify(validSnippetGroups2));

  // assert there are no incomplete groups.
  for (const group of validSnippetGroups2) {
    if (group[0] !== true) {
      console.error('ERROR invalid snippet group:', JSON.stringify(group));
      // FIXME: do something instead of
      throw new ParseError(group[0] ?? 'not a valid snippet');
    }
  }

  return validSnippetGroups2;
}

/**
 * rejoin each group with the splitter and the snippet name,
 * together with parsed results.
 */
function groupIntoSegments(
  validSnippetGroups: [isValid: true | Error | null, SnippetObject[]][],
) {
  return validSnippetGroups.map(([_isValid, snippetGroup], groupIndex) => {
    // first item: main segment
    if (groupIndex === 0) {
      const text = snippetGroup.map(({ text }) => text).join(THREE_DASHES);

      const _tree = parseModuleLoose(text);
      const importedNames = findImportNames(_tree);
      const exportedNames = findExportNames(_tree);
      const names = findLocalDeclaredNames(_tree);

      return {
        name: undefined,
        header: '',
        text,
        start: snippetGroup[0].start,
        end: snippetGroup[snippetGroup.length - 1].end,
        names,
        importedNames,
        exportedNames,
      } satisfies Segment;
    }

    // extract segment name
    const fullSnippetText =
      THREE_DASHES + snippetGroup.map(({ text }) => text).join(THREE_DASHES);
    const matchData = fullSnippetText.match(SPLIT_PATTERN);
    if (!matchData) {
      // prettier-ignore
      console.error('ERROR pattern does not match the pattern:', `/${SPLIT_PATTERN.source}/`, 'text:', JSON.stringify(fullSnippetText));
      throw new ParseError('cannot extract segment name');
    }
    const name = matchData.groups?.['name'];
    const header = matchData[0];

    // merge with prev group
    const [_isComplete, prevSnippetGroup] = validSnippetGroups[groupIndex - 1];

    //console.log( '🚀 ~ file: vite-plugin-dynamic_virtual_import.js:384 ~ snippets3 ~ matchData:', matchData, { fullSnippet, groups: matchData.groups, matchData },);
    const text = fullSnippetText.slice(matchData[0].length);
    const start = prevSnippetGroup.at(-1)!.end;
    //const end = start + text.length;
    const end = snippetGroup.at(-1)!.end;

    const _tree = parseModuleLoose(text);
    const importedNames = findImportNames(_tree);
    const exportedNames = findExportNames(_tree);
    const names = findLocalDeclaredNames(_tree);
    return {
      name,
      header,
      text,
      start,
      end,
      names,
      importedNames,
      exportedNames,
    } satisfies Segment;
  });
}
