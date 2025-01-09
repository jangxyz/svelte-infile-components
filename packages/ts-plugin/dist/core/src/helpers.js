"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports._summary = exports.hasNumberProperty = void 0;
/**
 * Check if object has property of type 'number'
 */
function hasNumberProperty(obj, property) {
    return (property in obj && typeof obj[property] === 'number');
}
exports.hasNumberProperty = hasNumberProperty;
function _summary(code, length = 100) {
    if (!code)
        return code;
    if (code.length < length * 2)
        return code;
    return code.slice(0, length) + '...' + code.slice(-length);
}
exports._summary = _summary;
//# sourceMappingURL=helpers.js.map