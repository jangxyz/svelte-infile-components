<script lang="ts">
  //import Counter from './Counter.svelte';
  import Counter from 'infile:MyCounter.svelte';
  //import Other from 'infile:other.svelte';
  import Static from './Static.svelte';

  let count = $state(0);
</script>

<h1>Welcome to your library project</h1>
<p>Create your package using @sveltejs/package and preview/showcase your work with SvelteKit</p>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<Counter
	{count}
	onclick={() => {
		count += 1;
	}}>count: {count}</Counter
>

<Static />

---

<template id="MyCounter.svelte">
	<script>
    import Static from './Static.svelte';
    import Other from 'infile:other.svelte';

    let count = $state(0);
	</script>
	<button onclick={() => (count += 1)}>Infile component count: {count}</button>

	<p>
	  And this is another infile component:

		<Other />
	</p>

	<Static />

</template>

---

<template id="other">Other.</template>
