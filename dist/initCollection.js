"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseModel_1 = require("./BaseModel");
function initCollection(type, m) {
    return __awaiter(this, void 0, void 0, function* () {
        let schema = type.$schema;
        let indexes = schema.indexes;
        if (indexes) {
            for (let index of indexes) {
                yield m.db
                    .collection(schema.collectionName)
                    .createIndex(Array.isArray(index.fields)
                    ? index.fields.reduce((fields, field) => ((fields[field] = 1), fields), {})
                    : index.fields, index.options);
            }
        }
        type[BaseModel_1.KEY_DB_COLLECTION_INITIALIZED] = true;
    });
}
exports.initCollection = initCollection;
