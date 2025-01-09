import 'svelte/internal/disclose-version';
import * as $ from 'svelte/internal/client';

var root = $.template(`<button> </button>`);

export default function Counter($$anchor, $$props) {
  let count = $.prop($$props, 'count', 3, 0);
  var button = root();

  button.__click = function (...$$args) {
    $$props.onclick?.apply(this, $$args);
  };

  var text = $.child(button, true);

  $.reset(button);
  $.template_effect(() => $.set_text(text, count()));
  $.append($$anchor, button);
}

$.delegate(['click']);
