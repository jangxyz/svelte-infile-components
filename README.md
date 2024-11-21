# Svelte Infile Components

Allow multiple svelte components in a single file.

```svelte
<script lang="ts">
	import Counter from 'infile:MyCounter.svelte';
</script>

<Counter />

---

<template id="MyCounter">
	<script>
		let count = $state(0);
	</script>
	<button onclick={() => (count += 1)}>Count here: {count}</button>
</template>

```

Features:

- allow multiple components inside a single Svelte file.
- works with JavaScript & TypeScript
- seemless developer experience inside an IDE.
- works with SvelteKit, plain svelte (using vite, astro)
- vscode extensions provided
- allow snippets
