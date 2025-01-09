import type { Program, Node as AcornNode, AssignmentExpression, ClassDeclaration, ExportAllDeclaration, ExportDefaultDeclaration, ExportNamedDeclaration, ExportSpecifier, FunctionDeclaration, Identifier, ImportDeclaration, ImportDefaultSpecifier, ImportNamespaceSpecifier, ImportSpecifier, VariableDeclarator, Literal, CallExpression } from 'acorn';
export type WithIdIdentifier<T> = T & {
    id: Identifier;
};
export type _WithIdIdentifier<T extends {
    id: unknown;
}> = WithProperty<T, 'id', Identifier>;
export type WithProperty<T extends {
    [k in K]: unknown;
}, K extends keyof T, V> = T & {
    [k in K]: V;
};
export declare function hasIdIdentifier<T extends AcornNode>(node: T): node is WithIdIdentifier<T>;
export declare function isVariableDeclaratorWithIdIdentifier(decl: AcornNode): decl is WithIdIdentifier<VariableDeclarator>;
/** parse code and extract locally declared names */
export declare function findLocalDeclaredNames(input: string | Program): [string, FunctionDeclaration | ClassDeclaration | ExportDefaultDeclaration | WithIdIdentifier<VariableDeclarator> | ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier | ExportSpecifier | AssignmentExpression][];
/**
 * Parse the input and retrieve tuple of import names.
 *
 * @example
 *   findImportNames("import { a1 as b1, a2 } from 'c'")
 *     // returns:
 *     [
 *       ['b1', 'a1', { type: 'ImportSpecifier', ... }],
 *       ['a2', 'a2', { type: 'ImportSpecifier', ... }],
 *     ]
 * @example
 *   findImportNames("import c1 from 'c'")
 *     // returns:
 *     [ ['c1', undefined, { type: 'ImportDefaultSpecifier', ... }] ]
 * @example
 *   findImportNames("import * as c2 from 'c'")
 *     // returns:
 *     [ ['c2', undefined, { type: 'ImportNamespaceSpecifier', ... }] ]
 */
export declare function findImportNames(input: string | Program | ImportDeclaration): [localName: string, importedName: string | undefined, node: ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier][];
/**
 * Parse code and extract export statements.
 */
export declare function findExportNames(input: string | Program): (readonly [localName: string, exportedName: string | undefined, node: readonly [ExportNamedDeclaration, FunctionDeclaration | ClassDeclaration | WithIdIdentifier<VariableDeclarator> | (ExportSpecifier & {
    local: Identifier;
    exported: Identifier;
})] | readonly [ExportDefaultDeclaration, Identifier | AssignmentExpression | Literal | CallExpression] | readonly [ExportAllDeclaration, null]])[];
export declare function findImportDeclarationAt(tree: Program, pos: number): ImportDeclaration | null;
export declare function withoutStartEndProps<T extends object & Partial<{
    start: number;
    end: number;
}>>(node: T): Omit<T, 'start' | 'end'>;
