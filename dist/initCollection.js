"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseModel_1 = require("./BaseModel");
async function initCollection(type, m) {
    let schema = type.$schema;
    let indexes = schema.indexes;
    if (indexes) {
        for (let index of indexes) {
            await m.db
                .collection(schema.collectionName)
                .createIndex(Array.isArray(index.fields)
                ? index.fields.reduce((fields, field) => ((fields[field] = 1), fields), {})
                : index.fields, index.options);
        }
    }
    type[BaseModel_1.KEY_DB_COLLECTION_INITIALIZED] = true;
}
exports.initCollection = initCollection;
