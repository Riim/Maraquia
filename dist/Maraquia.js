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
const initCollection_1 = require("./initCollection");
const initDocument_1 = require("./initDocument");
const setKeypath_1 = require("./lib/setKeypath");
const currentlySavedModels = new Set();
class Maraquia {
    constructor(db) {
        this.db = db;
    }
    exists(type, query) {
        return __awaiter(this, void 0, void 0, function* () {
            let collectionName = type.$schema.collectionName;
            if (!collectionName) {
                throw new TypeError('$schema.collectionName is required');
            }
            if (!type[BaseModel_1.KEY_DB_COLLECTION_INITIALIZED]) {
                yield initCollection_1.initCollection(type, this);
            }
            return !!(yield this.db.collection(collectionName).findOne(query));
        });
    }
    find(type, query, resolvedFields) {
        return __awaiter(this, void 0, void 0, function* () {
            let collectionName = type.$schema.collectionName;
            if (!collectionName) {
                throw new TypeError('$schema.collectionName is required');
            }
            if (!type[BaseModel_1.KEY_DB_COLLECTION_INITIALIZED]) {
                yield initCollection_1.initCollection(type, this);
            }
            if (resolvedFields) {
                let aggregationPipeline = [{ $match: query }, { $limit: 1 }];
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
                    aggregationPipeline.push({
                        $lookup: {
                            from: fieldTypeCollectionName,
                            localField: fieldName,
                            foreignField: '_id',
                            as: fieldName
                        }
                    });
                }
                let data = (yield this.db
                    .collection(collectionName)
                    .aggregate(aggregationPipeline)
                    .toArray())[0];
                return data ? new type(data, this) : null;
            }
            let data = yield this.db.collection(collectionName).findOne(query);
            return data ? new type(data, this) : null;
        });
    }
    findAll(type, query, resolvedFields) {
        return __awaiter(this, void 0, void 0, function* () {
            let collectionName = type.$schema.collectionName;
            if (!collectionName) {
                throw new TypeError('$schema.collectionName is required');
            }
            if (!type[BaseModel_1.KEY_DB_COLLECTION_INITIALIZED]) {
                yield initCollection_1.initCollection(type, this);
            }
            if (resolvedFields) {
                let aggregationPipeline = [{ $match: query }];
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
                    aggregationPipeline.push({
                        $lookup: {
                            from: fieldTypeCollectionName,
                            localField: fieldName,
                            foreignField: '_id',
                            as: fieldName
                        }
                    });
                }
                return (yield this.db
                    .collection(collectionName)
                    .aggregate(aggregationPipeline)
                    .toArray()).map(data => new type(data, this));
            }
            return (yield this.db
                .collection(collectionName)
                .find(query)
                .toArray()).map(data => new type(data, this));
        });
    }
    save(model) {
        return __awaiter(this, void 0, void 0, function* () {
            if (currentlySavedModels.size) {
                throw new Error('Cannot save when saving');
            }
            let type = model.constructor;
            if (!type.$schema.collectionName) {
                throw new TypeError('$schema.collectionName is required');
            }
            if (!type[BaseModel_1.KEY_DB_COLLECTION_INITIALIZED]) {
                yield initCollection_1.initCollection(type, this);
            }
            try {
                yield this._save(model);
            }
            catch (err) {
                throw err;
            }
            finally {
                currentlySavedModels.clear();
            }
            return true;
        });
    }
    _save(model) {
        return __awaiter(this, void 0, void 0, function* () {
            currentlySavedModels.add(model);
            if (model.m) {
                if (model.m !== this) {
                    throw new TypeError('Cannot replace Maraquia instance on model');
                }
            }
            else {
                model.m = this;
            }
            let schema = model.constructor.$schema;
            if (!model._id) {
                yield initDocument_1.initDocument(this, model, schema.collectionName);
            }
            let query = yield this._save$(model, schema, model._id !== model[BaseModel_1.KEY_DATA]._id, '', {});
            if (model.beforeSave) {
                let r = model.beforeSave();
                if (r instanceof Promise) {
                    yield r;
                }
            }
            // console.log('model._id:', model._id);
            // console.log('query:', query);
            yield this.db.collection(schema.collectionName).updateOne({ _id: model._id }, query);
            updateData(model, query);
            if (model.afterSave) {
                let r = model.afterSave();
                if (r instanceof Promise) {
                    yield r;
                }
            }
            return true;
        });
    }
    _save$(model, typeSchema, isNew, keypath, query) {
        return __awaiter(this, void 0, void 0, function* () {
            let fieldsSchema = typeSchema.fields;
            let values = model[BaseModel_1.KEY_VALUES];
            for (let name in fieldsSchema) {
                let fieldSchema = fieldsSchema[name];
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
                                            if (!currentlySavedModels.has(fieldValue[i])) {
                                                yield this._save(fieldValue[i]);
                                            }
                                        }
                                        if (isNew ||
                                            !isModelListEqual(fieldValue, model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name], true)) {
                                            (query.$set || (query.$set = {}))[fieldKeypath] = fieldValue.map(model => model._id);
                                        }
                                    }
                                }
                                else if (!isNew &&
                                    (model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name] || []).length) {
                                    (query.$unset || (query.$unset = {}))[fieldKeypath] = true;
                                }
                            }
                            else if (fieldValue instanceof BaseModel_1.BaseModel) {
                                if (!currentlySavedModels.has(fieldValue)) {
                                    yield this._save(fieldValue);
                                }
                                if (fieldValue._id !== model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name]) {
                                    (query.$set || (query.$set = {}))[fieldKeypath] = fieldValue._id;
                                }
                            }
                        }
                        else if (Array.isArray(fieldValue)) {
                            let modelListLength = fieldValue.length;
                            if (modelListLength) {
                                let equal = isModelListEqual(fieldValue, model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name], false);
                                let q = equal && !isNew ? query : {};
                                for (let i = 0; i < modelListLength; i++) {
                                    yield this._save$(fieldValue[i], fieldTypeSchema, isNew, fieldKeypath + '.' + i, q);
                                }
                                if (!equal || isNew) {
                                    for (let _ in q) {
                                        (query.$set || (query.$set = {}))[fieldKeypath] = fieldValue.map((model) => model.toObject());
                                        break;
                                    }
                                }
                            }
                            else if (!isNew &&
                                (model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name] || []).length) {
                                (query.$unset || (query.$unset = {}))[fieldKeypath] = true;
                            }
                        }
                        else {
                            yield this._save$(fieldValue, fieldTypeSchema, isNew ||
                                fieldValue !== model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name], fieldKeypath, query);
                        }
                    }
                    else if (!isNew && model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name]) {
                        (query.$unset || (query.$unset = {}))[fieldKeypath] = true;
                    }
                }
                else {
                    fieldValue = model[name];
                    if ((name != '_id' || !typeSchema.collectionName) &&
                        (isNew ||
                            (Array.isArray(fieldValue)
                                ? !isModelListEqual(fieldValue, model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name], false)
                                : fieldValue !== model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name]))) {
                        if (fieldValue == null || (Array.isArray(fieldValue) && !fieldValue.length)) {
                            if (!isNew) {
                                (query.$unset || (query.$unset = {}))[fieldKeypath] = true;
                            }
                        }
                        else {
                            (query.$set || (query.$set = {}))[fieldKeypath] = fieldValue;
                        }
                    }
                }
            }
            return query;
        });
    }
    remove(model) {
        return __awaiter(this, void 0, void 0, function* () {
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
                    yield r;
                }
            }
            let result = (yield this.db
                .collection(collectionName)
                .remove({ _id: model._id }, true)).nRemoved == 1;
            if (model.afterRemove) {
                let r = model.afterRemove();
                if (r instanceof Promise) {
                    yield r;
                }
            }
            return result;
        });
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
