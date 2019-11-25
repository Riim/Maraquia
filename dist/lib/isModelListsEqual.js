"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function isModelListsEqual(a, b) {
    if (!b) {
        return false;
    }
    let aLength = a.length;
    if (aLength != b.length) {
        return false;
    }
    for (let i = aLength; i;) {
        if (a[--i]._id !== b[i]) {
            return false;
        }
    }
    return true;
}
exports.isModelListsEqual = isModelListsEqual;
