///<reference types="svelte" />
import { onMount } from 'svelte';
import Counter from './Counter.svelte';
//import InfileCounter from 'infile:Counter.svelte';
declare const InfileCounter: (...args: any[]) => any;

import { sayHi } from '$lib';
function render() {
    let count = $state(0);
    sayHi;

    onMount(() => {
        sayHi();
    });

    function someMethod() {
        return 3;
    }
    async () => {
        {
            svelteHTML.createElement('h1', {});
        }

        {
            svelteHTML.createElement('p', {});
            {
                svelteHTML.createElement('a', { href: `https://svelte.dev/docs/kit` });
            }
        }

        {
            const $$_retnuoC0C = __sveltets_2_ensureComponent(Counter);
            new $$_retnuoC0C({
                target: __sveltets_2_any(),
                props: {
                    children: () => {
                        return __sveltets_2_any(0);
                    },
                    onClick: () => (count += 1)
                }
            });
            count;
            Counter;
        }

        {
            const $$_retnuoCelifnI0C = __sveltets_2_ensureComponent(InfileCounter);
            new $$_retnuoCelifnI0C({ target: __sveltets_2_any(), props: {} });
        }
    };
    return {
        props: {} as Record<string, never>,
        exports: {} as any as { someMethod: typeof someMethod },
        bindings: __sveltets_$$bindings(''),
        slots: {},
        events: {}
    };
}
const App__SvelteComponent_ = __sveltets_2_fn_component(render());
type App__SvelteComponent_ = ReturnType<typeof App__SvelteComponent_>;
export default App__SvelteComponent_;

var InfileCounter__root = $.template(`<button> </button>`);

const InfileCounter = function InfileCounter($$anchor, $$props) {
    let count = $.prop($$props, 'count', 3, 0);
    var button = InfileCounter__root();

    button.__click = function (...$$args) {
        $$props.onclick?.apply(this, $$args);
    };

    var text = $.child(button, true);

    $.reset(button);
    $.template_effect(() => $.set_text(text, count()));
    $.append($$anchor, button);
};

//$.delegate(['click']);
