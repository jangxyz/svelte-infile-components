import * as path from 'path';
import {
  CreateFile,
  OptionalVersionedTextDocumentIdentifier,
  Position,
  Range,
  TextDocumentEdit,
  TextEdit,
  WorkspaceEdit,
  type CodeAction,
  type CodeActionContext,
} from 'vscode-languageserver';
import {
  isRangeInTag,
  positionAt,
  TagInformation,
  updateRelativeImport,
} from '../../../../lib/documents';
import { pathToUrl } from '../../../../utils';
import { SvelteDocument } from '../../SvelteDocument';

export interface ExtractInfileComponentArgs {
  uri: string;
  range: Range;
  filePath: string;
}
export const extractInfileComponentCommand =
  'extract_to_svelte_infile_component';

export interface MoveInfileComponentToNewFileArgs {
  uri: string;
  range: Range;
  filePath: string;
}

export const moveInfileComponentToNewFile = 'move_infile_component_to_new_file';

export function insertCodeActions(
  svelteDoc: SvelteDocument,
  range: Range,
  _context: CodeActionContext,
) {
  const codeActions: CodeAction[] = [];

  const isValidSelectionRange =
    checkIsTouchingWhitespace(range, svelteDoc) &&
    checkIsSveltePart(range, svelteDoc);
  if (isValidSelectionRange) {
    codeActions.push({
      title: 'Extract to Svelte in-file component',
      kind: `refactor.extract.${extractInfileComponentCommand}`,
      command: {
        title: 'Extract to Svelte in-file component',
        command: 'svelte-infile.extractInfileComponent',
        arguments: [svelteDoc.uri, range],
      },
      data: { uri: svelteDoc.uri },
    });
  }

  const currentInfileComponent = getCurrentInfileComponent(range, svelteDoc);
  if (currentInfileComponent) {
    codeActions.push({
      title: 'Move infile component to new file',
      kind: `refactor.${extractInfileComponentCommand}`,
      command: {
        title: 'Move infile component to new file',
        command: 'svelte-infile.moveInfileComponentToNewFile',
        arguments: [svelteDoc.uri, range],
      },
      data: { uri: svelteDoc.uri },
    });
  }

  return codeActions;
}

export async function executeExtractInfileComponentCommand(
  svelteDoc: SvelteDocument,
  refactorArgs: ExtractInfileComponentArgs,
): Promise<WorkspaceEdit | string | null> {
  const { range } = refactorArgs;

  const isValidSelectionRange =
    checkIsTouchingWhitespace(range, svelteDoc) &&
    checkIsSveltePart(range, svelteDoc);
  if (!isValidSelectionRange) {
    return 'Invalid selection range';
  }

  let filePath = refactorArgs.filePath || 'NewComponent';
  if (!filePath.endsWith('.svelte')) {
    filePath += '.svelte';
  }
  if (!filePath.startsWith('.')) {
    filePath = './' + filePath;
  }

  const componentName = filePath.split('/').pop()?.split('.svelte')[0] || '';

  return <WorkspaceEdit>{
    documentChanges: [
      TextDocumentEdit.create(
        OptionalVersionedTextDocumentIdentifier.create(svelteDoc.uri, null),
        [
          replace_withComponent(range, componentName),
          insert_ImportInfileComponent(componentName),
          insert_InfileComponent(componentName),
        ],
      ),
    ],
  };

  ///

  function replace_withComponent(range: Range, componentName: string) {
    return TextEdit.replace(range, `<${componentName}></${componentName}>`);
  }

  function insert_ImportInfileComponent(module: string): TextEdit {
    const startPos = (svelteDoc.script || svelteDoc.moduleScript)?.startPos;
    const importText = `\n  import ${componentName} from 'infile:${module}';\n`;
    return TextEdit.insert(
      startPos || Position.create(0, 0),
      startPos ? importText : `<script>\n${importText}</script>`,
    );
  }

  function insert_InfileComponent(componentName: string) {
    const text = svelteDoc.getText();
    const textLines = text.split('\n');
    const lastLineNum = textLines.length;
    const lastLineColumn = textLines[lastLineNum - 1].length;

    const endOfDoc = Position.create(lastLineNum - 1, lastLineColumn);

    const newText = [
      getTemplate(range),
      getTagWithText(svelteDoc.script, false),
      getTagWithText(svelteDoc.moduleScript, false),
      getTagWithText(svelteDoc.style, true),
    ]
      .filter((tag) => tag.start >= 0)
      .sort((a, b) => a.start - b.start)
      .map((tag) => tag.text)
      .join('');

    const templateText = [
      `<template id="${componentName}">`,
      newText
        .trim()
        .split('\n')
        .map((line) => '  ' + line)
        .join('\n'),
      '</template>',
    ].join('\n');

    return TextEdit.insert(endOfDoc, `\n\n---\n\n${templateText}`);

    ///

    function getTemplate(range: Range) {
      const startOffset = svelteDoc.offsetAt(range.start);
      return {
        text:
          text.substring(startOffset, svelteDoc.offsetAt(range.end)) + '\n\n',
        start: startOffset,
      };
    }

    function getTagWithText(tag: TagInformation | null, isStyleTag: boolean) {
      if (!tag) {
        return { text: '', start: -1 };
      }

      const tagText = updateRelativeImports(
        svelteDoc,
        text.substring(tag.container.start, tag.container.end),
        filePath,
        isStyleTag,
      );
      return {
        text: `${tagText}\n\n`,
        start: tag.container.start,
      };
    }
  }
}

export function checkIsTouchingWhitespace(
  range: Range,
  svelteDoc: SvelteDocument,
) {
  const text = svelteDoc.getText();
  const offsetStart = svelteDoc.offsetAt(range.start);
  const offsetEnd = svelteDoc.offsetAt(range.end);
  const validStart = offsetStart === 0 || /[\s\W]/.test(text[offsetStart - 1]);
  const validEnd =
    offsetEnd === text.length - 1 || /[\s\W]/.test(text[offsetEnd]);

  return validStart && validEnd;
}

export function checkIsSveltePart(range: Range, svelteDoc: SvelteDocument) {
  const isSveltePart = !(
    isRangeInTag(range, svelteDoc.style) ||
    isRangeInTag(range, svelteDoc.script) ||
    isRangeInTag(range, svelteDoc.moduleScript)
  );
  return isSveltePart;
}

export async function executeMoveInfileComponentToNewFileCommand(
  svelteDoc: SvelteDocument,
  refactorArgs: MoveInfileComponentToNewFileArgs,
): Promise<WorkspaceEdit | string | null> {
  const { range } = refactorArgs;
  console.log(
    '🚀 ~ file: jangxyz_infileRefactorings.ts:173 ~ executeMoveInfileComponentToNewFileCommand:',
    svelteDoc,
    { refactorArgs },
  );

  const isValidSelectionRange =
    checkIsTouchingWhitespace(range, svelteDoc) &&
    checkIsSveltePart(range, svelteDoc);
  console.log(
    '🚀 ~ file: jangxyz_infileRefactorings.ts:180 ~ isValidSelectionRange:',
    isValidSelectionRange,
    {
      isTouchingWhitespace: checkIsTouchingWhitespace(range, svelteDoc),
      isSveltePart: checkIsSveltePart(range, svelteDoc),
      range,
    },
  );
  if (!isValidSelectionRange) {
    return 'Invalid selection range';
  }

  const text = svelteDoc.getText();
  const infileComponentInfo = getCurrentInfileComponent(range, svelteDoc);
  if (!infileComponentInfo) {
    return 'Cannot parse infile component';
  }

  console.log(
    '🚀 ~ file: jangxyz_infileRefactorings.ts:215 ~ infileComponentInfo:',
    infileComponentInfo,
  );

  //

  let filePath = infileComponentInfo.name;
  if (!filePath.endsWith('.svelte')) {
    filePath += '.svelte';
  }
  if (!filePath.startsWith('.')) {
    filePath = './' + filePath;
  }
  const componentName = filePath.split('/').pop()?.split('.svelte')[0] || '';
  const newFileUri = pathToUrl(
    path.join(path.dirname(svelteDoc.getFilePath()), filePath),
  );

  //console.log('🚀 ~ file: jangxyz_infileRefactorings.ts:204:', { newFileUri, componentName, filePath, });

  const newFileText = dedent(infileComponentInfo.innerText).trim();

  // TODO: take care of nested infile components too

  return <WorkspaceEdit>{
    documentChanges: [
      TextDocumentEdit.create(
        OptionalVersionedTextDocumentIdentifier.create(svelteDoc.uri, null),
        [
          ...clear_infileComponent(infileComponentInfo),
          ...replace_ImportInfileComponent(componentName, filePath),
        ],
      ),
      // create new file and edit
      CreateFile.create(newFileUri, { overwrite: true }),
      TextDocumentEdit.create(
        OptionalVersionedTextDocumentIdentifier.create(newFileUri, null),
        [TextEdit.insert(Position.create(0, 0), newFileText)],
      ),
    ],
  };

  ///

  function clear_infileComponent(infileComponentInfo: InfileComponentInfo) {
    const { start, end } = infileComponentInfo.range;
    const targetRange = Range.create(
      positionAt(start, text),
      positionAt(end, text),
    );

    return [TextEdit.del(targetRange)];

    //const markupText = getMarkupText();
    //console.log('🚀 ~ file: jangxyz_infileRefactorings.ts:217 ~ markupText:', markupText);
    //const infileComponentTexts = markupText
    //  .split('\n---\n')
    //  .filter((chunk) => chunk.trim().match(/<template[^>]*>.*<\/template>/s));

    //return [] as TextEdit[];
  }

  function replace_ImportInfileComponent(
    bareComponentName: string,
    filePath: string,
  ): TextEdit[] {
    const matchAllData = text.matchAll(/(import\b.*?['"])infile:(.*?)(['"])/g);
    return [...matchAllData]
      .map((md) => {
        const [_, preString, compName, quot] = md;
        const bareCompName = compName.replace(/[.]svelte$/, '');
        if (bareCompName !== bareComponentName) {
          //  console.log('skipping', JSON.stringify(md[0]), { md, componentName });
          return null;
        }
        const startPos = positionAt(md.index, text);
        const endPos = positionAt(md.index + md[0].length, text);
        const range = Range.create(startPos, endPos);
        const newText = preString + `./${bareCompName}.svelte${quot}`;
        return TextEdit.replace(range, newText);
      })
      .filter((x): x is TextEdit => Boolean(x));
  }

  ///

  //function getMarkupText() {
  //  const tags = [
  //    getTag(svelteDoc.script, false),
  //    getTag(svelteDoc.moduleScript, false),
  //    getTag(svelteDoc.style, true),
  //  ].filter((tag): tag is NonNullable<ReturnType<typeof getTag>> =>
  //    Boolean(tag),
  //  );
  //  const markupText = tags
  //    .sort((a, b) => -(a.start - b.start))
  //    .reduce((textSoFar, { start, end }) => {
  //      textSoFar = textSoFar.slice(0, start) + textSoFar.slice(end);
  //      return textSoFar;
  //    }, text);
  //  return markupText;
  //}

  function dedent(text: string) {
    const lines = text.split('\n');
    const indentSizes = lines
      .map((line) => {
        if (line.trim().length === 0) return null;
        return line.match(/^\s*/)![0].length;
      })
      .filter((size): size is number => typeof size === 'number' && size > 0);
    const minIndentSize = Math.min(...indentSizes);
    return lines.map((line) => line.slice(minIndentSize)).join('\n');
  }
}

// `import {...} from '..'` or `import ... from '..'`
const scriptRelativeImportRegex =
  /import\s+{[^}]*}.*['"`](((\.\/)|(\.\.\/)).*?)['"`]|import\s+\w+\s+from\s+['"`](((\.\/)|(\.\.\/)).*?)['"`]/g;
// `@import '..'`
const styleRelativeImportRege = /@import\s+['"`](((\.\/)|(\.\.\/)).*?)['"`]/g;

function updateRelativeImports(
  svelteDoc: SvelteDocument,
  tagText: string,
  newComponentRelativePath: string,
  isStyleTag: boolean,
) {
  const oldPath = path.dirname(svelteDoc.getFilePath());
  const newPath = path.dirname(path.join(oldPath, newComponentRelativePath));
  const regex = isStyleTag
    ? styleRelativeImportRege
    : scriptRelativeImportRegex;
  let match = regex.exec(tagText);
  while (match) {
    // match[1]: match before | and style regex. match[5]: match after | (script regex)
    const importPath = match[1] || match[5];
    const newImportPath = updateRelativeImport(oldPath, newPath, importPath);
    tagText = tagText.replace(importPath, newImportPath);
    match = regex.exec(tagText);
  }
  return tagText;
}

type InfileComponentInfo = NonNullable<
  ReturnType<typeof getCurrentInfileComponent>
>;
export function getCurrentInfileComponent(
  range: Range,
  svelteDoc: SvelteDocument,
) {
  const startOffset = svelteDoc.offsetAt(range.start);

  const tags = [
    tagRange(svelteDoc.script, false),
    tagRange(svelteDoc.moduleScript, false),
    tagRange(svelteDoc.style, true),
  ]
    .filter((tag): tag is NonNullable<ReturnType<typeof tagRange>> =>
      Boolean(tag),
    )
    .sort((a, b) => a.start - b.start);

  // check
  const lastTag = tags.at(-1);
  if (lastTag && startOffset < lastTag.end) return null;

  return parseInfileComponent(svelteDoc.getText());

  ///

  function tagRange(tag: TagInformation | null, isStyleTag: boolean) {
    if (!tag) {
      return null;
    }

    return {
      start: tag.container.start,
      end: tag.container.end,
    };
  }

  function parseInfileComponent(text: string) {
    const frontMatchData = text
      .slice(0, startOffset)
      .match(/\n---\n\s*(<template[^>]*>)(.*)/s);
    if (!frontMatchData) return null;

    const rearMatchData = text.slice(startOffset).match(/(.*?)<\/template>/s);
    if (!rearMatchData) return null;

    const infileComponentRange = {
      start: frontMatchData.index!,
      end: startOffset + rearMatchData[0].length,
    };

    const fileNameMatchData = frontMatchData[1].match(/\bid=['"](.*?)['"]/);
    if (!fileNameMatchData) {
      console.warn('cannot parse infile component name');
      return null;
    }
    const infileComponentName = fileNameMatchData[1];

    const infileComponentText = text.slice(
      infileComponentRange.start,
      infileComponentRange.end,
    );
    const innerText = frontMatchData[2] + rearMatchData[1];

    return {
      name: infileComponentName,
      range: infileComponentRange,
      text: infileComponentText,
      innerText,
    };
  }
}
