"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function setKeypath(obj, keypath, value) {
    let index = keypath.indexOf('.');
    if (index == -1) {
        obj[keypath] = value;
    }
    else {
        obj = obj[keypath.slice(0, index)] || {};
        for (let index2; (index2 = keypath.indexOf('.', index + 1)) != -1;) {
            obj = obj[keypath.slice(index + 1, index2)] || {};
            index = index2;
        }
        obj[keypath.slice(index + 1)] = value;
    }
}
exports.setKeypath = setKeypath;
