import { type Program } from 'acorn';
import type { Declaration, ExportAllDeclaration, ExportDefaultDeclaration, ExportNamedDeclaration, Identifier, ImportDeclaration, ModuleDeclaration } from 'acorn';
export declare function parseModule(code: string, options?: Partial<import('acorn').Options>): Program;
export declare function parseModuleLoose(code: string, options?: Partial<import('acorn').Options>): Program;
export declare function checkInvalidJavascript(code: string): Error | null;
export declare function checkValidJavascript(code: string): boolean;
export declare function isIdentifier(node: unknown): node is Identifier;
/** find every 'import' statements */
export declare function findingImports(tree: Program): Generator<ImportDeclaration>;
export declare function findingImportDeclarations(input: string | Program): Generator<ImportDeclaration & {}>;
export declare function findingDeclarations(input: string | Program): Generator<(Declaration | ModuleDeclaration) & {}>;
export declare function findingExportDeclarations(input: string | Program): Generator<ExportAllDeclaration | ExportDefaultDeclaration | ExportNamedDeclaration>;
