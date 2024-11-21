<script lang="ts">
  //import Counter from "./Counter.svelte";
  import Counter from "infile:MyCounter.svelte";
</script>

<Counter />

---

<template id="MyCounter">
  <script lang="ts">
    let count: number = $state(0);
    const increment = () => {
      count += 1;
    };
  </script>

  <button onclick={increment}>
    count is {count}
  </button>
</template>
