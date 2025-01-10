#!/bin/bash

# clear
rm -rf node_modules package-lock.json

#npm run vscode:prepublish

# package without dependency check
vsce package --no-dependencies

# manually shove node_modules into the package
vsix_package=$(ls -1t svelte-infile-component-vscode-*.vsix | head -1)
rm -rf extension && mkdir extension && mv node_modules extension/.
zip -r "$vsix_package" extension/node_modules > /dev/null
mv extension/node_modules . && rmdir extension

echo "$vsix_package"

# publish
#vsce publish --packagePath "$vsix_package"
