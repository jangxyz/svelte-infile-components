"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findingExportDeclarations = exports.findingDeclarations = exports.findingImportDeclarations = exports.findingImports = exports.isIdentifier = exports.checkValidJavascript = exports.checkInvalidJavascript = exports.parseModuleLoose = exports.parseModule = void 0;
const acorn_1 = require("acorn");
const acorn_loose_1 = require("acorn-loose");
function parseModule(code, options = {}) {
    return (0, acorn_1.parse)(code, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ...options,
    });
}
exports.parseModule = parseModule;
function parseModuleLoose(code, options = {}) {
    return (0, acorn_loose_1.parse)(code, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ...options,
    });
}
exports.parseModuleLoose = parseModuleLoose;
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
exports.checkInvalidJavascript = checkInvalidJavascript;
function checkValidJavascript(code) {
    return !checkInvalidJavascript(code);
}
exports.checkValidJavascript = checkValidJavascript;
function isIdentifier(node) {
    return (typeof node === 'object' &&
        node !== null &&
        'type' in node &&
        node.type === 'Identifier');
}
exports.isIdentifier = isIdentifier;
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
exports.findingImports = findingImports;
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
exports.findingImportDeclarations = findingImportDeclarations;
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
exports.findingDeclarations = findingDeclarations;
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
exports.findingExportDeclarations = findingExportDeclarations;
//# sourceMappingURL=parse_utils.js.map