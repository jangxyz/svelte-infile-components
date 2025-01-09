import InfileCounter from 'infile:Counter.svelte';

import * as vscode from 'vscode';
import { parse, type ParserOptions } from '@typescript-eslint/parser';
import type { TSESTree } from '@typescript-eslint/typescript-estree';
//import { walk } from 'zimmerframe';

import { getDefaultLogger } from '../utils/logger.js';
import { EXIT, simpleTraverse, SKIP, type TraverseCallback } from './traverse';
import { formatNodeAsTuple, positionToOffset } from './parse_helpers';

export type TsNode = TSESTree.Node;

export type DeclarationType =
    | TSESTree.ImportDeclaration
    | TSESTree.ExportAllDeclaration
    | TSESTree.ExportDefaultDeclaration
    | TSESTree.ExportNamedDeclaration
    | TSESTree.ClassDeclaration
    | TSESTree.FunctionDeclaration
    | TSESTree.VariableDeclaration
    | TSESTree.TSCallSignatureDeclaration
    | TSESTree.TSConstructSignatureDeclaration
    | TSESTree.TSEnumDeclaration
    | TSESTree.TSImportEqualsDeclaration
    | TSESTree.TSInterfaceDeclaration
    | TSESTree.TSModuleDeclaration
    | TSESTree.TSNamespaceExportDeclaration
    | TSESTree.TSTypeAliasDeclaration
    | TSESTree.TSTypeParameterDeclaration;

export function parseTypescript(text: string, options?: ParserOptions) {
    return parse(text, {
        ecmaVersion: 'latest',
        sourceType: 'module', // Set the source type to 'module' or 'script'
        range: true,
        ecmaFeatures: {
            jsx: true // Enable JSX parsing if needed
        },
        // Enable TypeScript-specific parsing
        // This requires type-aware linting for advanced features
        //tsconfigRootDir: process.cwd(),
        //project: './tsconfig.json', // Path to your tsconfig.json if type-aware parsing is needed
        ...options
    });
}

export function walkTree(
    node: TsNode,
    callback: TraverseCallback,
    { parent = true, reverse = false } = {}
) {
    //const logger = getDefaultLogger();
    simpleTraverse(
        node,
        {
            enter(node, parentNode, childIndex, siblingNodes, depth) {
                return callback(node, parentNode, childIndex, siblingNodes, depth);
            }
            //visitors: {
            //  ImportDeclaration(node) {
            //    logger.log(node.type);
            //  },
            //},
        },
        { parent, reverse }
    );
}

export function walkChildren(
    node: TsNode,
    callback: TraverseCallback,
    { parent = true, reverse = false } = {}
) {
    simpleTraverse(
        node,
        {
            enter(node, parentNode, childIndex, siblingNodes, depth) {
                const result = callback(node, parentNode, childIndex, siblingNodes, depth);
                if (depth === 0) return result;
                else if (depth === 1) {
                    return result ?? SKIP;
                }
                // reached further, stop
                else return EXIT;
            }
        },
        { parent, reverse }
    );
}

export function isSection(node: TsNode): node is DeclarationType {
    const nodeType = node.type;

    return (
        nodeType.endsWith('Declaration') ||
        nodeType.endsWith('Expression') || // ???
        //nodeType === 'ExpressionStatement' ||
        nodeType.endsWith('Statement') ||
        //|| nodeType === 'BlockStatement'
        nodeType === 'MethodDefinition'
    );
}

/** @deprecated */
function walkSectionNodes(node: TsNode, callback: (node: DeclarationType) => void) {
    //const logger = getDefaultLogger();
    //logger.log('🚀 ~ file: parse.ts:33 ~ node:', node.type, node);

    simpleTraverse(
        node,
        {
            enter(node) {
                if (isSection(node)) {
                    callback(node);
                    return SKIP;
                }
            }
        },
        { parent: true }
    );
}

/** @deprecated */
export function _getCurrentNodeFromPosition(
    position: vscode.Position,
    text: string,
    lineOffsets: number[]
) {
    const posOffset = positionToOffset(position, lineOffsets);
    return getCurrentNodeFromOffset(posOffset, text, { direction: 'forward' });
}

export function getCurrentNodeFromOffset(
    posOffset: number,
    text: string,
    {
        direction,
        includeBetweenNextNode,
        includeBetweenPrevNode,
        includeBlockStartPit,
        includeBlockEndPit
    }: {
        direction?: 'forward' | 'backward';
        includeBetweenNextNode?: boolean;
        includeBetweenPrevNode?: boolean;
        includeBlockStartPit?: boolean;
        includeBlockEndPit?: boolean;
    } = {
        direction: 'forward'
    }
) {
    const console = getDefaultLogger();

    const _fmtNode = (node: TsNode | null, options = { lines: 1 }) =>
        formatNodeAsTuple(node, text, options) ?? [null];

    includeBetweenNextNode ??= direction === 'forward';
    includeBetweenPrevNode ??= direction === 'backward';
    includeBlockStartPit ??= direction === 'forward';
    includeBlockEndPit ??= direction === 'backward';

    const tsTree = parseTypescript(text);

    let posNode: TsNode | null = null;
    let posNodesChain: [
        TsNode,
        number,
        {
            isInRange: boolean;
            isInBetweenNextNode: boolean;
            isInBetweenPrevNode: boolean;
            isInBlockStartPit: boolean;
            mayBeInBlockEndPit: boolean;
        }
    ][] = [];
    walkTree(tsTree, (node, _parentNode, childIndex, siblingNodes, depth) => {
        if (isSection(node)) {
            const [start, end] = node.range;
            const lastCapturedNodeTuple = posNodesChain.at(-1);

            // check range
            const isInRange = start <= posOffset && posOffset < end;

            // check nearby
            const hasSibling = siblingNodes && childIndex !== undefined;
            const isInBetweenNextNode = hasSibling
                ? isBetweenNodes(posOffset, node, siblingNodes[childIndex + 1])
                : false;
            const isInBetweenPrevNode = hasSibling
                ? isBetweenNodes(posOffset, siblingNodes[childIndex - 1], node)
                : false;

            // check block start & end
            const isInBlockStartPit = Boolean(
                (childIndex === undefined || childIndex === 0) &&
                    isPositionedStartOfBlock(posOffset, node, text)
            );
            // is incomplete. may be updated by other nodes
            const mayBeInBlockEndPit = Boolean(
                !siblingNodes ||
                    (childIndex === siblingNodes.length - 1 &&
                        isPositionedEndOfBlock(posOffset, node, text))
            );

            const nodeCaptured = Boolean(
                isInRange ||
                    //(direction === 'forward'
                    //  ? // forward
                    //    isInBetweenNextNode || isInBlockStartPart
                    //  : // backward
                    //    isInBetweenPrevNode || isInBlockEndPart),
                    (includeBetweenNextNode && isInBetweenNextNode) ||
                    (includeBetweenPrevNode && isInBetweenPrevNode) ||
                    (includeBlockStartPit && isInBlockStartPit) ||
                    (includeBlockEndPit && mayBeInBlockEndPit)
            );

            if (nodeCaptured) {
                posNode = node;
                posNodesChain.push([
                    posNode,
                    depth,
                    {
                        isInRange,
                        isInBetweenNextNode,
                        isInBetweenPrevNode,
                        isInBlockStartPit,
                        mayBeInBlockEndPit
                    }
                ] as const);
            }

            // check for early stops if node has been captured.
            if (lastCapturedNodeTuple) {
                const [_lastNode, lastNodeDepth, capturedCause] = lastCapturedNodeTuple;
                // if we have a prev node that has lower depth,
                // it means we are on another branch. stop.
                if (depth < lastNodeDepth) {
                    //console.log('EXIT', `depth=${depth}`, { lastNodeTuple: lastCapturedNodeTuple, });
                    return EXIT;
                }
                //console.log( '🚀 ~ file: parser.ts:238 ~ depth:', depth === lastNodeDepth && !hasOnlyInBlockEndPit(capturedCause), { depth, lastNodeDepth, hasOnlyInBlockEndPit: hasOnlyInBlockEndPit(capturedCause), },);
                //
                if (depth === lastNodeDepth && !hasOnlyInBlockEndPit(capturedCause)) {
                    //console.log('EXIT2', `depth=${depth}`, { lastNodeTuple: lastCapturedNodeTuple, node: _fmtNode(node), });
                    return EXIT;
                }

                ///

                function hasOnlyInBlockEndPit({
                    isInRange,
                    isInBetweenNextNode,
                    isInBetweenPrevNode,
                    isInBlockStartPit,
                    mayBeInBlockEndPit
                }: typeof capturedCause) {
                    if (!mayBeInBlockEndPit) return false;
                    return (
                        !isInRange &&
                        !isInBetweenNextNode &&
                        !isInBetweenPrevNode &&
                        !isInBlockStartPit
                    );
                }
            }

            //if (nodeCaptured) {
            //  console.log.options({ depth: 2 })( 'ENTER', `depth=${depth}`, nodeCaptured, posOffset, ..._fmtNode(node, { lines: 3 }), { _parentNode: _fmtNode(_parentNode ?? null, { lines: 3 }), childIndex, hasSibling, siblingNodesLength: siblingNodes?.length, isInRange, isInBetweenPrevNode, isInBetweenNextNode, isInBlockStartPit, mayBeInBlockEndPit, includeBetweenNextNode, includeBetweenPrevNode, includeBlockStartPit, includeBlockEndPit, lastCapturedNodeTuple, posNodesChainLength: posNodesChain.length, },);
            //}

            // do not bother diving in unless in range,
            // even when in-between or pit-related options are on
            if (!isInRange) return SKIP;
        }
    });

    //console.log( '🚀 ~ file: parse.ts:253 ~ posNode:', ...(formatNodeAsTuple(posNode, text) ?? []), { posNodesChain },);

    return [posNode as TsNode | null, posNodesChain] as const;
}

/**
 * Checks whether the offset is positioned in the empty area in front of the first child.
 *   ```
 *   1: function f() {
 *   2:   █  // <-- here
 *   3:   const a = 1;
 *   4:   const b = a + 1;
 *   5: }
 *   ```
 */
function isPositionedStartOfBlock(offset: number, node: TsNode, text: string) {
    // parent block
    const blockNode = node.parent;
    if (!blockNode) return;
    if (!('body' in blockNode)) return;
    //if (blockNode?.type !== 'BlockStatement') return;

    const parentStart = blockNode.range[0];
    const [nodeStart, nodeEnd] = node.range;

    const frontPart = text.slice(parentStart + 1, nodeStart);
    const md = frontPart.match(/\s*$/);
    if (!md) return false;
    const matchLength = md[0].length;

    return nodeStart - matchLength <= offset && offset < nodeEnd;
}

/**
 * Checks whether the offset is positioned in the empty area in end of the last child.
 *   ```
 *   1: function f() {
 *   2:   const a = 1;
 *   3:   const b = a + 1;
 *   4:   █  // <-- here
 *   5: }
 *   ```
 */
function isPositionedEndOfBlock(offset: number, node: TsNode, text: string) {
    // parent block
    const blockNode = node.parent;
    if (!blockNode) return;
    if (!('body' in blockNode)) return;

    const [_parentStart, parentEnd] = blockNode.range;
    const [_nodeStart, nodeEnd] = node.range;

    // FIXME: it can have comments in between.
    const endPart = text.slice(nodeEnd + 1, parentEnd);
    const md = endPart.match(/\s*$/);
    if (!md) return false;
    const matchLength = md[0].length;

    return nodeEnd <= offset && offset < nodeEnd + matchLength;
}

export function getAncestor<T extends TsNode = TsNode>(
    node: TsNode | null,
    condition: (ancestorNode: TsNode) => ancestorNode is T
) {
    if (!node) return null;
    //if (isProgram(node)) return null;

    let ancestorDecl: T | null = null;
    for (let iterNode = node.parent; iterNode; iterNode = iterNode?.parent) {
        if (condition(iterNode)) {
            ancestorDecl = iterNode;
            break;
        }
    }
    return ancestorDecl;
}

/**
 * Check if offset is in between two TsNodes.
 */
export function isBetweenNodes(
    offset: number,
    frontNode: TsNode | undefined,
    rearNode: TsNode | undefined
) {
    if (!frontNode) return false;
    if (!rearNode) return false;
    return frontNode.range[1] <= offset && offset < rearNode.range[0];
}

function isSameRange(rangeA: TSESTree.Range, rangeB: TSESTree.Range) {
    return rangeA[0] === rangeB[0] && rangeA[1] === rangeB[1];
}

/**
 * Perform a simple check between two nodes.
 * NOTE this is not an exhaustive comparison.
 */
export function looksSimilar(nodeA: TsNode | undefined | null, nodeB: TsNode | undefined | null) {
    if (!nodeA || !nodeB) return false;
    if (nodeA.type !== nodeB.type) return false;
    if (!isSameRange(nodeA.range, nodeB.range)) return false;

    return true;
}

export function isDescendantOfBlockAlike(
    node: TsNode,
    blockAncestor: TSESTree.BlockStatement | TSESTree.Program | undefined | null
) {
    if (!blockAncestor) return false;

    //let parentNode = node.parent;
    //while (parentNode) {
    //  if (looksSimilar(parentNode, blockAncestor)) {
    //    return true;
    //  }
    //  parentNode = parentNode.parent;
    //}

    for (let parentNode = node.parent; parentNode; parentNode = parentNode.parent) {
        if (looksSimilar(parentNode, blockAncestor)) {
            return true;
        }
    }

    return false;
}
