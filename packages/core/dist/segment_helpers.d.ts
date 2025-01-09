export declare function findVirtualSegmentTuples(content: string): string[][];
/**
 * Find the matching virtual segment from file content.
 */
export declare function _findVirtualSegmentFromFileContent1(content: string, virtualName: string): {
    name: string;
    exportedCode: string;
} | {
    name: null;
    exportedCode: null;
};
/**
 * Find the matching virtual segment from file content.
 */
export declare function findVirtualSegmentFromFileContent(fullContent: string, virtualName: string): {
    name: string;
    exportedCode: string;
} | {
    name: null;
    exportedCode: null;
};
