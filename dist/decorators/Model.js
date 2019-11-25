"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const initModelClassSchema_1 = require("../initModelClassSchema");
function Model(options) {
    return (modelCtor) => {
        let schema = initModelClassSchema_1.initModelClassSchema(modelCtor);
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
