<script lang="ts">
  import Counter from "./lib/Counter.svelte";
  //import Counter from "infile:MyCounter.svelte";
</script>

<main>
  <h1>Vite + Svelte</h1>

  <button>Click me</button>

  <div class="card">
    <Counter />
  </div>
</main>

<style>
	button {
		padding: 0.5rem 1rem;
		background-color: white;
    border: 1px solid black;
	}
</style>

---

<template id="MyCounter">
  <script lang="ts">
    let count: number = $state(0);
    const increment = () => {
      count += 2;
    };
  </script>

  <button onclick={increment}>
    infile counter: count is {count}
  </button>

  <style>
		button {
			background-color: red;
			color: white;
		}
  </style>
</template>
