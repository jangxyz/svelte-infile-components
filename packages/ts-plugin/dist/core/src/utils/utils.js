"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nonNullable = exports.unreachable = exports.UnreachableError = void 0;
class UnreachableError extends Error {
}
exports.UnreachableError = UnreachableError;
function unreachable(msg = 'unreachable case') {
    throw new UnreachableError(msg);
}
exports.unreachable = unreachable;
function nonNullable(value) {
    return value !== null;
}
exports.nonNullable = nonNullable;
//# sourceMappingURL=utils.js.map