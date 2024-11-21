<script lang="ts">
	import type { MouseEventHandler } from 'svelte/elements';

	let { count = 0, onclick }: { count?: number; onclick: MouseEventHandler<HTMLButtonElement> } =
		$props();
</script>

<button {onclick}>{count}</button>
