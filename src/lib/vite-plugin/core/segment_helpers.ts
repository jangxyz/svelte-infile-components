import { splitSegmentsWithPosition } from './split_segments.js';

export function findVirtualSegmentTuples(content: string) {
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

/**
 * Find the matching virtual segment from file content.
 */
export function _findVirtualSegmentFromFileContent1(
  content: string,
  virtualName: string,
) {
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

/**
 * Find the matching virtual segment from file content.
 */
export function findVirtualSegmentFromFileContent(
  fullContent: string,
  virtualName: string,
) {
  console.log(
    '🚀 ~ file: segment.ts:45 ~ virtualName:',
    JSON.stringify({ virtualName, fullContent }),
  );
  const [_firstSnippet, segments2] = splitSegmentsWithPosition(fullContent);
  console.log(
    '🚀 ~ file: segment.ts:50 ~ _firstSnippet, segments2:',
    JSON.stringify({ _firstSnippet, segments2 }),
  );
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
