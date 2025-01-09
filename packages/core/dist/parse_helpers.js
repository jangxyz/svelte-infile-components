"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasIdIdentifier = hasIdIdentifier;
exports.isVariableDeclaratorWithIdIdentifier = isVariableDeclaratorWithIdIdentifier;
exports.findLocalDeclaredNames = findLocalDeclaredNames;
exports.findImportNames = findImportNames;
exports.findExportNames = findExportNames;
exports.findImportDeclarationAt = findImportDeclarationAt;
exports.withoutStartEndProps = withoutStartEndProps;
const parse_utils_js_1 = require("./parse_utils.js");
const utils_js_1 = require("./utils/utils.js");
function hasIdentifier(node, field) {
    return field in node && (0, parse_utils_js_1.isIdentifier)(node[field]);
}
function hasIdIdentifier(node) {
    return 'id' in node && (0, parse_utils_js_1.isIdentifier)(node.id);
}
function isVariableDeclaratorWithIdIdentifier(decl) {
    return decl.type === 'VariableDeclarator' && hasIdIdentifier(decl);
}
/** parse code and extract locally declared names */
function findLocalDeclaredNames(input) {
    const localNames = [];
    for (const declNode of (0, parse_utils_js_1.findingDeclarations)(input)) {
        // Declarataion: Variable, Function, Class
        if (declNode.type === 'VariableDeclaration') {
            const decls = declNode.declarations.filter(isVariableDeclaratorWithIdIdentifier);
            decls.forEach((decl) => {
                localNames.push([decl.id.name, decl]);
            });
        }
        else if (declNode.type === 'FunctionDeclaration') {
            localNames.push([declNode.id.name, declNode]);
        }
        else if (declNode.type === 'ClassDeclaration') {
            localNames.push([declNode.id.name, declNode]);
        }
        // Module relateds types
        else if (declNode.type === 'ImportDeclaration') {
            declNode.specifiers.forEach((specf) => {
                if (specf.type === 'ImportSpecifier') {
                    if (specf.local) {
                        localNames.push([specf.local.name, specf]);
                    }
                    else if ((0, parse_utils_js_1.isIdentifier)(specf.imported)) {
                        localNames.push([specf.imported.name, specf]);
                    }
                }
                else if (specf.type === 'ImportDefaultSpecifier') {
                    localNames.push([specf.local.name, specf]);
                }
                else if (specf.type === 'ImportNamespaceSpecifier') {
                    localNames.push([specf.local.name, specf]);
                }
            });
        }
        // `export ...`
        else if (declNode.type === 'ExportNamedDeclaration') {
            if (declNode.declaration) {
                const declaration = declNode.declaration;
                // `export const value = 1`
                if (declaration.type === 'VariableDeclaration') {
                    // we use filter because we can declare multiple variables
                    const decls = declaration.declarations.filter(isVariableDeclaratorWithIdIdentifier);
                    decls.forEach((decl) => {
                        localNames.push([decl.id.name, decl]);
                    });
                }
                // `export function getValue() { }`
                else if (declaration.type === 'FunctionDeclaration') {
                    localNames.push([declaration.id.name, declaration]);
                }
                // `export class C { }`
                else if (declaration.type === 'ClassDeclaration') {
                    localNames.push([declaration.id.name, declaration]);
                }
            }
            // `export { value as values }`
            else if (declNode.specifiers) {
                declNode.specifiers.forEach((specf) => {
                    if (specf.type === 'ExportSpecifier') {
                        if ((0, parse_utils_js_1.isIdentifier)(specf.local) && (0, parse_utils_js_1.isIdentifier)(specf.exported))
                            localNames.push([specf.local.name, specf]);
                    }
                });
            }
        }
        // `export default x = 3`
        else if (declNode.type === 'ExportDefaultDeclaration') {
            const decl = declNode.declaration;
            if (decl.type === 'AssignmentExpression' && (0, parse_utils_js_1.isIdentifier)(decl.left)) {
                localNames.push([decl.left.name, decl]);
            }
        }
        // `export * from './other.ts'`
        else if (declNode.type === 'ExportAllDeclaration') {
            // no
        }
    }
    return localNames;
}
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
function findImportNames(input) {
    const importNames = [];
    const importDecls = typeof input === 'string' || input.type === 'Program'
        ? (0, parse_utils_js_1.findingImportDeclarations)(input)
        : [input];
    for (const importNode of importDecls) {
        importNode.specifiers.forEach((specf) => {
            // `import { a1 as b1, a2 } from 'c'`
            if (specf.type === 'ImportSpecifier') {
                importNames.push([
                    specf.local.name,
                    (0, parse_utils_js_1.isIdentifier)(specf.imported) ? specf.imported.name : undefined,
                    specf,
                ]);
            }
            // `import c1 from 'c'`
            else if (specf.type === 'ImportDefaultSpecifier') {
                importNames.push([specf.local.name, undefined, specf]);
            }
            // `import * as c2 from 'c'`
            else if (specf.type === 'ImportNamespaceSpecifier') {
                importNames.push([specf.local.name, undefined, specf]);
            }
        });
    }
    return importNames;
}
/**
 * Parse code and extract export statements.
 */
function findExportNames(input) {
    const exportedNameTuples = [];
    for (const node of (0, parse_utils_js_1.findingExportDeclarations)(input)) {
        try {
            const extracted = extractExportNameTuples(node);
            //console.log( '🚀 ~ file: parse_helpers.ts:235 ~ findExportNames ~ extracted:', extracted, node,);
            exportedNameTuples.push(...extracted);
        }
        catch (err) {
            console.error('Exception thrown while trying to extract ExportNameTuples for:', JSON.stringify({ node, input }));
            throw err;
        }
    }
    return exportedNameTuples;
}
function extractExportNameTuples(node) {
    if (node.type === 'ExportNamedDeclaration') {
        // node itself is declared
        if (node.declaration) {
            const declaration = node.declaration;
            // `export const value = 1`
            if (declaration.type === 'VariableDeclaration') {
                // we use filter because we can declare multiple variables
                const decls = declaration.declarations.filter(isVariableDeclaratorWithIdIdentifier);
                return decls.map((decl) => typed(decl.id.name, undefined, [node, decl]));
            }
            // `export function getValue() { }`
            else if (declaration.type === 'FunctionDeclaration') {
                return [typed(declaration.id.name, undefined, [node, declaration])];
            }
            // `export class C { }`
            else if (declaration.type === 'ClassDeclaration') {
                return [typed(declaration.id.name, undefined, [node, declaration])];
            }
            else {
                // TODO: complete this
                (0, utils_js_1.unreachable)(`does not handle ${node.type}`);
            }
        }
        // exporting an already declared node
        // `export { value as values }`
        else if (node.specifiers) {
            return (node.specifiers
                .map((specf) => {
                if (specf.type === 'ExportSpecifier') {
                    //if (isIdentifier(specf.local) && isIdentifier(specf.exported)) {
                    if (hasIdentifier(specf, 'local') &&
                        hasIdentifier(specf, 'exported')) {
                        return typed(specf.local.name, specf.exported.name, [
                            node,
                            specf,
                        ]);
                    }
                }
            })
                //.filter(Boolean)
                .filter(utils_js_1.nonNullable));
        }
        else {
            // TODO: complete this
            (0, utils_js_1.unreachable)(`does not handle ${node.type}`);
        }
    }
    // `export default x = 3`
    else if (node.type === 'ExportDefaultDeclaration') {
        const decl = node.declaration;
        if (decl.type === 'AssignmentExpression' && (0, parse_utils_js_1.isIdentifier)(decl.left)) {
            return [typed(decl.left.name, 'default', [node, decl])];
        }
        else if (decl.type === 'Identifier') {
            return [typed(decl.name, 'default', [node, decl])];
        }
        else if (decl.type === 'Literal') {
            return [typed(decl.raw, 'default', [node, decl])];
        }
        else if (decl.type === 'CallExpression') {
            return [typed('', 'default', [node, decl])];
        }
        else {
            // TODO: complete this
            console.error('HANDLE THIS:', decl, { node });
            (0, utils_js_1.unreachable)(`does not handle ${decl.type}`);
        }
    }
    // `export * from './other.ts'`
    else if (node.type === 'ExportAllDeclaration') {
        // TODO: you should expand '*'
        return [typed(node.source.raw, '*', [node, null])];
    }
    else {
        // TODO: complete this
        (0, utils_js_1.unreachable)('this needs to handled');
    }
    ///
    function typed(localName, exportedName, [_node, spec]) {
        return [localName, exportedName, [_node, spec]];
    }
}
function findImportDeclarationAt(tree, pos) {
    //return findNodeAt(tree, pos, null, 'ImportDeclaration');
    for (const node of tree.body) {
        if (node.start <= pos && pos < node.end) {
            if (node.type === 'ImportDeclaration') {
                return node;
            }
        }
    }
    return null;
}
function withoutStartEndProps(node) {
    const { start, end, ...newNode } = node;
    // Recursively create new objects for the node's children
    for (const _key in newNode) {
        const key = _key;
        const value = newNode[key];
        if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
                newNode[key] = value.map((item) => {
                    if (typeof item === 'object' && item !== null) {
                        return withoutStartEndProps(item);
                    }
                    return item;
                });
            }
            else {
                newNode[key] = withoutStartEndProps(value);
            }
        }
    }
    return newNode;
}
//# sourceMappingURL=parse_helpers.js.map