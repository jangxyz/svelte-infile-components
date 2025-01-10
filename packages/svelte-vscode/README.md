# Svelte Infile Components for VS Code

Provides syntax highlighting and rich intellisense for Svelte Infile Components in VS Code, using its own [svelte infile component language server](/packages/language-server), on top of the default Svelte VS Code extension.

NOTE this is a fork of [Svelte VS Code extension](https://github.com/sveltejs/language-tools/tree/master/packages/svelte-vscode), and extends it by adding Svelte Infile Component related features.

## Setup

If you already have Svelte VS Code extension -- which you probably do -- you must first disable it.

![disable original extension](https://github.com/jangxyz/svelte-infile-components/raw/main/packages/svelte-vscode/doc/disable_original.gif)

## Features

On top of the default Svelte Intellisense behaviors, you additionally have:

-   Refactor: Extract Selection into an Infile Component
-   Refactor: Move current Infile Component to a new file

![refactoring](https://raw.githubusercontent.com/jangxyz/svelte-infile-components/main/packages/svelte-vscode/doc/refactoring.gif)

More features that are specifically related to infile components are on its way.

### Credits

-   The original [Svelte VS Code extension](https://github.com/sveltejs/language-tools/tree/master/packages/svelte-vscode).
