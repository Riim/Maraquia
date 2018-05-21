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
var BaseModel_1 = require("./BaseModel");
var initCollection_1 = require("./initCollection");
var initDocument_1 = require("./initDocument");
var setKeypath_1 = require("./lib/setKeypath");
var currentlySavedModels = new Set();
var Maraquia = /** @class */ (function () {
    function Maraquia(db) {
        this.db = db;
    }
    Maraquia.prototype.exists = function (type, query) {
        return __awaiter(this, void 0, void 0, function () {
            var collectionName;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        collectionName = type.$schema.collectionName;
                        if (!collectionName) {
                            throw new TypeError('$schema.collectionName is required');
                        }
                        if (!!type[BaseModel_1.KEY_DB_COLLECTION_INITIALIZED]) return [3 /*break*/, 2];
                        return [4 /*yield*/, initCollection_1.initCollection(type, this)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [4 /*yield*/, this.db.collection(collectionName).findOne(query)];
                    case 3: return [2 /*return*/, !!(_a.sent())];
                }
            });
        });
    };
    Maraquia.prototype.find = function (type, query, resolvedFields) {
        return __awaiter(this, void 0, void 0, function () {
            var collectionName, aggregationPipeline, _i, resolvedFields_1, fieldName, fieldSchema, fieldType, fieldTypeCollectionName, data_1, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        collectionName = type.$schema.collectionName;
                        if (!collectionName) {
                            throw new TypeError('$schema.collectionName is required');
                        }
                        if (!!type[BaseModel_1.KEY_DB_COLLECTION_INITIALIZED]) return [3 /*break*/, 2];
                        return [4 /*yield*/, initCollection_1.initCollection(type, this)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        if (!resolvedFields) return [3 /*break*/, 4];
                        aggregationPipeline = [{ $match: query }, { $limit: 1 }];
                        for (_i = 0, resolvedFields_1 = resolvedFields; _i < resolvedFields_1.length; _i++) {
                            fieldName = resolvedFields_1[_i];
                            fieldSchema = type.$schema.fields[fieldName];
                            if (!fieldSchema) {
                                throw new TypeError("Field \"" + fieldName + "\" is not declared");
                            }
                            fieldType = fieldSchema.type;
                            if (!fieldType) {
                                throw new TypeError("Field \"" + fieldName + "\" has not type");
                            }
                            fieldTypeCollectionName = fieldType().$schema.collectionName;
                            if (!fieldTypeCollectionName) {
                                throw new TypeError("$schema.collectionName of type \"" + fieldType().name + "\" is required");
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
                        return [4 /*yield*/, this.db
                                .collection(collectionName)
                                .aggregate(aggregationPipeline)
                                .toArray()];
                    case 3:
                        data_1 = (_a.sent())[0];
                        return [2 /*return*/, data_1 ? new type(data_1, this) : null];
                    case 4: return [4 /*yield*/, this.db.collection(collectionName).findOne(query)];
                    case 5:
                        data = _a.sent();
                        return [2 /*return*/, data ? new type(data, this) : null];
                }
            });
        });
    };
    Maraquia.prototype.findAll = function (type, query, resolvedFields) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            var collectionName, aggregationPipeline, _i, resolvedFields_2, fieldName, fieldSchema, fieldType, fieldTypeCollectionName;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        collectionName = type.$schema.collectionName;
                        if (!collectionName) {
                            throw new TypeError('$schema.collectionName is required');
                        }
                        if (!!type[BaseModel_1.KEY_DB_COLLECTION_INITIALIZED]) return [3 /*break*/, 2];
                        return [4 /*yield*/, initCollection_1.initCollection(type, this)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        if (!resolvedFields) return [3 /*break*/, 4];
                        aggregationPipeline = [{ $match: query }];
                        for (_i = 0, resolvedFields_2 = resolvedFields; _i < resolvedFields_2.length; _i++) {
                            fieldName = resolvedFields_2[_i];
                            fieldSchema = type.$schema.fields[fieldName];
                            if (!fieldSchema) {
                                throw new TypeError("Field \"" + fieldName + "\" is not declared");
                            }
                            fieldType = fieldSchema.type;
                            if (!fieldType) {
                                throw new TypeError("Field \"" + fieldName + "\" has not type");
                            }
                            fieldTypeCollectionName = fieldType().$schema.collectionName;
                            if (!fieldTypeCollectionName) {
                                throw new TypeError("$schema.collectionName of type \"" + fieldType().name + "\" is required");
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
                        return [4 /*yield*/, this.db
                                .collection(collectionName)
                                .aggregate(aggregationPipeline)
                                .toArray()];
                    case 3: return [2 /*return*/, (_a.sent()).map(function (data) { return new type(data, _this); })];
                    case 4: return [4 /*yield*/, this.db
                            .collection(collectionName)
                            .find(query)
                            .toArray()];
                    case 5: return [2 /*return*/, (_a.sent()).map(function (data) { return new type(data, _this); })];
                }
            });
        });
    };
    Maraquia.prototype.save = function (model) {
        return __awaiter(this, void 0, void 0, function () {
            var type, collectionName, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (currentlySavedModels.size) {
                            throw new Error('Cannot save when saving');
                        }
                        type = model.constructor;
                        collectionName = type.$schema.collectionName;
                        if (!collectionName) {
                            throw new TypeError('$schema.collectionName is required');
                        }
                        if (!!type[BaseModel_1.KEY_DB_COLLECTION_INITIALIZED]) return [3 /*break*/, 2];
                        return [4 /*yield*/, initCollection_1.initCollection(type, this)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, 5, 6]);
                        return [4 /*yield*/, this._save(model)];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 4:
                        err_1 = _a.sent();
                        throw err_1;
                    case 5:
                        currentlySavedModels.clear();
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/, true];
                }
            });
        });
    };
    Maraquia.prototype._save = function (model) {
        return __awaiter(this, void 0, void 0, function () {
            var schema, query, r, r;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        currentlySavedModels.add(model);
                        if (model.m) {
                            if (model.m !== this) {
                                throw new TypeError('Cannot replace Maraquia instance on model');
                            }
                        }
                        else {
                            model.m = this;
                        }
                        schema = model.constructor.$schema;
                        if (!!model._id) return [3 /*break*/, 2];
                        return [4 /*yield*/, initDocument_1.initDocument(this, model, schema.collectionName)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [4 /*yield*/, this._save$(model, schema, model._id !== model[BaseModel_1.KEY_DATA]._id, '', {})];
                    case 3:
                        query = _a.sent();
                        if (!model.beforeSave) return [3 /*break*/, 5];
                        r = model.beforeSave();
                        if (!(r instanceof Promise)) return [3 /*break*/, 5];
                        return [4 /*yield*/, r];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: 
                    // console.log('model._id:', model._id);
                    // console.log('query:', query);
                    return [4 /*yield*/, this.db.collection(schema.collectionName).updateOne({ _id: model._id }, query)];
                    case 6:
                        // console.log('model._id:', model._id);
                        // console.log('query:', query);
                        _a.sent();
                        updateData(model, query);
                        if (!model.afterSave) return [3 /*break*/, 8];
                        r = model.afterSave();
                        if (!(r instanceof Promise)) return [3 /*break*/, 8];
                        return [4 /*yield*/, r];
                    case 7:
                        _a.sent();
                        _a.label = 8;
                    case 8: return [2 /*return*/, true];
                }
            });
        });
    };
    Maraquia.prototype._save$ = function (model, typeSchema, isNew, keypath, query) {
        return __awaiter(this, void 0, void 0, function () {
            var fieldsSchema, values, _a, _b, _i, name, fieldSchema, fieldKeypath, fieldValue, fieldTypeSchema, modelListLength, i, modelListLength, equal, q, i, _;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        fieldsSchema = typeSchema.fields;
                        values = model[BaseModel_1.KEY_VALUES];
                        _a = [];
                        for (_b in fieldsSchema)
                            _a.push(_b);
                        _i = 0;
                        _c.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 27];
                        name = _a[_i];
                        fieldSchema = fieldsSchema[name];
                        fieldKeypath = (keypath ? keypath + '.' : '') + (fieldSchema.dbFieldName || name);
                        fieldValue = void 0;
                        if (!fieldSchema.type) return [3 /*break*/, 25];
                        fieldTypeSchema = fieldSchema.type().$schema;
                        if (fieldTypeSchema.collectionName) {
                            fieldValue = values.get(name);
                            if (fieldValue instanceof Promise) {
                                fieldValue = fieldValue[BaseModel_1.KEY_VALUE];
                            }
                        }
                        else {
                            fieldValue = model[name];
                        }
                        if (!fieldValue) return [3 /*break*/, 23];
                        if (!fieldTypeSchema.collectionName) return [3 /*break*/, 13];
                        if (!Array.isArray(fieldValue)) return [3 /*break*/, 9];
                        modelListLength = fieldValue.length;
                        if (!modelListLength) return [3 /*break*/, 7];
                        if (!(fieldValue[0] instanceof BaseModel_1.BaseModel)) return [3 /*break*/, 6];
                        i = 0;
                        _c.label = 2;
                    case 2:
                        if (!(i < modelListLength)) return [3 /*break*/, 5];
                        if (!!currentlySavedModels.has(fieldValue[i])) return [3 /*break*/, 4];
                        return [4 /*yield*/, this._save(fieldValue[i])];
                    case 3:
                        _c.sent();
                        _c.label = 4;
                    case 4:
                        i++;
                        return [3 /*break*/, 2];
                    case 5:
                        if (isNew ||
                            !isModelListEqual(fieldValue, model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name], true)) {
                            (query.$set || (query.$set = {}))[fieldKeypath] = fieldValue.map(function (model) { return model._id; });
                        }
                        _c.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        if (!isNew &&
                            (model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name] || []).length) {
                            (query.$unset || (query.$unset = {}))[fieldKeypath] = true;
                        }
                        _c.label = 8;
                    case 8: return [3 /*break*/, 12];
                    case 9:
                        if (!(fieldValue instanceof BaseModel_1.BaseModel)) return [3 /*break*/, 12];
                        if (!!currentlySavedModels.has(fieldValue)) return [3 /*break*/, 11];
                        return [4 /*yield*/, this._save(fieldValue)];
                    case 10:
                        _c.sent();
                        _c.label = 11;
                    case 11:
                        if (fieldValue._id !== model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name]) {
                            (query.$set || (query.$set = {}))[fieldKeypath] = fieldValue._id;
                        }
                        _c.label = 12;
                    case 12: return [3 /*break*/, 22];
                    case 13:
                        if (!Array.isArray(fieldValue)) return [3 /*break*/, 20];
                        modelListLength = fieldValue.length;
                        if (!modelListLength) return [3 /*break*/, 18];
                        equal = isModelListEqual(fieldValue, model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name], false);
                        q = equal && !isNew ? query : {};
                        i = 0;
                        _c.label = 14;
                    case 14:
                        if (!(i < modelListLength)) return [3 /*break*/, 17];
                        return [4 /*yield*/, this._save$(fieldValue[i], fieldTypeSchema, isNew, fieldKeypath + '.' + i, q)];
                    case 15:
                        _c.sent();
                        _c.label = 16;
                    case 16:
                        i++;
                        return [3 /*break*/, 14];
                    case 17:
                        if (!equal || isNew) {
                            for (_ in q) {
                                (query.$set || (query.$set = {}))[fieldKeypath] = fieldValue.map(function (model) { return model.toObject(); });
                                break;
                            }
                        }
                        return [3 /*break*/, 19];
                    case 18:
                        if (!isNew &&
                            (model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name] || []).length) {
                            (query.$unset || (query.$unset = {}))[fieldKeypath] = true;
                        }
                        _c.label = 19;
                    case 19: return [3 /*break*/, 22];
                    case 20: return [4 /*yield*/, this._save$(fieldValue, fieldTypeSchema, isNew ||
                            fieldValue !== model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name], fieldKeypath, query)];
                    case 21:
                        _c.sent();
                        _c.label = 22;
                    case 22: return [3 /*break*/, 24];
                    case 23:
                        if (!isNew && model[BaseModel_1.KEY_DATA][fieldSchema.dbFieldName || name]) {
                            (query.$unset || (query.$unset = {}))[fieldKeypath] = true;
                        }
                        _c.label = 24;
                    case 24: return [3 /*break*/, 26];
                    case 25:
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
                        _c.label = 26;
                    case 26:
                        _i++;
                        return [3 /*break*/, 1];
                    case 27: return [2 /*return*/, query];
                }
            });
        });
    };
    Maraquia.prototype.remove = function (model) {
        return __awaiter(this, void 0, void 0, function () {
            var collectionName, r, result, r;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        collectionName = model.constructor.$schema.collectionName;
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
                        if (!model.beforeRemove) return [3 /*break*/, 2];
                        r = model.beforeRemove();
                        if (!(r instanceof Promise)) return [3 /*break*/, 2];
                        return [4 /*yield*/, r];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [4 /*yield*/, this.db
                            .collection(collectionName)
                            .remove({ _id: model._id }, true)];
                    case 3:
                        result = (_a.sent()).nRemoved == 1;
                        if (!model.afterRemove) return [3 /*break*/, 5];
                        r = model.afterRemove();
                        if (!(r instanceof Promise)) return [3 /*break*/, 5];
                        return [4 /*yield*/, r];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [2 /*return*/, result];
                }
            });
        });
    };
    return Maraquia;
}());
exports.Maraquia = Maraquia;
function isModelListEqual(a, b, useId) {
    if (!b) {
        return false;
    }
    var aLength = a.length;
    if (useId && aLength && !(a[0] instanceof BaseModel_1.BaseModel)) {
        return true;
    }
    if (aLength != b.length) {
        return false;
    }
    if (useId) {
        for (var i = aLength; i;) {
            if (a[--i]._id !== b[i]) {
                return false;
            }
        }
    }
    else {
        for (var i = aLength; i;) {
            if (a[--i] != b[i]) {
                return false;
            }
        }
    }
    return true;
}
function updateData(model, query) {
    var $set = query.$set;
    if ($set) {
        for (var keypath in $set) {
            setKeypath_1.setKeypath(model, keypath, $set[keypath]);
        }
    }
    var $unset = query.$unset;
    if ($unset) {
        for (var keypath in $unset) {
            setKeypath_1.setKeypath(model, keypath, null);
        }
    }
}
