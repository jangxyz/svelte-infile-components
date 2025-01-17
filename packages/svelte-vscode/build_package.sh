#
# How to do vsce package with npm
#
# References:
# - perplexity
# - https://github.com/microsoft/vscode-vsce/issues/203
#

set -e

# build subpackages for every 'workspace:' dependencies in package.json
# NOTE you should do this recursively for the subpackabes too.
#pnpm install --no-frozen-lockfile && pnpm build && pnpm pack --pack-destination ./dist
#npm install && npm run build

# build & package svelte2tsx
cd packages/svelte2tsx
rm -rf dist node_modules package-lock.json && mkdir -p dist
pnpm install && pnpm run build && pnpm pack --pack-destination ./dist
svelte2tsx_packfile=$(ls -1tr ./dist/*.tgz)
#npm install && npm run build && npm pack --pack-destination ./dist
#cp dist/svelte2tsx-*.tgz ../svelte-vscode/dist/.
cd -

# build & package language-server
cd packages/language-server
rm -rf dist node_modules package-lock.json && mkdir -p dist
#cp ../svelte2tsx/dist/svelte2tsx-*.tgz dist/.
cp ../svelte2tsx/${svelte2tsx_packfile} dist/.
# edit package.json to point svelte2tsx dependency to "file:./dist/svelte2tsx/svelte2tsx-0.7.25-custom.tgz"
cp package.json package.json.bak
sed -e 's+"svelte2tsx": "file:\.\.\/[^"]*"+"svelte2tsx": "file:'${svelte2tsx_packfile}'"+' -i.bak package.json
#diff package.json.bak package.json
#pnpm install && pnpm run build && pnpm pack --pack-destination ./dist
npm install && npm run build && npm pack --pack-destination ./dist
langserver_packfile=$(ls -1tr ./dist/svelte-infile-component-language-server-*.tgz)
mv package.json.bak package.json
rm -rf package-lock.json node_modules
cd -

# build & package typescript-plugin
cd packages/typescript-plugin
rm -rf dist node_modules package-lock.json && mkdir -p dist
cp ../svelte2tsx/${svelte2tsx_packfile} dist/.
# edit package.json to point svelte2tsx dependency to "file:./dist/svelte2tsx/svelte2tsx-0.7.25-custom.tgz"
cp package.json package.json.bak
sed -e 's+"svelte2tsx": "file:\.\.\/[^"]*"+"svelte2tsx": "file:'${svelte2tsx_packfile}'"+' -i.bak package.json
#diff package.json.bak package.json
#pnpm install && pnpm run build && pnpm pack --pack-destination ./dist
npm install && npm run build && npm pack --pack-destination ./dist
tsplugin_packfile=$(ls -1tr ./dist/typescript-svelte-plugin-*.tgz)
mv package.json.bak package.json
rm -rf package-lock.json node_modules
cd -

# build & package svelte-vscode
cd packages/svelte-vscode
rm -rf dist && mkdir -p dist
cp ../svelte2tsx/dist/svelte2tsx-*.tgz dist/.
cp ../language-server/dist/svelte-infile-component-language-server-*.tgz dist/.
cp ../typescript-plugin/dist/typescript-svelte-plugin-*.tgz dist/.
# edit package.json to point "svelte-language-server" and "typescript-svelte-plugin" dependency to "file:.../dist/...tgz"
cp package.json package.json.bak
if [ 1 ]; then
  npm install svelte2tsx@file:../svelte2tsx
  sed \
    -e 's+"svelte-infile-component-language-server": "file:[.][.][/][^"]*"+"svelte-infile-component-language-server": "file:'${langserver_packfile}'"+' \
    -e 's+"typescript-svelte-plugin": "file:[.][.][/][^"]*"+"typescript-svelte-plugin": "file:'${tsplugin_packfile}'"+' \
    -e 's+"svelte2tsx": "file:\.\.\/[^"]*"+"svelte2tsx": "file:'${svelte2tsx_packfile}'"+' \
    -i '' package.json
  #diff package.json.bak package.json
  npm install
  rm -rf node_modules package-lock.json
  #npm install && npm run build # (should run with npm)
  npm run vscode:prepublish
  #npm list --production --parseable --depth=99999

  # package vsce
  #vsce package
  vsce package --no-dependencies
  # manually shove node_modules into the package
  vsix_package=$(ls -1t svelte-infile-component-vscode-*.vsix | head -1)
  rm -rf extension && mkdir extension && mv node_modules extension/.
  zip -r "$vsix_package" extension/node_modules
  mv extension/node_modules . && rmdir extension
fi
mv package.json.bak package.json

echo "now you can publish: vsce publish --packagePath \"$vsix_package\""
# publish
#vsce publish --packagePath "$vsix_package"
