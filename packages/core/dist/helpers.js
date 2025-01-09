"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasNumberProperty = hasNumberProperty;
exports._summary = _summary;
/**
 * Check if object has property of type 'number'
 */
function hasNumberProperty(obj, property) {
    return (property in obj && typeof obj[property] === 'number');
}
function _summary(code, length = 100) {
    if (!code)
        return code;
    if (code.length < length * 2)
        return code;
    return code.slice(0, length) + '...' + code.slice(-length);
}
//# sourceMappingURL=helpers.js.map