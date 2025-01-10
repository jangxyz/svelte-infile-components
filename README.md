# Svelte Infile Components

Finally, multiple svelte components in Single File Component format, coming from the userland. Equipped with enhanced developer experience.

With these set of packages user is able to use multiple components in a file, using the following syntax:

```svelte
<script lang="ts">
	import Counter from 'infile:MyCounter.svelte';
</script>

<span>Svelte Component<span>

<Counter />

<style>
	span {
		font-size: 1.5rem;
		font-weight: bold;
	}
</style>

---

<template id="MyCounter">
	<script>
		let count = $state(0);
	</script>

	<span>Infile component with a counter</span>

	<button onclick={() => (count += 1)}>Count here: {count}</button>

	<style>
		span {
			color: blue;
		}
	</style>
</template>
```

Now it is possible to have multiple components that does not share any logic and style from each other.

You also have editor support like refactoring via extension (more to come).

## Quick Start

### 1. Vite plugin

Install vite plugin and configure it in `vite.config.ts`. If you are using vite@^5, you can safely upgrade to vite@^6 beforehand.

```bash
npm install vite@^6
npm install vite-plugin-svelte-infile-components
```

Set `vite.config.ts` as following:

```typeScript
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

import {
  infileComponentsVitePlugin,
} from 'vite-plugin-svelte-infile-components';

export default defineConfig({
  plugins: [
    infileComponentsVitePlugin(),
    sveltekit(),
  ],
});
```

### 2. adjust prettier-plugin-svelte options

In case you are using svelte with kit (`sv create`), or manually using the prettier-plugin-svelte package, set the `svelteSortOrder` property in prettierrc file to `"none"`.

```json
{
  "useTabs": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "plugins": ["prettier-plugin-svelte"],
  "svelteSortOrder": "none",
  "overrides": [
    {
      "files": "*.svelte",
      "options": {
        "parser": "svelte"
      }
    }
  ]
}
```

This is required because by default the prettier plugin tries to reorder a svelte component file in "options-scripts-markup-styles" order, which means the `<template>` tag in the end will be moved above the `<style>` tag on formatting. (Scheduled for further investigation)

### 3. VScode extension

Install the svelte-infile vscode extension.

You need to disable the default svelte extension, and enable this instead, as currently there is no way to merge two different extensions for svelte. (Scheduled for further investigation)

### 4. Enjoy!

Start running `npn run dev`, open your favorite IDE, and start adding infile components!

## Features

- allow multiple components inside a single Svelte file.
- works with JavaScript & TypeScript
- works with SvelteKit, plain svelte (using vite, astro)
- seamless DX with vscode extension

### Infile components

You can append an infile component inside a `<template>` tag, followed by a triple dash separator(`---`). You must set an `id` attribute to the template tag, which will be used as name of the module to import from.
Once you have declared an infile component, you import it as if it is a virtual module, with a `infile:` prefix. You can import it as any name you like. If you have two infile components in a file, you can even import it from both the main component and the other infile component.

It is possible to have multiple infile components, and import from one another. Each component will have its own namespace for script and styles, so it makes it easier to move it into a separate file later on.

```svelte
<script lang="ts">
	import Counter from 'infile:MyCounter.svelte'
	import Title from 'infile:Title.svelte'
</script>

<Title>The main component</Title>

<Counter />

---

<template id="MyCounter">
	<script>
		import Title from 'infile:Title.svelte':
		let count = $state(0);
	</script>

	<Title>Infile counter component</Title>

	<button onclick={() => (count += 1)}>Count here: {count}</button>
</template>

---

<template id="Title">
	<script>
		let { children } = $props();
	</script>

	<span>
		{#render children()}
	</span>
</template>
```

## Architecture

1. Vite plugin

   Before compiling the svelte component, the vite plugin compiles the infile component first and injects the compiled code into the main component. Since svelte components are functions, it lives as a function inside the main component.

   User can access the component by *import*ing it with a specific import name. Since it does not live in an actual file, we make it as a virtual module prefixed with `infile:`. You can import it as any name you would like. If you have two infile components in a file, you can even import it from both the main component and the other infile component.

   Vite plugin is what makes `npm run build` and `npm run dev` work. It also works nicely with HMR during development.

2. VSCode extension

   Compiling the svelte component and making it run is achievable by vite, but the editing experience is a different story. By default the IDE does not know about importing 'infile:components'. It will -- in case of vscode -- show a red squiggly to denote that the module is not found. Therefore we provide a svelte Language Server Protocol to _tell_ the editor that it's okay.

   In the process, we add some additional features like code refactoring to enhance the developing experience with infile components. Currently there are two refactoring commands available: 1) extract the current selection as an infile component, and 2) move the current infile component to a separate file. More features are under its way.

## TODO

Implementations:

- (./) multiple infile components
- (./) HMR
- sourcemap support
- error diagnostics
- goto definitions
- refactoring (rename, extract as infile component, etc.)
- snippet templates

More:

- more IDE support for LSP: neovim, jetbrains
- sveltelab template
- doc site

## FAQ

### Q. But why? Why should we have multiple components in a Single File Component?

Since the beginning, there were lot of requests on allowing multiple components in a svelte file, like this one: [#2940/Multiple components in one file](https://github.com/sveltejs/svelte/issues/2940). Users from all over found that the feature was _missing_, and they would like to have it inspite of svelte being a "Single File Component" based.

However the members of Svelte has officially noted that providing multiple components in a single file component would not do. Keeping one component in one file makes it a clear and straightforward structure, it aligns with Svelte's design principle of simplicity, and the user don't have to learn yet another syntax. The official answer for multiple components was that you should create a new file, and most of the time you would get used to it.
They did add Snippets in Svelte 5, but it is a bit different -- see the next question.

Meanwhile, others like Ryan Carniato -- the author of SolidJS -- insisted that Single File Components is bad because the act of splitting a file hurts developer experience during development and refactoring. It's the reason why SolidJS turned to use JSX instead of SFC.

Hence the infile component project was born. The Svelte team is not going to make it, but still a lot of people think it is important. It's a perfect opportunity for a plugin. Users can try it out, see if it's worth it. The Svelte team can see how the user responds to the alternative implementation.

### Q. Don't we already have Snippets?

Snippets and Infile Components are a bit different. While they provide some common features, like extractable markup in a single file, the differences between them reveals the purpose they exist.

Snippets share logic and style from the main component. It is used for easier access, like inside a `{#each}` block ir an `{#if} {:else}` block. However, it would be a pain to actually extract this into a separate component, because the styles and logic are tangled to the main component.

Infile components do not share the logic nor inherit the style. It is independent from the main component, and it _just happens_ to be on the same file. It's about to be extracted into a new file, but you are still not sure whether creating a new file is worth it. You might end up reverting the split, and delete the file after all. Instead of actualy file creation / deletion, you can test it out inside the same file. That's what infile components are for.

### Q. Are triples dash necessary?

The triple dash separator exists to express a visual cutting line, like the ones you used to see in paper forms (hey, go bring your scissors!).

There are some ideas about using plain `<template>` tags to express a snippet, since it _resides inside_ the main component. The idea is still being articulated, but when it is realized, the dashed separator will be able to distinguish between the two.


### Q. I am seeing `"vite:dep-scan" was triggered by this import` errors.

Vite dev server shows an error when it encounters a virtual file for the first time, but it is fine ([vite issue#14151](https://github.com/vitejs/vite/issues/14151)). You can just ignore it, or just restart the server and it will go away.


