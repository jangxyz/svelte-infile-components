<script lang="ts">
	//import Counter from './counter.svelte';
	import Counter from 'infile:MyCounter.svelte';

	let count = $state(0);
</script>

<h1>Welcome to your library project</h1>
<p>Create your package using @sveltejs/package and preview/showcase your work with SvelteKit</p>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<Counter
	{count}
	onclick={() => {
		count += 1;
	}}
/>

---

<template id="MyCounter">
	<script>
		let count = $state(0);
	</script>
	<button onclick={() => (count += 1)}>Count here: {count}</button>
</template>

---

<template id="other"> Other. </template>
