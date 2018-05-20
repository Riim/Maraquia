"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var mongodb_1 = require("mongodb");
var prettyFormat = require("pretty-format");
var getDefaultMaraquiaInstance_1 = require("./getDefaultMaraquiaInstance");
exports.KEY_REFERENCE_FIELDS = Symbol('Maraquia/BaseModel[referenceFields]');
exports.KEY_DB_COLLECTION_INITIALIZED = Symbol('Maraquia/BaseModel[collectionInitialized]');
exports.KEY_DATA = Symbol('Maraquia/BaseModel[data]');
exports.KEY_VALUES = Symbol('Maraquia/BaseModel[values]');
exports.KEY_VALUE = Symbol('Maraquia/BaseModel[value]');
var currentlyValueSetting = false;
var BaseModel = /** @class */ (function () {
    function BaseModel(data, m) {
        var fieldsSchema = this.constructor.$schema.fields;
        var referenceFields = this.constructor[exports.KEY_REFERENCE_FIELDS];
        if (!referenceFields) {
            referenceFields = this.constructor[exports.KEY_REFERENCE_FIELDS] = new Set();
            for (var name in fieldsSchema) {
                var fieldSchema = fieldsSchema[name];
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
            var _loop_1 = function (name) {
                var fieldSchema = fieldsSchema[name];
                var value = data && data[fieldSchema.dbFieldName || name];
                if (fieldSchema.type) {
                    var fieldType_1 = fieldSchema.type();
                    if (fieldType_1.$schema.collectionName) {
                        if (value != null) {
                            var isArray = Array.isArray(value);
                            if (!isArray || value.length) {
                                if ((isArray ? value[0] : value) instanceof mongodb_1.ObjectId) {
                                    this_1[exports.KEY_VALUES].set(name, isArray ? value.slice() : value);
                                }
                                else {
                                    if (!((isArray ? value[0] : value) instanceof BaseModel)) {
                                        value = isArray
                                            ? value.map(function (itemData) { return new fieldType_1(itemData); })
                                            : new fieldType_1(value);
                                    }
                                    this_1._validateFieldValue(name, fieldSchema, value);
                                    var valuePromise_1 = Promise.resolve(value);
                                    valuePromise_1[exports.KEY_VALUE] = value;
                                    this_1[exports.KEY_VALUES].set(name, valuePromise_1);
                                }
                                return "continue";
                            }
                        }
                        value =
                            fieldSchema.default != null
                                ? typeof fieldSchema.default == 'function'
                                    ? fieldSchema.default()
                                    : fieldSchema.default
                                : this_1._validateFieldValue(name, fieldSchema, null);
                        var valuePromise = Promise.resolve(value);
                        valuePromise[exports.KEY_VALUE] = value;
                        this_1[exports.KEY_VALUES].set(name, valuePromise);
                        return "continue";
                    }
                    if (value != null) {
                        if (!Array.isArray(value)) {
                            this_1[name] = this_1._validateFieldValue(name, fieldSchema, value instanceof BaseModel ? value : new fieldType_1(value));
                            return "continue";
                        }
                        if (value.length) {
                            this_1[name] = this_1._validateFieldValue(name, fieldSchema, value[0] instanceof BaseModel
                                ? value.slice()
                                : value.map(function (itemData) { return new fieldType_1(itemData); }));
                            return "continue";
                        }
                    }
                }
                else if (value != null) {
                    // при передаче в конструктор полей с внешними моделями поля идентификаторов
                    // забирают эти значения себе,
                    // отменяем это через `!(value[0] instanceof BaseModel)`
                    var isArray = Array.isArray(value);
                    if (referenceFields.has(fieldSchema.dbFieldName || name)
                        ? isArray
                            ? value.length && !(value[0] instanceof BaseModel)
                            : !(value instanceof BaseModel)
                        : !isArray || value.length) {
                        this_1[name] = this_1._validateFieldValue(name, fieldSchema, isArray ? value.slice() : value);
                        return "continue";
                    }
                }
                this_1[name] =
                    fieldSchema.default != null
                        ? typeof fieldSchema.default == 'function'
                            ? fieldSchema.default()
                            : fieldSchema.default
                        : this_1._validateFieldValue(name, fieldSchema, null);
            };
            var this_1 = this;
            for (var name in fieldsSchema) {
                _loop_1(name);
            }
        }
        catch (err) {
            throw err;
        }
        finally {
            currentlyValueSetting = false;
        }
    }
    BaseModel.exists = function (query, m) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = m;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, getDefaultMaraquiaInstance_1.getDefaultMaraquiaInstance()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2: return [2 /*return*/, (_a).exists(this, query)];
                }
            });
        });
    };
    BaseModel.find = function (query, m) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = m;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, getDefaultMaraquiaInstance_1.getDefaultMaraquiaInstance()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2: return [2 /*return*/, (_a).find(this, query)];
                }
            });
        });
    };
    BaseModel.findAll = function (query, m) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = m;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, getDefaultMaraquiaInstance_1.getDefaultMaraquiaInstance()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2: return [2 /*return*/, (_a).findAll(this, query)];
                }
            });
        });
    };
    BaseModel.prototype.fetchField = function (name, m) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            var schema, fieldType, collectionName, value, _a, valuePromise;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        schema = this.constructor.$schema.fields[name];
                        if (!schema) {
                            throw new TypeError("Field \"" + name + "\" is not declared");
                        }
                        if (!schema.type) {
                            throw new TypeError("Field \"" + name + "\" has no type");
                        }
                        fieldType = schema.type();
                        collectionName = fieldType.$schema.collectionName;
                        if (!collectionName) {
                            throw new TypeError('$schema.collectionName is required');
                        }
                        value = this[exports.KEY_VALUES].get(name);
                        if (value instanceof Promise) {
                            return [2 /*return*/, value];
                        }
                        if (!!m) return [3 /*break*/, 3];
                        _a = this.m;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, getDefaultMaraquiaInstance_1.getDefaultMaraquiaInstance()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2:
                        m = _a;
                        _b.label = 3;
                    case 3:
                        valuePromise = Array.isArray(value)
                            ? m.db
                                .collection(collectionName)
                                .find({ _id: { $in: value } })
                                .toArray()
                                .then(function (data) {
                                return (valuePromise[exports.KEY_VALUE] = _this._validateFieldValue(name, schema, data.map(function (itemData) { return new fieldType(itemData, m); })));
                            })
                            : m.db
                                .collection(collectionName)
                                .findOne({ _id: value })
                                .then(function (data) {
                                return (valuePromise[exports.KEY_VALUE] = _this._validateFieldValue(name, schema, new fieldType(data, m)));
                            });
                        valuePromise[exports.KEY_VALUE] = value;
                        this[exports.KEY_VALUES].set(name, valuePromise);
                        return [2 /*return*/, valuePromise];
                }
            });
        });
    };
    BaseModel.prototype.setField = function (name, value, _key) {
        if (_key && currentlyValueSetting) {
            this[_key] = value;
            return this;
        }
        if (!_key) {
            _key = name;
        }
        var schema = this.constructor.$schema.fields[name];
        if (!schema) {
            throw new TypeError("Field \"" + name + "\" is not declared");
        }
        if (schema.type) {
            var fieldType_2 = schema.type();
            if (fieldType_2.$schema.collectionName) {
                if (value != null) {
                    var isArray = Array.isArray(value);
                    if (!isArray || value.length) {
                        if ((isArray ? value[0] : value) instanceof mongodb_1.ObjectId) {
                            this[exports.KEY_VALUES].set(name, value);
                        }
                        else {
                            if (!((isArray ? value[0] : value) instanceof BaseModel)) {
                                value = isArray
                                    ? value.map(function (itemData) { return new fieldType_2(itemData); })
                                    : new fieldType_2(value);
                            }
                            this._validateFieldValue(name, schema, value);
                            var valuePromise_2 = Promise.resolve(value);
                            valuePromise_2[exports.KEY_VALUE] = value;
                            this[exports.KEY_VALUES].set(name, valuePromise_2);
                        }
                        return this;
                    }
                }
                value =
                    schema.default != null
                        ? typeof schema.default == 'function'
                            ? schema.default()
                            : schema.default
                        : this._validateFieldValue(name, schema, null);
                var valuePromise = Promise.resolve(value);
                valuePromise[exports.KEY_VALUE] = value;
                this[exports.KEY_VALUES].set(name, valuePromise);
                return this;
            }
            if (value != null) {
                if (!Array.isArray(value)) {
                    this[_key] = this._validateFieldValue(name, schema, value instanceof BaseModel ? value : new fieldType_2(value));
                    return this;
                }
                if (value.length) {
                    this[_key] = this._validateFieldValue(name, schema, value[0] instanceof BaseModel
                        ? value
                        : value.map(function (itemData) { return new fieldType_2(itemData); }));
                    return this;
                }
            }
        }
        else if (value != null && (!Array.isArray(value) || value.length)) {
            this[_key] = this._validateFieldValue(name, schema, value);
            return this;
        }
        this[_key] =
            schema.default != null
                ? typeof schema.default == 'function'
                    ? schema.default()
                    : schema.default
                : this._validateFieldValue(name, schema, null);
        return this;
    };
    BaseModel.prototype._validateFieldValue = function (fieldName, fieldSchema, value) {
        if (fieldSchema.validate) {
            // joi возвращает { validate: () => { error: ValidationError | null } }
            var result = typeof fieldSchema.validate == 'function'
                ? fieldSchema.validate(value)
                : fieldSchema.validate.validate(value);
            if (result === false) {
                throw new TypeError("Not valid value \"" + prettyFormat(value) + "\" for field \"" + fieldName + "\"");
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
    };
    BaseModel.prototype.save = function (m) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = m || this.m;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, getDefaultMaraquiaInstance_1.getDefaultMaraquiaInstance()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2: return [2 /*return*/, (_a).save(this)];
                }
            });
        });
    };
    BaseModel.prototype.remove = function (m) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = m || this.m;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, getDefaultMaraquiaInstance_1.getDefaultMaraquiaInstance()];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2: return [2 /*return*/, (_a).remove(this)];
                }
            });
        });
    };
    BaseModel.prototype.toObject = function () {
        var schema = this.constructor.$schema;
        var fieldsSchema = schema.fields;
        var obj = {};
        if (!fieldsSchema._id && (schema.collectionName || this._id)) {
            obj._id = this._id || null;
        }
        for (var name in fieldsSchema) {
            var value = void 0;
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
                obj[name] = value.toObject();
            }
            else if (Array.isArray(value)) {
                obj[name] =
                    value.length && value[0] instanceof BaseModel
                        ? value.map(function (model) { return model.toObject(); })
                        : value;
            }
            else {
                obj[name] = value;
            }
        }
        return obj;
    };
    BaseModel.prototype.inspectData = function () {
        return prettyFormat(this.toObject());
    };
    BaseModel.prototype.printData = function () {
        console.log(this.inspectData());
    };
    return BaseModel;
}());
exports.BaseModel = BaseModel;
