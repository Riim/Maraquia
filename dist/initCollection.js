"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseModel_1 = require("./BaseModel");
async function initCollection(modelCtor, db) {
    let modelSchema = modelCtor.$schema;
    let indexes = modelSchema.indexes;
    if (indexes) {
        for (let index of indexes) {
            await db
                .collection(modelSchema.collectionName)
                .createIndex(Array.isArray(index.fields)
                ? index.fields.reduce((fields, field) => ((fields[field] = 1), fields), {})
                : index.fields, index.options);
        }
    }
    modelCtor[BaseModel_1.KEY_DB_COLLECTION_INITIALIZED] = true;
}
exports.initCollection = initCollection;
