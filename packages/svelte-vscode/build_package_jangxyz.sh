#
# How to do vsce package with npm
#
# References:
# - perplexity
# - https://github.com/microsoft/vscode-vsce/issues/203
#

# build subpackages for every 'workspace:' dependencies in package.json
# NOTE you should do this recursively for the subpackabes too.
#pnpm install --no-frozen-lockfile && pnpm build && pnpm pack --pack-destination ./dist
#npm install && npm run build

# build & package svelte2tsx
#cd packages/svelte2tsx
#rm -rf dist node_modules package-lock.json && mkdir -p dist
##pnpm install && pnpm run build && pnpm pack --pack-destination ./dist
#npm install && npm run build && npm pack --pack-destination ./dist
##cp dist/svelte2tsx-*.tgz ../svelte-vscode/dist/.
#cd -
#
# build & package language-server
#cd packages/language-server
#rm -rf dist node_modules package-lock.json && mkdir -p dist
#cp ../svelte2tsx/dist/svelte2tsx-*.tgz dist/.
# edit package.json to point svelte2tsx dependency to "file:.../dist/...tgz"
##pnpm install && pnpm run build && pnpm pack --pack-destination ./dist
#npm install && npm run build && npm pack --pack-destination ./dist
#cd -
#
# build & package typescript-plugin
#cd packages/typescript-plugin
#rm -rf dist node_modules package-lock.json && mkdir -p dist
#cp ../svelte2tsx/dist/svelte2tsx-*.tgz dist/.
# edit package.json to point svelte2tsx dependency to "file:.../dist/...tgz"
##pnpm install && pnpm run build && pnpm pack --pack-destination ./dist
#npm install && npm run build && npm pack --pack-destination ./dist
# cd -
#
# build & package svelte-vscode
#cd packages/svelte-vscode
#rm -rf dist && mkdir -p dist
#cp ../svelte2tsx/dist/svelte2tsx-*.tgz dist/.
#cp ../language-server/dist/svelte-language-server-*.tgz dist/.
#cp ../typescript-plugin/dist/typescript-svelte-plugin-*.tgz dist/.
# edit package.json to point "svelte-language-server" and "typescript-svelte-plugin" dependency to "file:.../dist/...tgz"
#rm -rf node_modules package-lock.json
#npm run vscode:prepublish
##npm install && npm run build # (should run with npm)
#npm list --production --parseable --depth=99999
# package vsce
##vsce package
#vsce package --no-dependencies
# manually shove node_modules into the package
#vsix_package=$(ls -1t svelte-vscode-custom*.vsix | head -1)
#rm -rf extension && mkdir extension && mv node_modules extension/.
#zip -r "$vsix_package" extension/node_modules
#mv extension/node_modules . && rmdir extension

# publish
#vsce publish --packagePath "$vsix_package"
