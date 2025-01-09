import { parse, type Program } from 'acorn';
import { parse as looseParse } from 'acorn-loose';

import type {
  Declaration,
  ExportAllDeclaration,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  Identifier,
  ImportDeclaration,
  ModuleDeclaration,
} from 'acorn';

export function parseModule(
  code: string,
  options: Partial<import('acorn').Options> = {},
) {
  return parse(code, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ...options,
  });
}

export function parseModuleLoose(
  code: string,
  options: Partial<import('acorn').Options> = {},
) {
  return looseParse(code, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ...options,
  });
}

export function checkInvalidJavascript(code: string): Error | null {
  try {
    parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
    return null;
  } catch (err) {
    if (err instanceof Error) {
      return err;
    } else {
      console.error('unrecognized reason:', err);
      throw new Error('unrecognized reason');
    }
  }
}

export function checkValidJavascript(code: string) {
  return !checkInvalidJavascript(code);
}

export function isIdentifier(node: unknown): node is Identifier {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    node.type === 'Identifier'
  );
}

/** find every 'import' statements */
export function* findingImports(tree: Program): Generator<ImportDeclaration> {
  if (tree.type !== 'Program')
    throw new Error(`type is not a program: ${tree.type}`);

  for (const node of tree.body) {
    if (node.type !== 'ImportDeclaration') continue;
    yield node;

    // TODO: find import expression
  }
}

export function* findingImportDeclarations(
  input: string | Program,
): Generator<ImportDeclaration & {}> {
  const tree: Program =
    typeof input === 'string'
      ? looseParse(input, { ecmaVersion: 'latest', sourceType: 'module' })
      : input;

  if (tree.type !== 'Program')
    throw new Error(`type is not a program: ${tree.type}`);

  for (const node of tree.body) {
    if (node.type === 'ImportDeclaration') {
      yield node as ImportDeclaration;
    }
  }
}

export function* findingDeclarations(
  input: string | Program,
): Generator<(Declaration | ModuleDeclaration) & {}> {
  const tree: Program =
    typeof input === 'string'
      ? looseParse(input, { ecmaVersion: 'latest', sourceType: 'module' })
      : input;

  if (tree.type !== 'Program')
    throw new Error(`type is not a program: ${tree.type}`);

  for (const node of tree.body) {
    if (node.type.endsWith('Declaration')) {
      yield node as Declaration | ModuleDeclaration;
    }
  }
}

export function* findingExportDeclarations(
  input: string | Program,
): Generator<
  ExportAllDeclaration | ExportDefaultDeclaration | ExportNamedDeclaration
> {
  let tree: Program;
  if (typeof input === 'string') {
    tree = looseParse(input, { ecmaVersion: 'latest', sourceType: 'module' });
  } else {
    tree = input;
  }

  if (tree.type !== 'Program')
    throw new Error(`type is not a program: ${tree.type}`);

  for (const node of tree.body) {
    // `export const value = 1`
    if (node.type === 'ExportNamedDeclaration') {
      yield node as ExportNamedDeclaration;
    }
    // `export default x = 3`
    else if (node.type === 'ExportDefaultDeclaration') {
      yield node as ExportDefaultDeclaration;
    }
    // `export * from './other.ts'`
    else if (node.type === 'ExportAllDeclaration') {
      yield node as ExportAllDeclaration;
    }
  }
}
