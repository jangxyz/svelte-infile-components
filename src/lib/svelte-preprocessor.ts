import { inspect } from 'node:util';
import { parse, type AST, type PreprocessorGroup } from 'svelte/compiler';

export function svelteInfileComponents(options = {}) {
  return {
    name: 'svelte-infile-components',
    markup: ({ content, filename }) => {
      if (notInteresting(filename)) return;

      /** @type {import('svelte/compiler').AST.Root} */
      const svast = parse(content, { filename, modern: true });
      const { module, instance, css, start, end, fragment } = svast;
      const htmlString = content.slice(start, end);

      //const hasTemplateSegment = checkTemplateSegment(htmlString);

      //if (!hasTemplateSegment) {
      //  return;
      //}

      //const templateTag = hasTemplateSegment.groups['templateTag'];

      console.log('markup', inspect(filename?.split('/').at(-1)), {
        content: content.slice(0, 100),
        svast,
        //htmlString: htmlString.slice(0, 100) + '...' + htmlString.slice(-100),
        //templateTag,
        //index: hasTemplateSegment.index,
      });
      //console.log('fragment:', inspect(svast.fragment, { depth: 4 }));
      //console.log(JSON.stringify(svast));

      return {
        code: content + '\n!!!',
      };
    },
    script: ({ content, filename }) => {
      if (notInteresting(filename)) return;

      console.log('script', inspect(filename?.split('/').at(-1)), {
        content: content.slice(0, 100),
      });
    },
    //style: ({ content, filename }) => {
    //  // prettier-ignore
    //  if (filename?.includes('/node_modules/') || filename?.includes('/.svelte-kit/')) return;
    //  console.log('style', filename?.split('/').at(-1), {
    //    content: content.slice(0, 100),
    //  });
    //},
  } as PreprocessorGroup;
}

function checkTemplateSegment(htmlString: string) {
  const matchData = htmlString.match(
    /^---\n\s*(?<templateTag><template[^>]*>.*<\/template>)/m,
  );
  return /** @type {RegExpMatchArray & {groups: { templateTag: string }} | null} */ matchData;
}

/**
 * Checks whether given filepath is of interest.
 */
function notInteresting(filename: string | undefined | null) {
  if (!filename) return true;
  if (filename.includes('/node_modules/') || filename.includes('/.svelte-kit/'))
    return true;

  return false;
}

function findNodeWithPos(
  node: AST.Fragment & { start: number; end: number },
  pos: number,
) {
  if (!(node.start <= pos && pos <= node.end)) {
    return null;
  }
}
