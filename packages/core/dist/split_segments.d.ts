import { findExportNames, findImportNames, findLocalDeclaredNames } from './parse_helpers.js';
export declare class ParseError extends Error {
    error: Error | null;
    constructor(input: string | Error);
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
export declare function splitSegmentsWithPosition(codeInput: string): [Segment, Segment[]];
export {};
