"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("mongodb");
const prettyFormat = require("pretty-format");
const getDefaultMaraquiaInstance_1 = require("./getDefaultMaraquiaInstance");
const Maraquia_1 = require("./Maraquia");
exports.KEY_REFERENCE_FIELDS = Symbol('Maraquia/BaseModel[referenceFields]');
exports.KEY_DB_COLLECTION_INITIALIZED = Symbol('Maraquia/BaseModel[collectionInitialized]');
exports.KEY_DATA = Symbol('Maraquia/BaseModel[data]');
exports.KEY_VALUES = Symbol('Maraquia/BaseModel[values]');
exports.KEY_VALUE = Symbol('Maraquia/BaseModel[value]');
let currentlyValueSetting = false;
class BaseModel {
    constructor(data, m) {
        let fieldsSchema = this.constructor.$schema.fields;
        let referenceFields;
        if (this.constructor.hasOwnProperty(exports.KEY_REFERENCE_FIELDS)) {
            referenceFields = this.constructor[exports.KEY_REFERENCE_FIELDS];
        }
        else {
            referenceFields = this.constructor[exports.KEY_REFERENCE_FIELDS] = new Set();
            for (let name in fieldsSchema) {
                let fieldSchema = fieldsSchema[name];
                if (fieldSchema.type && fieldSchema.type().$schema.collectionName) {
                    referenceFields.add(fieldSchema.dbFieldName || name);
                }
            }
        }
        if (m) {
            this.m = m;
        }
        this[exports.KEY_DATA] = data || {};
        this[exports.KEY_VALUES] = new Map();
        if (!fieldsSchema._id) {
            this._id = (data && data._id) || null;
        }
        currentlyValueSetting = true;
        try {
            for (let name in fieldsSchema) {
                let fieldSchema = fieldsSchema[name];
                let value = data && data[fieldSchema.dbFieldName || name];
                if (fieldSchema.type) {
                    let fieldType = fieldSchema.type();
                    if (fieldType.$schema.collectionName) {
                        if (value != null) {
                            let isArray = Array.isArray(value);
                            if (!isArray || value.length) {
                                if ((isArray ? value[0] : value) instanceof mongodb_1.ObjectId) {
                                    this[exports.KEY_VALUES].set(name, isArray ? value.slice() : value);
                                }
                                else {
                                    if (!((isArray ? value[0] : value) instanceof BaseModel)) {
                                        value = isArray
                                            ? value.map((itemData) => new fieldType(itemData, m))
                                            : new fieldType(value, m);
                                    }
                                    this._validateFieldValue(name, fieldSchema, value);
                                    let valuePromise = Promise.resolve(value);
                                    valuePromise[exports.KEY_VALUE] = value;
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
                        let valuePromise = Promise.resolve(value);
                        valuePromise[exports.KEY_VALUE] = value;
                        this[exports.KEY_VALUES].set(name, valuePromise);
                        continue;
                    }
                    if (value != null) {
                        if (!Array.isArray(value)) {
                            this[name] = this._validateFieldValue(name, fieldSchema, value instanceof BaseModel ? value : new fieldType(value, m));
                            continue;
                        }
                        if (value.length) {
                            this[name] = this._validateFieldValue(name, fieldSchema, value[0] instanceof BaseModel
                                ? value.slice()
                                : value.map((itemData) => new fieldType(itemData, m)));
                            continue;
                        }
                    }
                }
                else if (value != null) {
                    // Поле идентификатора получит значение поля с внешней моделью:
                    // `let value = data && data[fieldSchema.dbFieldName || name];`,
                    // если не отменить это проверкой: `!(value[0] instanceof BaseModel)`.
                    let isArray = Array.isArray(value);
                    if (referenceFields.has(fieldSchema.dbFieldName || name)
                        ? isArray
                            ? value.length && !(value[0] instanceof BaseModel)
                            : !(value instanceof BaseModel)
                        : !isArray || value.length) {
                        this[name] = this._validateFieldValue(name, fieldSchema, isArray ? value.slice() : value);
                        continue;
                    }
                }
                this[name] =
                    fieldSchema.default !== undefined
                        ? typeof fieldSchema.default == 'function'
                            ? fieldSchema.default()
                            : fieldSchema.default
                        : this._validateFieldValue(name, fieldSchema, null);
            }
        }
        catch (err) {
            throw err;
        }
        finally {
            currentlyValueSetting = false;
        }
    }
    static async exists(query, m) {
        return (m || (await getDefaultMaraquiaInstance_1.getDefaultMaraquiaInstance())).exists(this, query);
    }
    static async find(query, mOrResolvedFields, m) {
        let resolvedFields;
        if (mOrResolvedFields) {
            if (mOrResolvedFields instanceof Maraquia_1.Maraquia) {
                m = mOrResolvedFields;
            }
            else {
                resolvedFields = mOrResolvedFields;
            }
        }
        return (m || (await getDefaultMaraquiaInstance_1.getDefaultMaraquiaInstance())).find(this, query, resolvedFields);
    }
    static async findAll(query, mOrResolvedFields, m) {
        let resolvedFields;
        if (mOrResolvedFields) {
            if (mOrResolvedFields instanceof Maraquia_1.Maraquia) {
                m = mOrResolvedFields;
            }
            else {
                resolvedFields = mOrResolvedFields;
            }
        }
        return (m || (await getDefaultMaraquiaInstance_1.getDefaultMaraquiaInstance())).findAll(this, query, resolvedFields);
    }
    static async aggregate(pipeline, options, m) {
        return (m || (await getDefaultMaraquiaInstance_1.getDefaultMaraquiaInstance())).aggregate(this, pipeline, options);
    }
    async fetchField(name, m) {
        let schema = this.constructor.$schema.fields[name];
        if (!schema) {
            throw new TypeError(`Field "${name}" is not declared`);
        }
        if (!schema.type) {
            throw new TypeError(`Field "${name}" has no type`);
        }
        let fieldType = schema.type();
        let collectionName = fieldType.$schema.collectionName;
        if (!collectionName) {
            throw new TypeError('$schema.collectionName is required');
        }
        let value = this[exports.KEY_VALUES].get(name);
        if (value instanceof Promise) {
            return value;
        }
        if (!m) {
            m = this.m || (await getDefaultMaraquiaInstance_1.getDefaultMaraquiaInstance());
        }
        let valuePromise = Array.isArray(value)
            ? m.db
                .collection(collectionName)
                .find({ _id: { $in: value } })
                .toArray()
                .then(data => (valuePromise[exports.KEY_VALUE] = this._validateFieldValue(name, schema, data.map(itemData => new fieldType(itemData, m)))))
            : m.db
                .collection(collectionName)
                .findOne({ _id: value })
                .then(data => (valuePromise[exports.KEY_VALUE] = this._validateFieldValue(name, schema, new fieldType(data, m))));
        valuePromise[exports.KEY_VALUE] = value;
        this[exports.KEY_VALUES].set(name, valuePromise);
        return valuePromise;
    }
    setField(name, value, _key) {
        if (_key && currentlyValueSetting) {
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
        if (schema.type) {
            let fieldType = schema.type();
            if (fieldType.$schema.collectionName) {
                if (value != null) {
                    let isArray = Array.isArray(value);
                    if (!isArray || value.length) {
                        if ((isArray ? value[0] : value) instanceof mongodb_1.ObjectId) {
                            this[exports.KEY_VALUES].set(name, value);
                        }
                        else {
                            if (!((isArray ? value[0] : value) instanceof BaseModel)) {
                                value = isArray
                                    ? value.map((itemData) => new fieldType(itemData))
                                    : new fieldType(value);
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
                    this[_key] = this._validateFieldValue(name, schema, value instanceof BaseModel ? value : new fieldType(value));
                    return this;
                }
                if (value.length) {
                    this[_key] = this._validateFieldValue(name, schema, value[0] instanceof BaseModel
                        ? value
                        : value.map(itemData => new fieldType(itemData)));
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
                : fieldSchema.validate.validate(value);
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
    async save(m) {
        return (m || this.m || (await getDefaultMaraquiaInstance_1.getDefaultMaraquiaInstance())).save(this);
    }
    async remove(m) {
        return (m || this.m || (await getDefaultMaraquiaInstance_1.getDefaultMaraquiaInstance())).remove(this);
    }
    toObject(fields) {
        let schema = this.constructor.$schema;
        let fieldsSchema = schema.fields;
        let obj = {};
        if (!fieldsSchema._id && schema.collectionName && (!fields || fields._id)) {
            obj._id = this._id || null;
        }
        for (let name in fieldsSchema) {
            if (fields && !fields[name]) {
                continue;
            }
            let value;
            if (fieldsSchema[name].type && fieldsSchema[name].type().$schema.collectionName) {
                value = this[exports.KEY_VALUES].get(name);
                if (value instanceof Promise) {
                    value = value[exports.KEY_VALUE];
                }
            }
            else {
                value = this[name];
            }
            if (value instanceof BaseModel) {
                obj[name] = value.toObject(fields && typeof fields[name] == 'object' ? fields[name] : undefined);
            }
            else if (Array.isArray(value)) {
                obj[name] =
                    value.length && value[0] instanceof BaseModel
                        ? value.map((model) => model.toObject(fields && typeof fields[name] == 'object'
                            ? fields[name]
                            : undefined))
                        : value;
            }
            else {
                obj[name] = value;
            }
        }
        return obj;
    }
    inspectData() {
        return prettyFormat(this.toObject());
    }
    printData() {
        console.log(this.inspectData());
    }
}
exports.BaseModel = BaseModel;
