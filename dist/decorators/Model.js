"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var initTypeSchema_1 = require("../initTypeSchema");
function Model(options) {
    return function (type) {
        var schema = initTypeSchema_1.initTypeSchema(type);
        if (options) {
            if (options.collectionName !== undefined) {
                schema.collectionName = options.collectionName;
            }
            if (options.indexes !== undefined) {
                schema.indexes = options.indexes;
            }
        }
    };
}
exports.Model = Model;
