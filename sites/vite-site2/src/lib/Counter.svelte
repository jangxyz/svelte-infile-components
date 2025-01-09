<script lang="ts">
  import type { Snippet } from 'svelte';
	import type { MouseEventHandler } from 'svelte/elements';

	let { 
		count = 0, onclick = defaultOnClick, children = defaultChildren,
	}: { 
		count?: number;
		onclick?: MouseEventHandler<HTMLButtonElement>;
		children?: Snippet;
	} =
		$props();

	function defaultOnClick() {
		count += 1;
	}
</script>

<button {onclick}>{@render children()}</button>

{#snippet defaultChildren()}
  default snippet2: {count}
{/snippet}

<style>
	button {
		background-color: blue;
    color: white;
	}
</style>

