"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.proxy_languageServiceHost = exports.hasStringProperty = exports.hasNumericProperty = exports.hasNumericStart = exports.serializeDiagnostic = exports.tryStringify = exports.tryRunning = exports.buildPrint = void 0;
const node_util_1 = require("node:util");
const utils_js_1 = require("./utils.js");
function buildPrint(prefix = '', suffix = '') {
    return (...args) => {
        //console.log(`[${PLUGIN_NAME}]`, args.map((x) => tryStringify(x)).join(' '));
        const content = args.map((x) => tryStringify(x)).join(' ');
        console.log(prefix, content, suffix);
    };
}
exports.buildPrint = buildPrint;
function tryRunning(f, onError) {
    try {
        return [f(), null];
    }
    catch (err) {
        onError === null || onError === void 0 ? void 0 : onError(err);
        return [undefined, err];
    }
}
exports.tryRunning = tryRunning;
function tryStringify(s, options) {
    //try {
    //  return JSON.stringify(s);
    //} catch (err) {
    //  //console.warn(err);
    //  return inspect(s);
    //}
    return (0, node_util_1.inspect)(s, options);
}
exports.tryStringify = tryStringify;
function serializeDiagnostic(diagEntry) {
    var _a;
    return (0, utils_js_1.replace)(diagEntry, 'file', (_a = diagEntry.file) === null || _a === void 0 ? void 0 : _a.fileName);
}
exports.serializeDiagnostic = serializeDiagnostic;
function hasNumericStart(obj) {
    return 'start' in obj && typeof obj.start === 'number';
}
exports.hasNumericStart = hasNumericStart;
function hasNumericProperty(obj, key) {
    return key in obj && typeof obj[key] === 'number';
}
exports.hasNumericProperty = hasNumericProperty;
function hasStringProperty(obj, key) {
    return key in obj && typeof obj[key] === 'string';
}
exports.hasStringProperty = hasStringProperty;
function proxy_languageServiceHost(serviceHost) {
    var _a, _b, _c, _d;
    return {
        getCompilationSettings: () => serviceHost.getCompilationSettings(),
        getScriptFileNames: () => serviceHost.getScriptFileNames(),
        getScriptVersion: (fileName) => serviceHost.getScriptVersion(fileName),
        getScriptSnapshot: (fileName) => serviceHost.getScriptSnapshot(fileName),
        getCurrentDirectory: () => serviceHost.getCurrentDirectory(),
        getDefaultLibFileName: (options) => serviceHost.getDefaultLibFileName(options),
        readFile: (path, encoding) => { var _a; return (_a = serviceHost.readFile) === null || _a === void 0 ? void 0 : _a.call(serviceHost, path, encoding); },
        fileExists: (path) => { var _a, _b; return (_b = (_a = serviceHost.fileExists) === null || _a === void 0 ? void 0 : _a.call(serviceHost, path)) !== null && _b !== void 0 ? _b : false; },
        readDirectory: (_a = serviceHost.readDirectory) === null || _a === void 0 ? void 0 : _a.bind(serviceHost),
        directoryExists: (_b = serviceHost.directoryExists) === null || _b === void 0 ? void 0 : _b.bind(serviceHost),
        getDirectories: (_c = serviceHost.getDirectories) === null || _c === void 0 ? void 0 : _c.bind(serviceHost),
        resolveModuleNames: (_d = serviceHost.resolveModuleNames) === null || _d === void 0 ? void 0 : _d.bind(serviceHost),
    };
}
exports.proxy_languageServiceHost = proxy_languageServiceHost;
//# sourceMappingURL=helpers.js.map