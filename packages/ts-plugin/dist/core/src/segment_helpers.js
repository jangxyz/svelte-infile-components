"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findVirtualSegmentFromFileContent = exports._findVirtualSegmentFromFileContent1 = exports.findVirtualSegmentTuples = void 0;
const split_segments_js_1 = require("./split_segments.js");
function findVirtualSegmentTuples(content) {
    const segmentTuples = content
        .split(/\n---\n/g)
        .slice(1)
        .map((part) => {
        const lines = part.trim().split('\n');
        const name = lines[0].replace(/^name=/, '');
        return [name, lines.join('\n')];
    });
    return segmentTuples;
}
exports.findVirtualSegmentTuples = findVirtualSegmentTuples;
/**
 * Find the matching virtual segment from file content.
 */
function _findVirtualSegmentFromFileContent1(content, virtualName) {
    const segments = content.split('---').map((part) => part.trim());
    for (const segment of segments) {
        const nameMatch = segment.match(/name\s*=\s*(\w+)/);
        const name = nameMatch ? nameMatch[1] : null;
        if (name === virtualName && nameMatch) {
            const exportedCode = segment.replace(nameMatch[0], '').trim();
            return { name, exportedCode };
        }
    }
    return { name: null, exportedCode: null }; // Return null if not found
}
exports._findVirtualSegmentFromFileContent1 = _findVirtualSegmentFromFileContent1;
/**
 * Find the matching virtual segment from file content.
 */
function findVirtualSegmentFromFileContent(fullContent, virtualName) {
    //console.log('🚀 ~ file: segment_helpers.ts:45 ~ virtualName:', ({ virtualName, fullContent }));
    const [_firstSnippet, segments2] = (0, split_segments_js_1.splitSegmentsWithPosition)(fullContent);
    //console.log('🚀 ~ file: segment_helpers.ts:50 ~ _firstSnippet, segments2:', { _firstSnippet, segments2, });
    for (const { name, text: exportedCode } of segments2.slice(1)) {
        if (name === virtualName) {
            return {
                name,
                exportedCode,
            };
        }
    }
    return { name: null, exportedCode: null }; // Return null if not found
}
exports.findVirtualSegmentFromFileContent = findVirtualSegmentFromFileContent;
//# sourceMappingURL=segment_helpers.js.map