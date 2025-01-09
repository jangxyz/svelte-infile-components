import type {
  Program,
  Node as AcornNode,
  AssignmentExpression,
  ClassDeclaration,
  ExportAllDeclaration,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  ExportSpecifier,
  FunctionDeclaration,
  Identifier,
  ImportDeclaration,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  ImportSpecifier,
  VariableDeclarator,
  Literal,
  CallExpression,
} from 'acorn';
import {
  findingDeclarations,
  findingExportDeclarations,
  findingImportDeclarations,
  isIdentifier,
} from './parse_utils.js';
import { nonNullable, unreachable } from './utils/utils.js';

export type WithIdIdentifier<T> = T & { id: Identifier };
export type _WithIdIdentifier<T extends { id: unknown }> = WithProperty<
  T,
  'id',
  Identifier
>;
export type WithProperty<
  T extends { [k in K]: unknown },
  K extends keyof T,
  V,
> = T & {
  [k in K]: V;
};

function hasIdentifier<T extends AcornNode, K extends keyof T>(
  node: T,
  field: K,
): node is WithProperty<T, K, Identifier> {
  return field in node && isIdentifier(node[field]);
}

export function hasIdIdentifier<T extends AcornNode>(
  node: T,
): node is WithIdIdentifier<T> {
  return 'id' in node && isIdentifier(node.id);
}

export function isVariableDeclaratorWithIdIdentifier(
  decl: AcornNode,
): decl is WithIdIdentifier<VariableDeclarator> {
  return decl.type === 'VariableDeclarator' && hasIdIdentifier(decl);
}

/** parse code and extract locally declared names */
export function findLocalDeclaredNames(input: string | Program) {
  const localNames = [] as [
    string,
    (
      | WithIdIdentifier<VariableDeclarator>
      | FunctionDeclaration
      | ClassDeclaration
      | ImportSpecifier
      | ImportDefaultSpecifier
      | ImportNamespaceSpecifier
      | ExportSpecifier
      | ExportDefaultDeclaration
      | AssignmentExpression
    ),
  ][];

  for (const declNode of findingDeclarations(input)) {
    // Declarataion: Variable, Function, Class

    if (declNode.type === 'VariableDeclaration') {
      const decls = declNode.declarations.filter(
        isVariableDeclaratorWithIdIdentifier,
      );
      decls.forEach((decl) => {
        localNames.push([decl.id.name, decl] as const);
      });
    } else if (declNode.type === 'FunctionDeclaration') {
      localNames.push([declNode.id.name, declNode] as const);
    } else if (declNode.type === 'ClassDeclaration') {
      localNames.push([declNode.id.name, declNode] as const);
    }

    // Module relateds types
    else if (declNode.type === 'ImportDeclaration') {
      declNode.specifiers.forEach((specf) => {
        if (specf.type === 'ImportSpecifier') {
          if (specf.local) {
            localNames.push([specf.local.name, specf] as const);
          } else if (isIdentifier(specf.imported)) {
            localNames.push([specf.imported.name, specf] as const);
          }
        } else if (specf.type === 'ImportDefaultSpecifier') {
          localNames.push([specf.local.name, specf] as const);
        } else if (specf.type === 'ImportNamespaceSpecifier') {
          localNames.push([specf.local.name, specf] as const);
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
          const decls = declaration.declarations.filter(
            isVariableDeclaratorWithIdIdentifier,
          );
          decls.forEach((decl) => {
            localNames.push([decl.id.name, decl] as const);
          });
        }
        // `export function getValue() { }`
        else if (declaration.type === 'FunctionDeclaration') {
          localNames.push([declaration.id.name, declaration] as const);
        }
        // `export class C { }`
        else if (declaration.type === 'ClassDeclaration') {
          localNames.push([declaration.id.name, declaration] as const);
        }
      }
      // `export { value as values }`
      else if (declNode.specifiers) {
        declNode.specifiers.forEach((specf) => {
          if (specf.type === 'ExportSpecifier') {
            if (isIdentifier(specf.local) && isIdentifier(specf.exported))
              localNames.push([specf.local.name, specf] as const);
          }
        });
      }
    }
    // `export default x = 3`
    else if (declNode.type === 'ExportDefaultDeclaration') {
      const decl = declNode.declaration;
      if (decl.type === 'AssignmentExpression' && isIdentifier(decl.left)) {
        localNames.push([decl.left.name, decl] as const);
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
export function findImportNames(input: string | Program | ImportDeclaration) {
  const importNames = [] as [
    localName: string,
    importedName: string | undefined,
    node: ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier,
  ][];

  const importDecls =
    typeof input === 'string' || input.type === 'Program'
      ? findingImportDeclarations(input)
      : [input];

  for (const importNode of importDecls) {
    importNode.specifiers.forEach((specf) => {
      // `import { a1 as b1, a2 } from 'c'`
      if (specf.type === 'ImportSpecifier') {
        importNames.push([
          specf.local.name,
          isIdentifier(specf.imported) ? specf.imported.name : undefined,
          specf,
        ] as const);
      }
      // `import c1 from 'c'`
      else if (specf.type === 'ImportDefaultSpecifier') {
        importNames.push([specf.local.name, undefined, specf] as const);
      }
      // `import * as c2 from 'c'`
      else if (specf.type === 'ImportNamespaceSpecifier') {
        importNames.push([specf.local.name, undefined, specf] as const);
      }
    });
  }

  return importNames;
}

/**
 * Parse code and extract export statements.
 */
export function findExportNames(input: string | Program) {
  const exportedNameTuples: (readonly [
    localName: string,
    exportedName: string | undefined,
    node:
      | readonly [
          ExportNamedDeclaration,
          (
            | WithIdIdentifier<VariableDeclarator>
            | FunctionDeclaration
            | ClassDeclaration
            | (ExportSpecifier & { local: Identifier; exported: Identifier })
          ),
        ]
      | readonly [
          ExportDefaultDeclaration,
          AssignmentExpression | Identifier | Literal | CallExpression,
        ]
      | readonly [ExportAllDeclaration, null],
    //ExtractedExportNameNode,
  ])[] = [];

  for (const node of findingExportDeclarations(input)) {
    try {
      const extracted = extractExportNameTuples(node);
      //console.log( '🚀 ~ file: parse_helpers.ts:235 ~ findExportNames ~ extracted:', extracted, node,);
      exportedNameTuples.push(...extracted);
    } catch (err) {
      console.error(
        'Exception thrown while trying to extract ExportNameTuples for:',
        JSON.stringify({ node, input }),
      );
      throw err;
    }
  }

  return exportedNameTuples;
}

// TODO: complete implementing every unreachables, it may bite on the future.
type ExtractedExportNameNode = ReturnType<typeof extractExportNameTuples>[2];
function extractExportNameTuples(
  node:
    | ExportNamedDeclaration
    | ExportDefaultDeclaration
    | ExportAllDeclaration,
) {
  type ThisNode = typeof node;

  if (node.type === 'ExportNamedDeclaration') {
    // node itself is declared
    if (node.declaration) {
      const declaration = node.declaration;
      // `export const value = 1`
      if (declaration.type === 'VariableDeclaration') {
        // we use filter because we can declare multiple variables
        const decls = declaration.declarations.filter(
          isVariableDeclaratorWithIdIdentifier,
        );
        return decls.map((decl) =>
          typed(decl.id.name, undefined, [node, decl]),
        );
      }
      // `export function getValue() { }`
      else if (declaration.type === 'FunctionDeclaration') {
        return [typed(declaration.id.name, undefined, [node, declaration])];
      }
      // `export class C { }`
      else if (declaration.type === 'ClassDeclaration') {
        return [typed(declaration.id.name, undefined, [node, declaration])];
      } else {
        // TODO: complete this
        unreachable(`does not handle ${node.type}`);
      }
    }
    // exporting an already declared node
    // `export { value as values }`
    else if (node.specifiers) {
      return (
        node.specifiers
          .map((specf) => {
            if (specf.type === 'ExportSpecifier') {
              //if (isIdentifier(specf.local) && isIdentifier(specf.exported)) {
              if (
                hasIdentifier(specf, 'local') &&
                hasIdentifier(specf, 'exported')
              ) {
                return typed(specf.local.name, specf.exported.name, [
                  node,
                  specf,
                ]);
              }
            }
          })
          //.filter(Boolean)
          .filter(nonNullable)
      );
    } else {
      // TODO: complete this
      unreachable(`does not handle ${node.type}`);
    }
  }
  // `export default x = 3`
  else if (node.type === 'ExportDefaultDeclaration') {
    const decl = node.declaration;
    if (decl.type === 'AssignmentExpression' && isIdentifier(decl.left)) {
      return [typed(decl.left.name, 'default', [node, decl])];
    } else if (decl.type === 'Identifier') {
      return [typed(decl.name, 'default', [node, decl])];
    } else if (decl.type === 'Literal') {
      return [typed(decl.raw!, 'default', [node, decl])];
    } else if (decl.type === 'CallExpression') {
      return [typed('', 'default', [node, decl])];
    } else {
      // TODO: complete this
      console.error('HANDLE THIS:', decl, { node });
      unreachable(`does not handle ${decl.type}`);
    }
  }
  // `export * from './other.ts'`
  else if (node.type === 'ExportAllDeclaration') {
    // TODO: you should expand '*'
    return [typed(node.source.raw!, '*', [node, null])];
  } else {
    // TODO: complete this
    unreachable('this needs to handled');
  }

  ///

  function typed<
    E extends string | undefined,
    N extends ThisNode,
    S extends AcornNode | null,
  >(localName: string, exportedName: E, [_node, spec]: [_node: N, spec: S]) {
    return [localName, exportedName, [_node, spec]] as [string, E, [N, S]];
  }
}

export function findImportDeclarationAt(
  tree: Program,
  pos: number,
): ImportDeclaration | null {
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

export function withoutStartEndProps<
  //T extends AcornNode
  T extends object & Partial<{ start: number; end: number }>,
>(node: T): Omit<T, 'start' | 'end'> {
  const { start, end, ...newNode } = node;

  // Recursively create new objects for the node's children
  for (const _key in newNode) {
    const key = _key as keyof typeof newNode;
    const value = newNode[key];
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        newNode[key] = value.map((item) => {
          if (typeof item === 'object' && item !== null) {
            return withoutStartEndProps(item);
          }
          return item;
        }) as any;
      } else {
        newNode[key] = withoutStartEndProps(value) as any;
      }
    }
  }

  return newNode;
}
