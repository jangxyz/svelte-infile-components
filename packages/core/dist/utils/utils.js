"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnreachableError = void 0;
exports.unreachable = unreachable;
exports.nonNullable = nonNullable;
class UnreachableError extends Error {
}
exports.UnreachableError = UnreachableError;
function unreachable(msg = 'unreachable case') {
    throw new UnreachableError(msg);
}
function nonNullable(value) {
    return value !== null;
}
//# sourceMappingURL=utils.js.map