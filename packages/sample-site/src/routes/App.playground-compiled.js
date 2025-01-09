import 'svelte/internal/disclose-version';
import * as $ from 'svelte/internal/client';
import { onMount } from 'svelte';
import Counter from './Counter.svelte';
import InfileCounter from 'infile:Counter.svelte';
import { sayHi } from '$lib';

var root = $.template(
  `<h1>Welcome to SvelteKit</h1> <p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p> <!> <!>`,
  1,
);

export default function App($$anchor, $$props) {
  $.push($$props, true);

  let count = $.state(0);

  sayHi;

  onMount(() => {
    sayHi();
  });

  function someMethod() {
    return 3;
  }

  var fragment = root();
  var node = $.sibling($.first_child(fragment), 4);

  Counter(node, {
    onClick: () => $.set(count, $.get(count) + 1),
    children: ($$anchor, $$slotProps) => {
      $.next();

      var text = $.text();

      $.template_effect(() => $.set_text(text, $.get(count)));
      $.append($$anchor, text);
    },
    $$slots: { default: true },
  });

  var node_1 = $.sibling(node, 2);

  InfileCounter(node_1, {});
  $.append($$anchor, fragment);
  return $.pop({ someMethod });
}
