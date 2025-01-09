"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseModule = parseModule;
exports.parseModuleLoose = parseModuleLoose;
exports.checkInvalidJavascript = checkInvalidJavascript;
exports.checkValidJavascript = checkValidJavascript;
exports.isIdentifier = isIdentifier;
exports.findingImports = findingImports;
exports.findingImportDeclarations = findingImportDeclarations;
exports.findingDeclarations = findingDeclarations;
exports.findingExportDeclarations = findingExportDeclarations;
const acorn_1 = require("acorn");
const acorn_loose_1 = require("acorn-loose");
function parseModule(code, options = {}) {
    return (0, acorn_1.parse)(code, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ...options,
    });
}
function parseModuleLoose(code, options = {}) {
    return (0, acorn_loose_1.parse)(code, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ...options,
    });
}
function checkInvalidJavascript(code) {
    try {
        (0, acorn_1.parse)(code, { ecmaVersion: 'latest', sourceType: 'module' });
        return null;
    }
    catch (err) {
        if (err instanceof Error) {
            return err;
        }
        else {
            console.error('unrecognized reason:', err);
            throw new Error('unrecognized reason');
        }
    }
}
function checkValidJavascript(code) {
    return !checkInvalidJavascript(code);
}
function isIdentifier(node) {
    return (typeof node === 'object' &&
        node !== null &&
        'type' in node &&
        node.type === 'Identifier');
}
/** find every 'import' statements */
function* findingImports(tree) {
    if (tree.type !== 'Program')
        throw new Error(`type is not a program: ${tree.type}`);
    for (const node of tree.body) {
        if (node.type !== 'ImportDeclaration')
            continue;
        yield node;
        // TODO: find import expression
    }
}
function* findingImportDeclarations(input) {
    const tree = typeof input === 'string'
        ? (0, acorn_loose_1.parse)(input, { ecmaVersion: 'latest', sourceType: 'module' })
        : input;
    if (tree.type !== 'Program')
        throw new Error(`type is not a program: ${tree.type}`);
    for (const node of tree.body) {
        if (node.type === 'ImportDeclaration') {
            yield node;
        }
    }
}
function* findingDeclarations(input) {
    const tree = typeof input === 'string'
        ? (0, acorn_loose_1.parse)(input, { ecmaVersion: 'latest', sourceType: 'module' })
        : input;
    if (tree.type !== 'Program')
        throw new Error(`type is not a program: ${tree.type}`);
    for (const node of tree.body) {
        if (node.type.endsWith('Declaration')) {
            yield node;
        }
    }
}
function* findingExportDeclarations(input) {
    let tree;
    if (typeof input === 'string') {
        tree = (0, acorn_loose_1.parse)(input, { ecmaVersion: 'latest', sourceType: 'module' });
    }
    else {
        tree = input;
    }
    if (tree.type !== 'Program')
        throw new Error(`type is not a program: ${tree.type}`);
    for (const node of tree.body) {
        // `export const value = 1`
        if (node.type === 'ExportNamedDeclaration') {
            yield node;
        }
        // `export default x = 3`
        else if (node.type === 'ExportDefaultDeclaration') {
            yield node;
        }
        // `export * from './other.ts'`
        else if (node.type === 'ExportAllDeclaration') {
            yield node;
        }
    }
}
//# sourceMappingURL=parse_utils.js.map