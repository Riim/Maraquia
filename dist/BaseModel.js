"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("mongodb");
const pluralize_1 = require("pluralize");
const prettyFormat = require("pretty-format");
const getDefaultDatabase_1 = require("./getDefaultDatabase");
const initCollection_1 = require("./initCollection");
const initDocument_1 = require("./initDocument");
const isListsEqual_1 = require("./lib/isListsEqual");
const isModelListsEqual_1 = require("./lib/isModelListsEqual");
const setKeypath_1 = require("./lib/setKeypath");
exports.KEY_REFERENCE_FIELDS = Symbol('referenceFields');
exports.KEY_DB_COLLECTION_INITIALIZED = Symbol('collectionInitialized');
exports.KEY_DATA = Symbol('data');
exports.KEY_VALUES = Symbol('values');
exports.KEY_VALUE = Symbol('value');
let currentlyFieldsInitialization = false;
let currentlyFetchedDataApplying = false;
const savedModels = new Set();
class BaseModel {
    constructor(data = {}, db) {
        let fieldSchemas = this.constructor.$schema.fields;
        let referenceFields;
        if (this.constructor.hasOwnProperty(exports.KEY_REFERENCE_FIELDS)) {
            referenceFields = this.constructor[exports.KEY_REFERENCE_FIELDS];
        }
        else {
            referenceFields = this.constructor[exports.KEY_REFERENCE_FIELDS] = new Set();
            for (let name in fieldSchemas) {
                if (fieldSchemas[name] !== Object.prototype[name]) {
                    let fieldSchema = fieldSchemas[name];
                    if (fieldSchema.type && fieldSchema.type().$schema.collectionName) {
                        referenceFields.add(fieldSchema.dbFieldName || name);
                    }
                }
            }
        }
        this._db = db || this.constructor._db;
        this._pushData = currentlyFetchedDataApplying;
        this[exports.KEY_DATA] = data;
        this[exports.KEY_VALUES] = new Map();
        if (!fieldSchemas._id) {
            this._id = data._id ? new mongodb_1.ObjectId(data._id) : null;
        }
        currentlyFieldsInitialization = true;
        try {
            for (let name in fieldSchemas) {
                let fieldSchema = fieldSchemas[name];
                if (fieldSchema === Object.prototype[name]) {
                    continue;
                }
                let value_ = data[name];
                if (value_ === undefined && fieldSchema.dbFieldName) {
                    value_ = data[fieldSchema.dbFieldName];
                }
                let value = value_ === undefined ? null : value_;
                if (fieldSchema.type) {
                    let fieldType = fieldSchema.type();
                    if (fieldType.$schema.collectionName) {
                        if (value !== null) {
                            let isArray = Array.isArray(value);
                            if (!isArray || value.length) {
                                if ((isArray ? value[0] : value) instanceof mongodb_1.ObjectId) {
                                    this[exports.KEY_VALUES].set(name, isArray ? value.slice() : value);
                                }
                                else {
                                    if (isArray &&
                                        value.length == 1 &&
                                        !(value[0] instanceof BaseModel) &&
                                        pluralize_1.isSingular(name)) {
                                        value = value[0];
                                        isArray = false;
                                    }
                                    if (!((isArray ? value[0] : value) instanceof BaseModel)) {
                                        value = isArray
                                            ? value.map((itemData) => new fieldType(itemData, db))
                                            : new fieldType(value, db);
                                        data[name] = value;
                                    }
                                    this._validateFieldValue(name, fieldSchema, value);
                                    let valuePromise = Promise.resolve(value);
                                    valuePromise[exports.KEY_VALUE] = isArray ? value.slice() : value;
                                    this[exports.KEY_VALUES].set(name, valuePromise);
                                }
                                continue;
                            }
                        }
                        value =
                            fieldSchema.default !== undefined
                                ? typeof fieldSchema.default == 'function'
                                    ? fieldSchema.default()
                                    : fieldSchema.default
                                : this._validateFieldValue(name, fieldSchema, null);
                        if (value !== null || value_ !== null) {
                            data[name] =
                                value_ === undefined
                                    ? undefined
                                    : Array.isArray(value)
                                        ? value.slice()
                                        : value;
                        }
                        let valuePromise = Promise.resolve(value);
                        valuePromise[exports.KEY_VALUE] = value;
                        this[exports.KEY_VALUES].set(name, valuePromise);
                        continue;
                    }
                    if (value !== null) {
                        if (!Array.isArray(value)) {
                            value = this._validateFieldValue(name, fieldSchema, value instanceof BaseModel ? value : new fieldType(value, db));
                            data[name] = value;
                            this[name] = value;
                            continue;
                        }
                        if (value.length) {
                            value = this._validateFieldValue(name, fieldSchema, value[0] instanceof BaseModel
                                ? value
                                : value.map((itemData) => new fieldType(itemData, db)));
                            data[name] = value.slice();
                            this[name] = value;
                            continue;
                        }
                    }
                }
                else if (value !== null) {
                    // Поле идентификатора получит значение поля с внешней моделью
                    // если не отменять это проверкой: `!(value[0] instanceof BaseModel)`.
                    let isArray = Array.isArray(value);
                    if (!isArray || value.length) {
                        if (fieldSchema.dbFieldName &&
                            referenceFields.has(fieldSchema.dbFieldName)) {
                            if (isArray && value.length == 1 && pluralize_1.isSingular(name)) {
                                let value0 = value[0];
                                if (typeof value0 !== 'string' &&
                                    !(value0 instanceof mongodb_1.ObjectId) &&
                                    !(value0 instanceof BaseModel)) {
                                    value = value0;
                                    isArray = false;
                                }
                            }
                            if (isArray) {
                                if (!(value[0] instanceof mongodb_1.ObjectId)) {
                                    value = value.map(typeof value[0] == 'string'
                                        ? (value) => new mongodb_1.ObjectId(value)
                                        : (value) => value._id ? new mongodb_1.ObjectId(value._id) : null);
                                    data[name] = value;
                                }
                            }
                            else if (!(value instanceof mongodb_1.ObjectId)) {
                                value =
                                    typeof value == 'string'
                                        ? new mongodb_1.ObjectId(value)
                                        : value._id
                                            ? new mongodb_1.ObjectId(value._id)
                                            : null;
                                data[name] = value;
                            }
                        }
                        this[name] = this._validateFieldValue(name, fieldSchema, isArray ? value.slice() : value);
                        continue;
                    }
                }
                value =
                    fieldSchema.default !== undefined
                        ? typeof fieldSchema.default == 'function'
                            ? fieldSchema.default()
                            : fieldSchema.default
                        : this._validateFieldValue(name, fieldSchema, null);
                if (value !== null || value_ !== null) {
                    data[name] =
                        value_ === undefined
                            ? undefined
                            : Array.isArray(value)
                                ? value.slice()
                                : value;
                }
                this[name] = value;
            }
        }
        catch (err) {
            throw err;
        }
        finally {
            currentlyFieldsInitialization = false;
        }
    }
    static get db() {
        return this._db;
    }
    static use(db) {
        this._db = db;
        return this;
    }
    static async getDatabase() {
        return this._db || (this._db = await getDefaultDatabase_1.getDefaultDatabase());
    }
    static async exists(query) {
        let collectionName = this.$schema.collectionName;
        if (!collectionName) {
            throw new TypeError('$schema.collectionName is required');
        }
        let db = this._db || (this._db = await getDefaultDatabase_1.getDefaultDatabase());
        if (!this[exports.KEY_DB_COLLECTION_INITIALIZED]) {
            await initCollection_1.initCollection(this, db);
        }
        return !!(await db.collection(collectionName).findOne(query));
    }
    static async find(query, resolvedFields, options) {
        let collectionName = this.$schema.collectionName;
        if (!collectionName) {
            throw new TypeError('$schema.collectionName is required');
        }
        let db = this._db || (this._db = await getDefaultDatabase_1.getDefaultDatabase());
        if (!this[exports.KEY_DB_COLLECTION_INITIALIZED]) {
            await initCollection_1.initCollection(this, db);
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
                let fieldSchema = this.$schema.fields[fieldName];
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
        let data = await db
            .collection(collectionName)
            .aggregate(pipeline)
            .toArray();
        currentlyFetchedDataApplying = true;
        let result = data.map(data => new this(data, db));
        currentlyFetchedDataApplying = false;
        return result;
    }
    static async findOne(query, resolvedFields) {
        return (await this.find(query, resolvedFields, { limit: 1 }))[0] || null;
    }
    static async aggregate(pipeline, options) {
        let collectionName = this.$schema.collectionName;
        if (!collectionName) {
            throw new TypeError('$schema.collectionName is required');
        }
        let db = this._db || (this._db = await getDefaultDatabase_1.getDefaultDatabase());
        if (!this[exports.KEY_DB_COLLECTION_INITIALIZED]) {
            await initCollection_1.initCollection(this, db);
        }
        let data = await db
            .collection(collectionName)
            .aggregate(pipeline, options)
            .toArray();
        currentlyFetchedDataApplying = true;
        let result = data.map(data => new this(data, db));
        currentlyFetchedDataApplying = false;
        return result;
    }
    static async remove(query) {
        let collectionName = this.$schema.collectionName;
        if (!collectionName) {
            throw new TypeError('$schema.collectionName is required');
        }
        let db = this._db || (this._db = await getDefaultDatabase_1.getDefaultDatabase());
        if (!this[exports.KEY_DB_COLLECTION_INITIALIZED]) {
            await initCollection_1.initCollection(this, db);
        }
        return await db.collection(collectionName).deleteMany(query);
    }
    static async removeOne(query) {
        let collectionName = this.$schema.collectionName;
        if (!collectionName) {
            throw new TypeError('$schema.collectionName is required');
        }
        let db = this._db || (this._db = await getDefaultDatabase_1.getDefaultDatabase());
        if (!this[exports.KEY_DB_COLLECTION_INITIALIZED]) {
            await initCollection_1.initCollection(this, db);
        }
        return (await db.collection(collectionName).deleteOne(query)).deletedCount == 1;
    }
    get db() {
        return this._db;
    }
    use(db) {
        if (this._db) {
            throw new TypeError('Cannot change defined database');
        }
        this._db = db;
        return this;
    }
    async fetchField(name) {
        let schema = this.constructor.$schema.fields[name];
        if (!schema) {
            throw new TypeError(`Field "${name}" is not declared`);
        }
        if (!schema.type) {
            throw new TypeError(`Field "${name}" has no type`);
        }
        let type = schema.type();
        let collectionName = type.$schema.collectionName;
        if (!collectionName) {
            throw new TypeError('$schema.collectionName is required');
        }
        let value = this[exports.KEY_VALUES].get(name);
        if (value instanceof Promise) {
            return value;
        }
        let db = this._db ||
            (this._db = this.constructor._db || (await getDefaultDatabase_1.getDefaultDatabase()));
        let valuePromise = Array.isArray(value)
            ? db
                .collection(collectionName)
                .find({ _id: { $in: value } })
                .toArray()
                .then(data => (valuePromise[exports.KEY_VALUE] = this._validateFieldValue(name, schema, data.map(itemData => new type(itemData, db)))))
            : db
                .collection(collectionName)
                .findOne({ _id: value })
                .then(data => (valuePromise[exports.KEY_VALUE] = this._validateFieldValue(name, schema, new type(data, db))));
        valuePromise[exports.KEY_VALUE] = value;
        this[exports.KEY_VALUES].set(name, valuePromise);
        return valuePromise;
    }
    setField(name, value, _key) {
        if (_key && currentlyFieldsInitialization) {
            this[_key] = value;
            return this;
        }
        if (!_key) {
            _key = name;
        }
        let schema = this.constructor.$schema.fields[name];
        if (!schema) {
            throw new TypeError(`Field "${name}" is not declared`);
        }
        if (value === undefined) {
            this[exports.KEY_DATA][name] = undefined;
        }
        else if (this[exports.KEY_DATA][name] === undefined) {
            this[exports.KEY_DATA][name] = null;
        }
        if (schema.type) {
            let type = schema.type();
            if (type.$schema.collectionName) {
                if (value != null) {
                    let isArray = Array.isArray(value);
                    if (!isArray || value.length) {
                        if ((isArray ? value[0] : value) instanceof mongodb_1.ObjectId) {
                            this[exports.KEY_VALUES].set(name, value);
                        }
                        else {
                            if (!((isArray ? value[0] : value) instanceof BaseModel)) {
                                value = isArray
                                    ? value.map((itemData) => new type(itemData, this._db))
                                    : new type(value, this._db);
                            }
                            this._validateFieldValue(name, schema, value);
                            let valuePromise = Promise.resolve(value);
                            valuePromise[exports.KEY_VALUE] = value;
                            this[exports.KEY_VALUES].set(name, valuePromise);
                        }
                        return this;
                    }
                }
                value =
                    schema.default !== undefined
                        ? typeof schema.default == 'function'
                            ? schema.default()
                            : schema.default
                        : this._validateFieldValue(name, schema, null);
                let valuePromise = Promise.resolve(value);
                valuePromise[exports.KEY_VALUE] = value;
                this[exports.KEY_VALUES].set(name, valuePromise);
                return this;
            }
            if (value != null) {
                if (!Array.isArray(value)) {
                    this[_key] = this._validateFieldValue(name, schema, value instanceof BaseModel ? value : new type(value, this._db));
                    return this;
                }
                if (value.length) {
                    this[_key] = this._validateFieldValue(name, schema, value[0] instanceof BaseModel
                        ? value
                        : value.map(itemData => new type(itemData, this._db)));
                    return this;
                }
            }
        }
        else if (value != null && (!Array.isArray(value) || value.length)) {
            this[_key] = this._validateFieldValue(name, schema, value);
            return this;
        }
        this[_key] =
            schema.default !== undefined
                ? typeof schema.default == 'function'
                    ? schema.default()
                    : schema.default
                : this._validateFieldValue(name, schema, null);
        return this;
    }
    _validateFieldValue(fieldName, fieldSchema, value) {
        if (fieldSchema.validate) {
            // joi возвращает { validate: () => { error: ValidationError | null } }
            let result = typeof fieldSchema.validate == 'function'
                ? fieldSchema.validate(value)
                : fieldSchema.validate.validate(value, { convert: false });
            if (result === false) {
                throw new TypeError(`Not valid value "${prettyFormat(value)}" for field "${fieldName}"`);
            }
            if (typeof result == 'string') {
                throw new TypeError(result);
            }
            if (result instanceof Error) {
                throw result;
            }
            if (result && typeof result == 'object' && result.error) {
                throw result.error;
            }
        }
        return value;
    }
    async save(_noSave) {
        let modelCtor = this.constructor;
        if (!modelCtor.$schema.collectionName) {
            throw new TypeError('$schema.collectionName is required');
        }
        let db = this._db ||
            (this._db = this.constructor._db || (await getDefaultDatabase_1.getDefaultDatabase()));
        if (!_noSave && !modelCtor[exports.KEY_DB_COLLECTION_INITIALIZED]) {
            await initCollection_1.initCollection(modelCtor, db);
        }
        let query;
        try {
            query = await this._save(db, _noSave || false);
        }
        catch (err) {
            throw err;
        }
        finally {
            // https://github.com/Riim/Maraquia/pull/1#issuecomment-491389356
            savedModels.clear();
        }
        return query;
    }
    async _save(db, noSave) {
        savedModels.add(this);
        if (this.beforeSave) {
            let r = this.beforeSave();
            if (r instanceof Promise) {
                await r;
            }
        }
        let modelSchema = this.constructor.$schema;
        if (!noSave && !this._id) {
            await initDocument_1.initDocument(this, db, modelSchema.collectionName);
        }
        let query = await this._save$(modelSchema, !this._id, !!this._id && !this._pushData, '', { __proto__: null }, db, noSave);
        // console.log('_id:', this._id);
        // console.log('query:', query);
        if (!noSave) {
            await db.collection(modelSchema.collectionName).updateOne({ _id: this._id }, query);
        }
        let $set = query.$set;
        let $unset = query.$unset;
        if ($set) {
            for (let keypath in $set) {
                setKeypath_1.setKeypath(this, keypath, $set[keypath]);
            }
        }
        if ($unset) {
            for (let keypath in $unset) {
                setKeypath_1.setKeypath(this, keypath, null);
            }
        }
        if (this.afterSave) {
            let r = this.afterSave();
            if (r instanceof Promise) {
                await r;
            }
        }
        return query;
    }
    async _save$(modelSchema, isNew, updateData, keypath, query, db, noSave) {
        let fieldSchemas = modelSchema.fields;
        for (let name in fieldSchemas) {
            let fieldSchema = fieldSchemas[name];
            if (fieldSchema === Object.prototype[name]) {
                continue;
            }
            let fieldKeypath = (keypath ? keypath + '.' : '') + (fieldSchema.dbFieldName || name);
            let fieldValue;
            if (fieldSchema.type) {
                let fieldTypeSchema = fieldSchema.type().$schema;
                if (fieldTypeSchema.collectionName) {
                    fieldValue = this[exports.KEY_VALUES].get(name);
                    if (fieldValue instanceof Promise) {
                        fieldValue = fieldValue[exports.KEY_VALUE];
                    }
                }
                else {
                    fieldValue = this[name];
                }
                if (fieldValue) {
                    if (fieldTypeSchema.collectionName) {
                        if (Array.isArray(fieldValue)) {
                            let modelListLength = fieldValue.length;
                            if (modelListLength) {
                                if (fieldValue[0] instanceof BaseModel) {
                                    for (let i = 0; i < modelListLength; i++) {
                                        if (!noSave && !savedModels.has(fieldValue[i])) {
                                            await fieldValue[i]._save(db, false);
                                        }
                                    }
                                    if (isNew ||
                                        updateData ||
                                        !isModelListsEqual_1.isModelListsEqual(fieldValue, this[exports.KEY_DATA][name])) {
                                        (query.$set || (query.$set = { __proto__: null }))[fieldKeypath] = fieldValue.map(model => model._id);
                                    }
                                }
                            }
                            else if (!isNew &&
                                (updateData || (this[exports.KEY_DATA][name] || []).length)) {
                                (query.$unset || (query.$unset = { __proto__: null }))[fieldKeypath] = true;
                            }
                        }
                        else if (fieldValue instanceof BaseModel) {
                            if (!noSave && !savedModels.has(fieldValue)) {
                                await fieldValue._save(db, false);
                            }
                            if (isNew || updateData || fieldValue !== this[exports.KEY_DATA][name]) {
                                (query.$set || (query.$set = { __proto__: null }))[fieldKeypath] =
                                    fieldValue._id;
                            }
                        }
                    }
                    else if (Array.isArray(fieldValue)) {
                        let modelListLength = fieldValue.length;
                        if (modelListLength) {
                            if (isNew ||
                                updateData ||
                                !isListsEqual_1.isListsEqual(fieldValue, this[exports.KEY_DATA][name])) {
                                (query.$set || (query.$set = { __proto__: null }))[fieldKeypath] = fieldValue.map((model) => model.toData());
                            }
                            else {
                                for (let i = 0; i < modelListLength; i++) {
                                    await fieldValue[i]._save$(fieldTypeSchema, false, false, fieldKeypath + '.' + i, query, db, noSave);
                                }
                            }
                        }
                        else if (!isNew && (updateData || (this[exports.KEY_DATA][name] || []).length)) {
                            (query.$unset || (query.$unset = { __proto__: null }))[fieldKeypath] = true;
                        }
                    }
                    else if (isNew || fieldValue[exports.KEY_DATA] !== this[exports.KEY_DATA][name]) {
                        (query.$set || (query.$set = { __proto__: null }))[fieldKeypath] = fieldValue.toData();
                    }
                    else {
                        await fieldValue._save$(fieldTypeSchema, false, updateData, fieldKeypath, query, db, noSave);
                    }
                }
                else if (!isNew && !(updateData && this[exports.KEY_DATA][name] === undefined)) {
                    (query.$unset || (query.$unset = { __proto__: null }))[fieldKeypath] = true;
                }
            }
            else {
                fieldValue = this[name];
                if ((name != '_id' || !modelSchema.collectionName) &&
                    (isNew ||
                        updateData ||
                        (Array.isArray(fieldValue)
                            ? !isListsEqual_1.isListsEqual(fieldValue, this[exports.KEY_DATA][name])
                            : fieldValue === null
                                ? fieldValue != this[exports.KEY_DATA][fieldSchema.dbFieldName || name]
                                : fieldValue !== this[exports.KEY_DATA][fieldSchema.dbFieldName || name]))) {
                    if (fieldValue === null || (Array.isArray(fieldValue) && !fieldValue.length)) {
                        if (!isNew && !(updateData && this[exports.KEY_DATA][name] === undefined)) {
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
    query() {
        return this.save(true);
    }
    async remove() {
        let collectionName = this.constructor.$schema.collectionName;
        if (!collectionName) {
            throw new TypeError('$schema.collectionName is required');
        }
        if (!this._id) {
            throw new TypeError('Field "_id" is required');
        }
        if (this.beforeRemove) {
            let r = this.beforeRemove();
            if (r instanceof Promise) {
                await r;
            }
        }
        let db = this._db ||
            (this._db = this.constructor._db || (await getDefaultDatabase_1.getDefaultDatabase()));
        let result = (await db.collection(collectionName).deleteOne({ _id: this._id })).deletedCount == 1;
        if (this.afterRemove) {
            let r = this.afterRemove();
            if (r instanceof Promise) {
                await r;
            }
        }
        return result;
    }
    beforeSave() { }
    afterSave() { }
    beforeRemove() { }
    afterRemove() { }
    toData(fields, methodName = 'toData') {
        let schema = this.constructor.$schema;
        let fieldSchemas = schema.fields;
        let obj = {};
        if (!fieldSchemas._id && schema.collectionName && (!fields || fields._id)) {
            obj._id = this._id || null;
        }
        for (let name in fieldSchemas) {
            if (fieldSchemas[name] === Object.prototype[name] || (fields && !fields[name])) {
                continue;
            }
            let value;
            if (fieldSchemas[name].type && fieldSchemas[name].type().$schema.collectionName) {
                value = this[exports.KEY_VALUES].get(name);
                if (value instanceof Promise) {
                    value = value[exports.KEY_VALUE];
                }
            }
            else {
                value = this[name];
            }
            if (value instanceof BaseModel) {
                switch (value[methodName].length) {
                    case 0: {
                        obj[name] = value[methodName]();
                        break;
                    }
                    case 1: {
                        obj[name] = value[methodName](fields && typeof fields[name] == 'object'
                            ? fields[name]
                            : undefined);
                        break;
                    }
                    default: {
                        obj[name] = value[methodName](fields && typeof fields[name] == 'object'
                            ? fields[name]
                            : undefined, methodName);
                        break;
                    }
                }
            }
            else if (Array.isArray(value)) {
                obj[name] =
                    value.length && value[0] instanceof BaseModel
                        ? value.map((model) => {
                            switch (model[methodName].length) {
                                case 0: {
                                    return model[methodName]();
                                }
                                case 1: {
                                    return model[methodName](fields && typeof fields[name] == 'object'
                                        ? fields[name]
                                        : undefined);
                                }
                                default: {
                                    return model[methodName](fields && typeof fields[name] == 'object'
                                        ? fields[name]
                                        : undefined, methodName);
                                }
                            }
                        })
                        : value;
            }
            else {
                obj[name] = value;
            }
        }
        return obj;
    }
    inspectData() {
        return prettyFormat(this.toData());
    }
    printData() {
        console.log(this.inspectData());
    }
}
exports.BaseModel = BaseModel;
BaseModel._db = null;
