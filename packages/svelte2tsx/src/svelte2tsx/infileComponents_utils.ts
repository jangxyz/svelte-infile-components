import ts from "typescript";
import { TemplateNode } from "svelte/types/compiler/interfaces";
import type { TsxScript } from "./infileComponents";

//

export function tryAndCatch<T>(
    callback: () => T,
    catchError?: (err: unknown) => void,
): [T | undefined, null | unknown] {
    let result: T | undefined = undefined;
    let reason: null | unknown = null;
    try {
        result = callback();
    } catch (err) {
        reason = err;
        catchError?.(err);
    } finally {
        return [result, reason] as const;
    }
}

export function filename(filepath: string | undefined) {
    if (!filepath) return filepath;
    return filepath.split("/").at(-1);
}

export function ffilename(filepath: string | undefined) {
    if (!filepath) return filepath;
    return [JSON.stringify(filepath.split("/").at(-1)), filepath];
}

export function findLastImportDecl(
    templateNode: TemplateNode,
    { code: _templateCode, scriptTag }: { code: string; scriptTag?: TsxScript },
) {
    const templateId = templateNode.attributes?.find(
        (attr) => attr.name === "id",
    )?.value?.[0]?.raw;

    //const insertedCode = `const ${templateId.replace(/[.]svelte/, '')} = ${tsx.code.trim().split('\n').slice(2, -3).join('\n')};`;
    //modifyCode(templateNode, code, tsx, scriptTsAst);
    //function modifyCode(templateNode: TemplateNode, templateCode: string, tsx: ReturnType<typeof svelte2tsx>, scriptTsAst: ts.SourceFile) {

    // Modify component template code and wrap it as a function

    const tsCode = scriptTag?.content.value;
    //console.log( '🚀 ~ file: svelte2tsx/index.ts:613 ~ findLastImportDecl ~ tsCode:', tsCode, { scriptTag },);
    if (!tsCode) return [];

    // move import statements to somewhere else.
    const templateTsAst = ts.createSourceFile(
        templateId,
        tsCode,
        //code.trim().split('\n').join('\n'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    );

    //const astOffset = templateNode.children[0].start;
    //const astOffset = templateNode.start + str.original.slice(templateNode.start).indexOf('>') + 1;
    //console.log('🚀 ~ file: svelte2tsx/index.ts:628 ~ findLastImportDecl:', JSON.stringify(templateId), { tsCode, templateCode, templateNode, templateTsAst, templateStart: templateNode.start });
    //scriptTag,
    //scriptTsAst,
    //astOffset,
    //'astOffsetStart...': str.original.slice(astOffset, templateNode.end),

    //let lastImportDecl: ts.ImportDeclaration | null = null;
    let importNodes: ts.ImportDeclaration[] = [];
    templateTsAst.forEachChild((n) => walk_findImportNodes(n, templateTsAst));

    function walk_findImportNodes(node: ts.Node, _parent: ts.Node) {
        if (ts.isImportDeclaration(node)) {
            console.log(
                "🚀 ~ file: svelte2tsx/infileComponents.ts:641 ~ findLastImportDecl ~ walk_findImportNodes:",
                node,
            );
            importNodes.push(node);
        }
    }

    return importNodes;
}

export function findFromAst<T extends ts.Node>(
    scriptTsAst: ts.SourceFile,
    callback: (node: ts.Node) => boolean,
): T | null {
    let target: T | null = null;
    scriptTsAst.forEachChild((node) => {
        if (callback(node)) {
            if (!target) {
                target = node as T;
            }
        }
    });
    return target;
}

export function findLastFromAst<T extends ts.Node>(
    scriptTsAst: ts.SourceFile,
    callback: (node: ts.Node) => boolean,
): T | null {
    let target: T | null = null;
    scriptTsAst.forEachChild((node) => {
        if (callback(node)) {
            target = node as T;
        }
    });
    return target;
}

export function filterFromAst<T extends ts.Node>(
    scriptTsAst: ts.SourceFile,
    callback: (node: ts.Node) => boolean,
): T[] {
    let targets: T[] = [];
    scriptTsAst.forEachChild((node) => {
        if (callback(node)) {
            targets.push(node as T);
        }
    });
    return targets;
}

export function findInfileImportNodes(scriptTsAst: ts.SourceFile | undefined) {
    if (!scriptTsAst) return [];
    return filterFromAst<ts.ImportDeclaration>(scriptTsAst, (declNode) => {
        if (!ts.isImportDeclaration(declNode)) return false;

        //console.log("ImportDeclaration:", declNode, {
        //    importClauseText: declNode.importClause?.getText(),
        //    importClauseNameText: declNode.importClause?.name?.getText(),
        //    moduleSpecifierText: declNode.moduleSpecifier?.getText(),
        //    //moduleSpecifierFullText: declNode.moduleSpecifier.getFullText(),
        //});

        const specifierText = declNode.moduleSpecifier.getText();
        return specifierText.slice(1, -1).startsWith("infile:");
    });
}
