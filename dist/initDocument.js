"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function initDocument(model, db, collectionName) {
    model._id = (await db.collection(collectionName).insertOne({})).insertedId;
}
exports.initDocument = initDocument;
