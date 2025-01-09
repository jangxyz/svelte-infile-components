"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createModuleNameSerializer_base64 = exports.createModuleNameSerializer_hash = exports.createModuleNameSerializer_query = void 0;
const node_crypto_1 = require("node:crypto");
const utils_js_1 = require("./utils.js");
const base64_js_1 = require("./utils/base64.js");
function createModuleNameSerializer_query(ts) {
    function serializeModuleName(containingFile, moduleName) {
        return ts.server.toNormalizedPath(`${moduleName}?from=${encodeURIComponent(containingFile)}`);
    }
    function deserializeModuleName(resolvedModuleName) {
        const [moduleName, paramString] = (0, utils_js_1.split)(resolvedModuleName, '?', 2);
        const md = paramString.match(/from=([^&]*)/);
        // cannot find from= param
        if (!md) {
            console.error('ERROR cannot extract containing file name from module name. Missing from= param', JSON.stringify(resolvedModuleName));
            throw new Error('wrong module name');
        }
        const containingFile = decodeURIComponent(md[1]);
        return [moduleName, containingFile];
    }
    return [serializeModuleName, deserializeModuleName];
}
exports.createModuleNameSerializer_query = createModuleNameSerializer_query;
function createModuleNameSerializer_hash(ts) {
    function serializeModuleName(containingFile, moduleName) {
        const hashedContainingFile = hashFilePath(containingFile);
        const serializedName = `${hashedContainingFile}__${moduleName}`;
        return serializedName;
    }
    function deserializeModuleName(resolvedModuleName) {
        const [hashedContainingFile, moduleName] = (0, utils_js_1.split)(resolvedModuleName, '__', 2);
        return [moduleName, hashedContainingFile];
    }
    function hashFilePath(filePath) {
        return (0, node_crypto_1.createHash)('md5').update(filePath).digest('hex'); // Use a short hash for uniqueness
    }
    return [serializeModuleName, deserializeModuleName];
}
exports.createModuleNameSerializer_hash = createModuleNameSerializer_hash;
function createModuleNameSerializer_base64(ts) {
    function serializeModuleName(containingFile, moduleName) {
        const containingFile_encoded = (0, base64_js_1.encodeBase64)(containingFile);
        const serializedName = `${containingFile_encoded}__${moduleName}`;
        return serializedName;
    }
    function deserializeModuleName(resolvedModuleName) {
        const [containingFile_encoded, moduleName] = (0, utils_js_1.split)(resolvedModuleName, '__', 2);
        return [moduleName, (0, base64_js_1.decodeBase64)(containingFile_encoded)];
    }
    return [serializeModuleName, deserializeModuleName];
}
exports.createModuleNameSerializer_base64 = createModuleNameSerializer_base64;
//# sourceMappingURL=moduleName_serializers.js.map