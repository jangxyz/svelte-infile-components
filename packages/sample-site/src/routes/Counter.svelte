<script lang="ts">
  import type { Snippet } from 'svelte';

  let { onClick, children }: { onClick: () => void; children: Snippet } = $props();
</script>

abc

<button onclick={onClick}>{@render children()}</button>

<style>

</style>
