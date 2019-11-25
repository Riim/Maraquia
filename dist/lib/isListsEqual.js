"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function isListsEqual(a, b) {
    let aLength = a.length;
    if (!b) {
        return !aLength;
    }
    if (aLength != b.length) {
        return false;
    }
    for (let i = aLength; i;) {
        if (a[--i] !== b[i]) {
            return false;
        }
    }
    return true;
}
exports.isListsEqual = isListsEqual;
