"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseModel_1 = require("./BaseModel");
const initCollection_1 = require("./initCollection");
const initDocument_1 = require("./initDocument");
const setKeypath_1 = require("./lib/setKeypath");
const hasOwn = Object.prototype.hasOwnProperty;
const savedModels = new Set();
class Maraquia {
    constructor(db) {
        this.db = db;
    }
    async exists(type, query) {
        let collectionName = type.$schema.collectionName;
        if (!collectionName) {
            throw new TypeError('$schema.collectionName is required');
        }
        if (!type[BaseModel_1.KEY_DB_COLLECTION_INITIALIZED]) {
            await initCollection_1.initCollection(type, this);
        }
        return !!(await this.db.collection(collectionName).findOne(query));
    }
    async find(type, query, resolvedFields, options) {
        let collectionName = type.$schema.collectionName;
        if (!collectionName) {
            throw new TypeError('$schema.collectionName is required');
        }
        if (!type[BaseModel_1.KEY_DB_COLLECTION_INITIALIZED]) {
            await initCollection_1.initCollection(type, this);
        }
        let pipeline = [];
        if (query) {
            pipeline.push({ $match: query });
        }
        if (options) {
            if (options.sort) {
                pipeline.push({ $sort: options.sort });
            }
            if (options.skip) {
                pipeline.push({ $skip: options.skip });
            }
            if (options.limit) {
                pipeline.push({ $limit: options.limit });
            }
        }
        if (resolvedFields) {
            for (let fieldName of resolvedFields) {
                let fieldSchema = type.$schema.fields[fieldName];
                if (!fieldSchema) {
                    throw new TypeError(`Field "${fieldName}" is not declared`);
                }
                let fieldType = fieldSchema.type;
                if (!fieldType) {
                    throw new TypeError(`Field "${fieldName}" has not type`);
                }
                let fieldTypeCollectionName = fieldType().$schema.collectionName;
                if (!fieldTypeCollectionName) {
                    throw new TypeError(`$schema.collectionName of type "${fieldType().name}" is required`);
                }
                pipeline.push({
                    $lookup: {
                        from: fieldTypeCollectionName,
                        localField: fieldName,
                        foreignField: '_id',
                        as: fieldName
                    }
                });
            }
        }
        return (await this.db
            .collection(collectionName)
            .aggregate(pipeline)
            .toArray()).map(data => new type(data, this));
    }
    async findOne(type, query, resolvedFields) {
        return (await this.find(type, query, resolvedFields, { limit: 1 }))[0];
    }
    async aggregate(type, pipeline, options) {
        let collectionName = type.$schema.collectionName;
        if (!collectionName) {
            throw new TypeError('$schema.collectionName is required');
        }
        if (!type[BaseModel_1.KEY_DB_COLLECTION_INITIALIZED]) {
            await initCollection_1.initCollection(type, this);
        }
        return (await this.db
            .collection(collectionName)
            .aggregate(pipeline, options)
            .toArray()).map(data => new type(data, this));
    }
    async save(model) {
        let type = model.constructor;
        if (!type.$schema.collectionName) {
            throw new TypeError('$schema.collectionName is required');
        }
        if (!type[BaseModel_1.KEY_DB_COLLECTION_INITIALIZED]) {
            await initCollection_1.initCollection(type, this);
        }
        try {
            await this._save(model);
        }
        catch (err) {
            throw err;
        }
        finally {
            savedModels.clear();
        }
        return true;
    }
    async _save(model) {
        savedModels.add(model);
        if (model.m) {
            if (model.m !== this) {
                throw new TypeError('Cannot replace Maraquia instance on model');
            }
        }
        else {
            model.m = this;
        }
        let modelSchema = model.constructor.$schema;
        if (!model._id) {
            await initDocument_1.initDocument(this, model, modelSchema.collectionName);
        }
        let query = await this._save$(model, modelSchema, model._id !== model[BaseModel_1.KEY_DATA]._id, '', {
            __proto__: null
        });
        if (model.beforeSave) {
            let r = model.beforeSave();
            if (r instanceof Promise) {
                await r;
            }
        }
        // console.log('model._id:', model._id);
        // console.log('query:', query);
        await this.db.collection(modelSchema.collectionName).updateOne({ _id: model._id }, query);
        updateData(model, query);
        if (model.afterSave) {
            let r = model.afterSave();
            if (r instanceof Promise) {
                await r;
            }
        }
        return true;
    }
    async _save$(model, modelSchema, isNew, keypath, query) {
        let fieldSchemas = modelSchema.fields;
        let values = model[BaseModel_1.KEY_VALUES];
        for (let name in fieldSchemas) {
            if (!hasOwn.call(fieldSchemas, name)) {
                continue;
            }
            let fieldSchema = fieldSchemas[name];
            let fieldKeypath = (keypath ? keypath + '.' : '') + (fieldSchema.dbFieldName || name);
            let fieldValue;
            if (fieldSchema.type) {
                let fieldTypeSchema = fieldSchema.type().$schema;
                if (fieldTypeSchema.collectionName) {
                    fieldValue = values.get(name);
                    if (fieldValue instanceof Promise) {
                        fieldValue = fieldValue[BaseModel_1.KEY_VALUE];
                    }
                }
                else {
                    fieldValue = model[name];
                }
                if (fieldValue) {
                    if (fieldTypeSchema.collectionName) {
                        if (Array.isArray(fieldValue)) {
                            let modelListLength = fieldValue.length;
                            if (modelListLength) {
                                if (fieldValue[0] instanceof BaseModel_1.BaseModel) {
                                    for (let i = 0; i < modelListLength; i++) {
                                        if (!savedModels.has(fieldValue[i])) {
                                            await this._save(fieldValue[i]);
                                        }
                                    }
                                    if (isNew ||
                                        !isModelListEqual(fieldValue, model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name], true)) {
                                        (query.$set || (query.$set = { __proto__: null }))[fieldKeypath] = fieldValue.map(model => model._id);
                                    }
                                }
                            }
                            else if (!isNew &&
                                (model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name] || []).length) {
                                (query.$unset || (query.$unset = { __proto__: null }))[fieldKeypath] = true;
                            }
                        }
                        else if (fieldValue instanceof BaseModel_1.BaseModel) {
                            if (!savedModels.has(fieldValue)) {
                                await this._save(fieldValue);
                            }
                            if (fieldValue._id !== model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name]) {
                                (query.$set || (query.$set = { __proto__: null }))[fieldKeypath] =
                                    fieldValue._id;
                            }
                        }
                    }
                    else if (Array.isArray(fieldValue)) {
                        let modelListLength = fieldValue.length;
                        if (modelListLength) {
                            let equal = !isNew &&
                                isModelListEqual(fieldValue, model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name], false);
                            let q = equal ? query : { __proto__: null };
                            for (let i = 0; i < modelListLength; i++) {
                                await this._save$(fieldValue[i], fieldTypeSchema, isNew, fieldKeypath + '.' + i, q);
                            }
                            if (!equal && (q.$set || q.$unset)) {
                                (query.$set || (query.$set = { __proto__: null }))[fieldKeypath] = fieldValue.map((model) => model.toObject());
                            }
                        }
                        else if (!isNew &&
                            (model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name] || []).length) {
                            (query.$unset || (query.$unset = { __proto__: null }))[fieldKeypath] = true;
                        }
                    }
                    else {
                        await this._save$(fieldValue, fieldTypeSchema, isNew ||
                            fieldValue !== model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name], fieldKeypath, query);
                    }
                }
                else if (!isNew && model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name]) {
                    (query.$unset || (query.$unset = { __proto__: null }))[fieldKeypath] = true;
                }
            }
            else {
                fieldValue = model[name];
                if ((name != '_id' || !modelSchema.collectionName) &&
                    (isNew ||
                        (Array.isArray(fieldValue)
                            ? !isModelListEqual(fieldValue, model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name], false)
                            : fieldValue !== model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name]))) {
                    if (fieldValue == null || (Array.isArray(fieldValue) && !fieldValue.length)) {
                        if (!isNew) {
                            (query.$unset || (query.$unset = { __proto__: null }))[fieldKeypath] = true;
                        }
                    }
                    else {
                        (query.$set || (query.$set = { __proto__: null }))[fieldKeypath] = fieldValue;
                    }
                }
            }
        }
        return query;
    }
    async remove(model) {
        let collectionName = model.constructor.$schema.collectionName;
        if (!collectionName) {
            throw new TypeError('$schema.collectionName is required');
        }
        if (!model._id) {
            throw new TypeError('model._id is required');
        }
        if (model.m) {
            if (model.m !== this) {
                throw new TypeError('Cannot replace Maraquia instance on model');
            }
        }
        else {
            model.m = this;
        }
        if (model.beforeRemove) {
            let r = model.beforeRemove();
            if (r instanceof Promise) {
                await r;
            }
        }
        let result = (await this.db.collection(collectionName).deleteOne({ _id: model._id }))
            .deletedCount == 1;
        if (model.afterRemove) {
            let r = model.afterRemove();
            if (r instanceof Promise) {
                await r;
            }
        }
        return result;
    }
}
exports.Maraquia = Maraquia;
function isModelListEqual(a, b, useId) {
    if (!b) {
        return false;
    }
    let aLength = a.length;
    if (useId && aLength && !(a[0] instanceof BaseModel_1.BaseModel)) {
        return true;
    }
    if (aLength != b.length) {
        return false;
    }
    if (useId) {
        for (let i = aLength; i;) {
            if (a[--i]._id !== b[i]) {
                return false;
            }
        }
    }
    else {
        for (let i = aLength; i;) {
            if (a[--i] != b[i]) {
                return false;
            }
        }
    }
    return true;
}
function updateData(model, query) {
    let $set = query.$set;
    if ($set) {
        for (let keypath in $set) {
            setKeypath_1.setKeypath(model, keypath, $set[keypath]);
        }
    }
    let $unset = query.$unset;
    if ($unset) {
        for (let keypath in $unset) {
            setKeypath_1.setKeypath(model, keypath, null);
        }
    }
}
