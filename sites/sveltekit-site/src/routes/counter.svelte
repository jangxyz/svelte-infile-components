<script lang="ts">
  import type { Snippet } from 'svelte';
	import type { MouseEventHandler } from 'svelte/elements';

	let { 
		count = 0, onclick, children,
	}: { 
		count?: number;
		onclick: MouseEventHandler<HTMLButtonElement>;
		children: Snippet;
	} =
		$props();
</script>

<button {onclick}>{@render children()}</button>

<style>
	button {
		background-color: blue;
	}
</style>
