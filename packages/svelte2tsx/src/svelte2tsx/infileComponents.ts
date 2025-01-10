import ts, { type ImportDeclaration } from "typescript";
import type { Node } from "estree-walker";
import MagicString from "magic-string";
import { parseHtmlx } from "../utils/htmlxparser";
// @ts-ignore
import {
    TemplateNode,
    type Fragment,
    type Script,
} from "svelte/types/compiler/interfaces";
import { parse } from "svelte/compiler";
import { inspect } from "node:util";
import { svelte2tsx } from "./index";
import {
    ffilename,
    findInfileImportNodes,
    findLastImportDecl,
    tryAndCatch,
} from "./infileComponents_utils";

export type TsxScript = Omit<Script, "content"> & {
    content: {
        type: "Text";
        start: number;
        end: number;
        value: string;
        raw: string;
    };
};

function buildInfileComponentFilename(templateId: string) {
    let functionName = templateId.replace(/[.]svelte$/, "");
    return "__SvelteInfileComponent__" + functionName;
}

export function preRecursiveProcess(
    str: MagicString,
    options: {
        parse?: typeof import("svelte/compiler").parse;
        version?: string;
        filename?: string;
        isTsFile?: boolean;
        emitOnTemplateError?: boolean;
        namespace?: string;
        mode?: "ts" | "dts";
        accessors?: boolean;
        typingsNamespace?: string;
        noSvelteComponentTyped?: boolean;
        svelte5Plus: boolean;
    },
) {
    const { htmlxAst: htmlAst, tags: _tags } = parseHtmlx(
        str.original,
        options.parse || parse,
        options,
    );
    //const scripts = new Scripts(htmlAst);
    //const { scriptTag, moduleScriptTag: _moduleScriptTag } = scripts.getTopLevelScriptTags();
    const scriptTag = _tags.find(({ type }) => type === "Script");

    const scriptTsAst =
        scriptTag &&
        ts.createSourceFile(
            options.filename,
            scriptTag.content.value,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS,
        );

    const infileImportNodes = findInfileImportNodes(scriptTsAst);

    const componentTemplateEntries = computeComponentTemplateEntries(
        str.original,
        htmlAst,
        options,
    );
    console.log(
    "🚀 ~ file: svelte2tsx/infileComponents.ts:79 ~ preRecursiveProcess ~ componentTemplateTagsEntries:",
    ...ffilename(options.filename),
    componentTemplateEntries.length,
    inspect(componentTemplateEntries, { depth: 7 }),
    inspect(
    {
    htmlAstChildren: htmlAst.children,
    htmlAstChildrenLength: htmlAst.children.length,
    //_tags,
    scriptTag,
    infileImportNodes,
    str: str.toString(),
    },
    { depth: 4 },
    ),
    );

    /// replace <template> tags with inner function
    // reset MagicString before running through each template entries,
    // to avoid errors like "Cannot split a chunk that has already been edited "
    const _original = str.original;
    str = new MagicString(str.toString());
    str.original = _original;
    const str2 = str.clone();

    const getTemplateId = (templateNode: TemplateNode) => {
        let templateId = templateNode.attributes?.find(
            (attr) => attr.name === "id",
        )?.value?.[0]?.raw as string;
        if (!templateId.endsWith(".svelte")) {
            templateId += ".svelte";
        }
        return templateId;
    }

    // re-inject the tsx part back into str
    // prettier-ignore
    //const scriptTsAst = ts.createSourceFile(options.filename, scriptTag.content.value, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS,);
    componentTemplateEntries.forEach(
        ([templateNode, tsxInfo], _index) => {
            const {
                code: templateCode,
                tsx: _tsx,
                scriptTag: templateScriptTag,
                //precedingSplitterNode,
            } = tsxInfo;
            const templateId = getTemplateId(templateNode);

            //console.log(11, "new template", filename(options.filename), options.filename, _index, JSON.stringify(templateId), { original: str.original.toString(), templateNode, templateScriptTag, templateCode, tsx: _tsx, str: str.toString(), },);

            //// 1. cut out the <template> part from 'str'
            //str.remove(precedingSplitterNode.start, precedingSplitterNode.end);
            //str.remove(templateNode.start, templateNode.end);
            //console.log(12, "after cutting out <template>", JSON.stringify(filename(options.filename)), options.filename, _index, JSON.stringify(templateId), { str: str.toString(), precedingSplitterNode, templateNode, },);

            // 2. move import statements into main script tag
            const importNodes = findLastImportDecl(templateNode, {
                code: templateCode,
                scriptTag: templateScriptTag,
            });
            console.log(
                "🚀 ~ file: svelte2tsx/infileComponents.ts:144 ~ preRecursiveProcess ~ importNodes:",
                ...ffilename(options.filename),
                _index,
                templateId,
                importNodes.length,
                inspect(templateNode),
                {
                    importNodes,
                    templateScriptTag,
                },
            );
            _moveImportNodes(str, importNodes, templateNode);
            function _moveImportNodes(
                str: MagicString,
                importNodes: ts.ImportDeclaration[],
                templateNode: TemplateNode,
            ) {
                // prettier-ignore
                const astOffset = templateNode.children[0].start + (templateScriptTag?.content.start ?? 0);

                const lastImportNodeEnd = importNodes.at(-1)?.end;

                // Move import statements upto import bunch of original node.
                // Rename the import clause name to prevent name conflicts in the main namespace,
                // and re-assign it to the current name inside the template scope.
                importNodes.forEach((importNode, _index) => {
                    console.log(
                        "🚀 ~ file: svelte2tsx/infileComponents.ts:171 ~ preRecursiveProcess ~ _moveImportNodes:",
                        ...ffilename(options.filename),
                        templateId,
                        _index,
                        {
                            importNodeFullText: importNode.getFullText(),
                            importNodeStart: importNode.getStart(),
                            importNodeEnd: importNode.end,
                            importNode,
                            astOffset,
                        },
                    );

                    // don't bother moving the infile: imports for current implementation.
                    // NOTE this will be removed once we change to virtual module impl.
                    const moduleSpecifierText =
                        importNode.moduleSpecifier?.getText() ?? "";
                    if (moduleSpecifierText.slice(1, -1).match(/^infile:/)) {
                        return;
                    }

                    // inject code to top
                    tryAndCatch(
                        () => {
                            const [codeToInject, assignmentCode] =
                                (function _buildCodeToInject(
                                    importNode: ts.ImportDeclaration,
                                    original: string,
                                    templateId: string,
                                    astOffset: number,
                                ) {
                                    const astNodeSubstr =
                                        original.slice(astOffset);
                                    const importNodeStart =
                                        importNode.getStart();
                                    const importNodeEnd = importNode.end;
                                    let codeToInject = astNodeSubstr.slice(
                                        importNodeStart,
                                        importNode.end,
                                    );
                                    let assignmentCode = "";

                                    const importClauseNameNode =
                                        importNode.importClause.name;
                                    if (importClauseNameNode) {
                                        const importClauseName0 =
                                            astNodeSubstr.slice(
                                                importClauseNameNode.getStart(),
                                                importClauseNameNode.getEnd(),
                                            );
                                        const importClauseName1 = `__SvelteInfileComponent__${templateId.replace(/[.]svelte$/, "")}__${importClauseName0}`;
                                        const prefix = astNodeSubstr.slice(
                                            importNodeStart,
                                            importClauseNameNode.getStart(),
                                        );
                                        const suffix = astNodeSubstr.slice(
                                            importClauseNameNode.getEnd(),
                                            importNodeEnd,
                                        );
                                        codeToInject = [
                                            prefix,
                                            importClauseName1,
                                            suffix,
                                        ].join("");
                                        assignmentCode = `const ${importClauseName0} = ${importClauseName1};`;
                                    }

                                    console.log(
                                    "🚀 ~ file: svelte2tsx/infileComponents.ts:239 ~ preRecursiveProcess ~ _moveImportNodes ~ codeToInject:",
                                    templateId,
                                    {
                                    original: original.toString(),
                                    str: str.toString(),
                                    //templateNodeStart: templateNode.start,
                                    templateScriptTag,
                                    importNodeFullText:
                                    importNode.getFullText(),
                                    importNodeStart,
                                    importNodeEnd,
                                    astOffset,
                                    lastImportNodeEnd,
                                    codeToInject,
                                    //snippets: [prefix, importClauseName0, suffix],
                                    assignmentCode,
                                    },
                                    );

                                    return [codeToInject, assignmentCode];
                                })(
                                    importNode,
                                    str.original,
                                    templateId,
                                    astOffset,
                                );

                            str.prependLeft(0, codeToInject + "\n\n");
                            str.appendRight(
                                lastImportNodeEnd + astOffset,
                                "\n" + assignmentCode + "\n",
                            );
                        },
                        (err) =>
                            console.log(
                            "🚀 ~ file: svelte2tsx/infileComponents.ts:274 ~ _moveImportNodes ~ ERROR:",
                            err,
                            ),
                    );

                    console.log(
                    "🚀 ~ file: svelte2tsx/infileComponents.ts:280 ~ preRecursiveProcess ~ _moveImportNodes ~ after moveNode():",
                    ...ffilename(options.filename),
                    { str: str.toString(), importNode },
                    );
                });
            }
            console.log(
                "🚀 ~ file: svelte2tsx/infileComponents.ts:286 ~ after _moveImportNodes:",
                ...ffilename(options.filename),
                _index,
                templateId,
                inspect(templateNode),
                { str: str.toString() },
            );

            // re-build tsx nodes based on modification from above.
            // FIXME: redundant code
            //const templateCode2 = templateCode;
            //const tsx = _tsx;
            const [templateCode2] = tryAndCatch(
                () => {
                    return str.slice(
                        templateNode.children[0].start,
                        templateNode.children.at(-1)!.end,
                    );
                },
                (err) => {
                    console.log("🚀 ~ file: infileComponents.ts:349 ~ ERROR:", err);
                    throw err;
                },
            );
            console.log(14, { templateCode2 });
            const tsx = svelte2tsx(templateCode2, {
                ...options,
                filename: templateId,
            });
            console.log(15, { tsx });


            // 3. re-inject the tsx part into the main script tag
            const infileImportNodeMap = new Map(
                infileImportNodes.map((declNode) => {
                    const moduleSpecName = declNode.moduleSpecifier
                        .getText()
                        .slice(1, -1);
                    return [moduleSpecName, declNode];
                }),
            );
            tryAndCatch(
                () => {
                    _reinjectTsx(
                        str,
                        templateId,
                        scriptTag,
                        tsx.code,
                        infileImportNodeMap,
                    );
                },
                (err) =>
                    console.log(
                    "🚀 ~ file: svelte2tsx/infileComponents.ts:334 ~ preRecursiveProcess ~ ERROR:",
                    err,
                    ),
            );

            function _reinjectTsx(
                str: MagicString,
                templateId: string,
                mainScriptTag: Node,
                tsxCode: string,
                infileImportNodeMap: Map<string, ts.ImportDeclaration>,
            ) {
                let lines = tsxCode.trim().split("\n");
                lines = lines.slice(1); // strip leading ts <reference> declarations
                lines = lines.map((line) => line.replace(/^\s*;/, ""));
                lines = lines.slice(0, -3); // strip trailing export-statement lines

                // strip leading import-statement lines
                const first_nonImportLineIndex = lines.findIndex(
                    (line) => !line.match(/^\s*((import\b)|($))/),
                );
                if (first_nonImportLineIndex !== -1) {
                    lines = lines.slice(first_nonImportLineIndex);
                }

                const functionName = buildInfileComponentFilename(templateId);
                let insertedCode = `const ${functionName} = (\n${lines.join("\n")}\n);`;
                // append imported name assignments
                const declNode = infileImportNodeMap.get(
                    `infile:${templateId}`,
                );
                if (declNode) {
                    const importedName = declNode.importClause.name?.text;
                    if (!importedName) {
                        console.log(
                            "ERROR: cannot find import clause name for:",
                            declNode,
                        );
                        // TODO: throw error diagnostic
                    } else {
                        insertedCode += `\nconst ${importedName} = ${functionName};`;
                    }
                }

                //const appendTo = mainScriptTag.content.end; // TODO: append to 'front' of script tag
                //str.appendLeft(appendTo, `\n// ${templateId}\n` + insertedCode + '\n');
                const appendTo = mainScriptTag.content.start;
                str.prependRight(
                    appendTo,
                    `\n// ${templateId}\n` + insertedCode + "\n",
                );

                console.log(
                    14,
                    "after re-inject.",
                    ...ffilename(options.filename),
                    _index,
                    JSON.stringify(templateId),
                    {
                        str: str.toString(),
                        lines,
                        tsxCode,
                    },
                );
            }
        },
    );

    console.log(
        "🚀 ~ file: svelte2tsx/infileComponents.ts:403 ~ preRecursiveProcess:",
        ...ffilename(options.filename),
        { str: str.toString(), scriptTag },
    );

    // cut out <template> part from original.
    // we keep this later on to update str.original
    componentTemplateEntries.forEach(([templateNode, tsxInfo], _index) => {
        const { code: templateCode, tsx, precedingSplitterNode, scriptTag: templateScriptTag } = tsxInfo;

        console.log(
            11,
            "new template",
            ...ffilename(options.filename),
            _index,
            JSON.stringify(getTemplateId(templateNode)),
            {
                original: str.original.toString(),
                templateNode,
                templateScriptTag,
                templateCode,
                tsx,
                str2: str2.toString(),
            },
        );

        // 1. cut out the <template> part from 'str'
        //str2.remove(precedingSplitterNode.start, precedingSplitterNode.end);
        //str2.remove(templateNode.start, templateNode.end);
        str.remove(precedingSplitterNode.start, templateNode.end);
        str2.remove(precedingSplitterNode.start, templateNode.end);

        console.log(
            12,
            "after cutting out <template>",
            ...ffilename(options.filename),
            _index,
            JSON.stringify(getTemplateId(templateNode)),
            { str2: str2.toString(), precedingSplitterNode, templateNode },
        );
    });
    const newOriginal = str2.toString();
    console.log(13, "after cutting out <template> for all", ...ffilename(options.filename), {
        original: str.original,
        str2: str2.toString()
    });

    // remove infile: import statements from main script
    _removeInfileImports(str, infileImportNodes, scriptTag);
    function _removeInfileImports(
        str: MagicString,
        infileImportNodes: ImportDeclaration[],
        scriptTag: Node | undefined,
    ) {
        if (!scriptTag) return;
        const offset = scriptTag.content.start;
        console.log(
            "🚀 ~ file: svelte2tsx/infileComponents.ts:432 ~ preRecursiveProcess ~ _removeInfileImports:",
            ...ffilename(options.filename),
            scriptTag,
            { offset },
        );

        // remove import statements inside script tag of each template components
        infileImportNodes.forEach((declNode, _index) => {
            //console.log( '🚀 ~ file: svelte2tsx/infileComponents.ts:440 ~ preRecursiveProcess ~ declNode:', _index, declNode,);
            //const importedName = declNode.importClause.name.getText();
            //const componentDeclName = declNode.moduleSpecifier.getText().slice(1, -1);
            tryAndCatch(
                () => {
                    // TODO: we can convert it to declare, or comment it out.
                    str.remove(
                        declNode.getStart() + offset,
                        declNode.end + offset,
                    );
                },
                (err) =>
                    console.log(
                    "🚀 ~ file: svelte2tsx/infileComponents.ts:453 ~ _removeInfileImports ~ ERROR:",
                    err,
                    ),
            );
            //  console.log('removing:', declNode, { offset, range: [declNode.getStart(), declNode.end], nodeText: declNode.getFullText(), specifierText: declNode.moduleSpecifier.getText(), str: str.toString(), });
        });
        console.log(
            "🚀 ~ file: svelte2tsx/infileComponents.ts:460 ~ _removeInfileImports ~ after infile imports:",
            ...ffilename(options.filename),
            { str: str.toString(), infileImportNodes },
        );
    }

    // return the updated str
    console.log("🚀 ~ file: infileComponents.ts:495 ~ updating original afterwards:", {
        original: str.original,
        str: str.toString(),
        newOriginal,
    })
    str.original = newOriginal;
    return str;
}

function extractComponentTemplates(htmlxAst: Fragment) {
    try {
        // filter by component templates
        const componentTemplates = htmlxAst.children
            .map((node, index) => [node, index] as const)
            .filter(([node], index, entire) => {
                const isTemplateNode =
                    node.type === "Element" && node.name === "template";
                if (!isTemplateNode) return false;

                const [prevNode] = entire[index - 1];
                const hasPrecedingSplitter =
                    prevNode &&
                    prevNode.type === "Text" &&
                    prevNode.raw.match(/\s*---\s*/);
                if (!hasPrecedingSplitter) return false;

                return true;
            });

        return componentTemplates;
    } catch (err) {
        console.log(
        "🚀 ~ file: svelte2tsx/index.ts:493 ~ computeComponentTempaltes ~ ERROR:",
        err,
        );
        return [];
    }
}

// figure out a <template> tag after a Text with /\s*---\s*/ pattern,
// that contains ...
type Svelte2TsxOptions = Parameters<typeof svelte2tsx>[1];
export function computeComponentTemplateEntries(
    originalText: string,
    htmlxAst: Fragment,
    options: Svelte2TsxOptions,
) {
    try {
        const componentTemplates = extractComponentTemplates(htmlxAst);
        console.log(
        "🚀 ~ file: svelte2tsx/infileComponents.ts:511 ~ computeComponentTemplateEntries ~ componentTemplates:",
        componentTemplates,
        );

        // convert template node into tsx.
        // we reverse it in order to remove the node from 'htmlxAst.children'
        const componentTemplateEntries = componentTemplates
            .slice()
            .reverse()
            .map(([templateNode, childIndex], _index) => {
                // remove template node and preceding splitter node from 'htmlxAst'
                const [precedingSplitterNode] = htmlxAst.children.splice(
                    childIndex - 1,
                    2,
                );

                // compute tsx, code, and scriptTag
                const templateId = templateNode.attributes?.find(
                    (attr) => attr.name === "id",
                )?.value?.[0]?.raw;
                const templateCode = originalText.slice(
                    templateNode.children[0].start,
                    templateNode.children.at(-1)!.end,
                );
                const { code, tsx, scriptTag } = computeTsxInfoFromTemplateNode(
                    templateId,
                    templateCode,
                    options,
                );

                //console.log("🚀 ~ file: svelte2tsx/infileComponents.ts:541 ~ computeComponentTemplateEntries:", _index, [childIndex, templateNode], { precedingSplitterNode, code, tsx, scriptTag },);

                return [
                    templateNode,
                    { precedingSplitterNode, code, tsx, scriptTag },
                ] as const;
            });

        // purge all nodes in 'htmlxAst' that are *inside* the template node range
        componentTemplates.forEach(([templateNode]) => {
            const { start: templateStart, end: templateEnd } = templateNode;
            for (let i = htmlxAst.children.length - 1; i >= 0; i -= 1) {
                const node = (htmlxAst as TemplateNode).children[i];
                if (templateStart <= node.start && node.end <= templateEnd) {
                    //console.log('removing inner node:', i, node);
                    htmlxAst.children.splice(i, 1);
                }
            }
        });

        return componentTemplateEntries;
    } catch (err) {
        console.log(
        "🚀 ~ file: svelte2tsx/infileComponents.ts:564 ~ computeComponentTempalteEntries ~ ERROR:",
        err,
        );
        return [];
    }
}

function computeTsxInfoFromTemplateNode(
    templateId: string,
    templateCode: string,
    options: Svelte2TsxOptions,
) {
    // recursively convert each template code into tsx
    console.log("+++", 5, templateId, templateCode);
    const tsx = svelte2tsx(templateCode, {
        ...options,
        filename: templateId,
    });
    console.log("+++", 6, templateId, inspect(tsx, { depth: 4 }));

    const scriptTag = tsx.htmlAst.children.find(
        ({ type }) => type === "Script",
    ) as any as TsxScript | undefined;

    return { code: templateCode, tsx, scriptTag };
}
