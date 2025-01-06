"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeBase64 = exports.encodeBase64 = void 0;
// Safely encode strings using Base64
function encodeBase64(input) {
    return Buffer.from(input).toString('base64').replace(/=/g, '');
}
exports.encodeBase64 = encodeBase64;
// Decode Base64 for retrieval
function decodeBase64(input) {
    return Buffer.from(input, 'base64').toString('utf-8');
}
exports.decodeBase64 = decodeBase64;
//# sourceMappingURL=base64.js.map