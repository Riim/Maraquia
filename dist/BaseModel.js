"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("mongodb");
const pluralize_1 = require("pluralize");
const prettyFormat = require("pretty-format");
const getDefaultInstance_1 = require("./getDefaultInstance");
const hasOwn = Object.prototype.hasOwnProperty;
exports.KEY_REFERENCE_FIELDS = Symbol('Maraquia/BaseModel[referenceFields]');
exports.KEY_DB_COLLECTION_INITIALIZED = Symbol('Maraquia/BaseModel[collectionInitialized]');
exports.KEY_DATA = Symbol('Maraquia/BaseModel[data]');
exports.KEY_VALUES = Symbol('Maraquia/BaseModel[values]');
exports.KEY_VALUE = Symbol('Maraquia/BaseModel[value]');
let currentlyValueSetting = false;
class BaseModel {
    constructor(data, m) {
        let fieldSchemas = this.constructor.$schema.fields;
        let referenceFields;
        if (this.constructor.hasOwnProperty(exports.KEY_REFERENCE_FIELDS)) {
            referenceFields = this.constructor[exports.KEY_REFERENCE_FIELDS];
        }
        else {
            referenceFields = this.constructor[exports.KEY_REFERENCE_FIELDS] = new Set();
            for (let name in fieldSchemas) {
                if (hasOwn.call(fieldSchemas, name)) {
                    let fieldSchema = fieldSchemas[name];
                    if (fieldSchema.type && fieldSchema.type().$schema.collectionName) {
                        referenceFields.add(fieldSchema.dbFieldName || name);
                    }
                }
            }
        }
        if (m) {
            this.m = m;
        }
        this[exports.KEY_DATA] = data || {};
        this[exports.KEY_VALUES] = new Map();
        if (!fieldSchemas._id) {
            this._id = (data && data._id) || null;
        }
        currentlyValueSetting = true;
        try {
            for (let name in fieldSchemas) {
                if (!hasOwn.call(fieldSchemas, name)) {
                    continue;
                }
                let fieldSchema = fieldSchemas[name];
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
                                        if (isArray && value.length == 1 && pluralize_1.isSingular(name)) {
                                            value = value[0];
                                            data[fieldSchema.dbFieldName || name] = value;
                                        }
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
    static use(m) {
        this._m = m;
        return this;
    }
    static async exists(query) {
        return (this._m || (await getDefaultInstance_1.getDefaultInstance())).exists(this, query);
    }
    static async find(query, resolvedFields, options) {
        return (this._m || (await getDefaultInstance_1.getDefaultInstance())).find(this, query, resolvedFields, options);
    }
    static async findOne(query, resolvedFields) {
        return (this._m || (await getDefaultInstance_1.getDefaultInstance())).findOne(this, query, resolvedFields);
    }
    static async aggregate(pipeline, options) {
        return (this._m || (await getDefaultInstance_1.getDefaultInstance())).aggregate(this, pipeline, options);
    }
    use(m) {
        this.m = m;
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
        let m = this.m || this.constructor._m || (await getDefaultInstance_1.getDefaultInstance());
        let valuePromise = Array.isArray(value)
            ? m.db
                .collection(collectionName)
                .find({ _id: { $in: value } })
                .toArray()
                .then(data => (valuePromise[exports.KEY_VALUE] = this._validateFieldValue(name, schema, data.map(itemData => new type(itemData, m)))))
            : m.db
                .collection(collectionName)
                .findOne({ _id: value })
                .then(data => (valuePromise[exports.KEY_VALUE] = this._validateFieldValue(name, schema, new type(data, m))));
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
                                    ? value.map((itemData) => new type(itemData))
                                    : new type(value);
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
                    this[_key] = this._validateFieldValue(name, schema, value instanceof BaseModel ? value : new type(value));
                    return this;
                }
                if (value.length) {
                    this[_key] = this._validateFieldValue(name, schema, value[0] instanceof BaseModel
                        ? value
                        : value.map(itemData => new type(itemData)));
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
    async save() {
        return (this.m ||
            this.constructor._m ||
            (await getDefaultInstance_1.getDefaultInstance())).save(this);
    }
    async remove() {
        return (this.m ||
            this.constructor._m ||
            (await getDefaultInstance_1.getDefaultInstance())).remove(this);
    }
    toData(fields, methodName = 'toData') {
        let schema = this.constructor.$schema;
        let fieldSchemas = schema.fields;
        let obj = {};
        if (!fieldSchemas._id && schema.collectionName && (!fields || fields._id)) {
            obj._id = this._id || null;
        }
        for (let name in fieldSchemas) {
            if ((fields && !fields[name]) || !hasOwn.call(fieldSchemas, name)) {
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
