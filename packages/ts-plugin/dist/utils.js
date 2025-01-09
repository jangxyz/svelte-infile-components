"use strict";
//
// strings
//
Object.defineProperty(exports, "__esModule", { value: true });
exports.unreachable = exports.returning = exports.assertProperty = exports.getProperty = exports.buildObjectProxy = exports.replace = exports.omit = exports.split = void 0;
function split(str, sep, limit) {
    const allSplits = str.split(sep);
    if (limit === undefined)
        return allSplits;
    if (limit > allSplits.length)
        return allSplits;
    const splits = allSplits.slice(0, limit - 1);
    const rest = allSplits.slice(limit - 1);
    return splits.concat(rest.join(sep));
}
exports.split = split;
//
// objects
//
function omit(obj, ...omitKeys) {
    const result = {};
    for (const key of Object.keys(obj)) {
        if (omitKeys.includes(key)) {
            continue;
        }
        result[key] = obj[key];
    }
    return result;
}
exports.omit = omit;
function replace(obj, key, value) {
    //const result = {} as { [P in keyof T]: P extends K ? V : T[P] };
    const result = {};
    for (const objKey of Object.keys(obj)) {
        if (objKey === key) {
            result[objKey] = value;
        }
        else {
            result[objKey] = obj[objKey];
        }
    }
    return result;
}
exports.replace = replace;
function buildObjectProxy(obj) {
    const proxy = Object.create(null);
    for (let key of Object.keys(obj !== null && obj !== void 0 ? obj : {})) {
        const method = obj[key];
        // @ts-expect-error - JS runtime trickery which is tricky to type tersely
        proxy[key] = (...args) => method.apply(obj, args);
    }
    return proxy;
}
exports.buildObjectProxy = buildObjectProxy;
function getProperty(obj, key) {
    return key in obj ? obj[key] : undefined;
}
exports.getProperty = getProperty;
function assertProperty(obj, key) {
    const value = key in obj ? obj[key] : undefined;
}
exports.assertProperty = assertProperty;
//
// functions
//
function returning(value, callback) {
    try {
        callback(value);
    }
    catch (err) {
        console.warn(err);
    }
    finally {
        return value;
    }
}
exports.returning = returning;
//
// errors
//
function unreachable(msg = 'unreachable case') {
    throw new Error(msg);
}
exports.unreachable = unreachable;
//# sourceMappingURL=utils.js.map