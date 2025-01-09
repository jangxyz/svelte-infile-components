
<!-- jangxyz marker -->

<script lang="ts">
    import { onMount } from 'svelte';
    import Counter from './Counter.svelte';
    import InfileCounter from 'infile:InfileCounter.svelte';
    import { sayHi } from '$lib/sayHi';

    let count = $state(0);
    sayHi;

    onMount(() => {
        sayHi();
    });

    export function someMethod() {
        return 3;
    }
</script>

<h1>Welcome to SvelteKit</h1>

<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<Counter onClick={() => (count += 1)}>{count}</Counter>

<InfileCounter />

---

<template id="InfileCounter.svelte">
    <script lang="ts">
        import type { Snippet } from 'svelte';

        let { onClick, children }: { onClick: () => void; children: Snippet } = $props();
    </script>

    <button onclick={onClick}>{@render children()}</button>

    <style>
        button {
            border: none;
        }
    </style>
</template>

<style>
</style>
