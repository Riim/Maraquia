"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var initTypeSchema_1 = require("../initTypeSchema");
function Field(typeOrOptions, options) {
    var type;
    if (typeof typeOrOptions == 'object') {
        options = typeOrOptions;
    }
    else if (typeOrOptions) {
        type = typeOrOptions;
    }
    if (!type && options && options.type) {
        type = options.type;
    }
    return function (target, propertyName, propertyDesc) {
        var schema = (initTypeSchema_1.initTypeSchema(target.constructor).fields[propertyName] = {});
        if (options && options.dbFieldName) {
            schema.dbFieldName = options.dbFieldName;
        }
        if (type) {
            schema.type = type;
        }
        if (options && options.default != null) {
            schema.default = options.default;
        }
        if (options && options.validate) {
            schema.validate = options.validate;
        }
        var KEY_VALUE = Symbol("Maraquia/Field[value:" + propertyName + "]");
        return {
            configurable: true,
            enumerable: true,
            get: function () {
                return type && type().$schema.collectionName
                    ? this.fetchField(propertyName)
                    : this[KEY_VALUE];
            },
            set: function (value) {
                this.setField(propertyName, value, KEY_VALUE);
            }
        };
    };
}
exports.Field = Field;
