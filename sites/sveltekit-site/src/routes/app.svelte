<script lang="ts">
	//import Counter from './Counter.svelte';
	import Counter from 'infile:MyCounter.svelte';
	//import Other from 'infile:other.svelte';

	let count = $state(0);
</script>

<h1>Welcome to your library project</h1>
<p>Create your package using @sveltejs/package and preview/showcase your work with SvelteKit</p>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation!4</p>

<button>Click me</button>

<Counter
	{count}
	onclick={() => {
		count += 1;
	}}>count: {count}</Counter
>

<style>
	button {
		padding: 0.5rem 1rem;
		background-color: white;
	}
</style>

---

<template id="MyCounter">
	<script>
	  import Other from 'infile:other.svelte';
		let count = $state(0);
	</script>
	<button onclick={() => (count += 1)}>Infile component count: {count}</button>

	<p>
	  And this is another infile component:

		<Other />
	</p>


	<style>
		button {
			background-color: red;
		}
	</style>
</template>

---

<template id="other">Other.5</template>
