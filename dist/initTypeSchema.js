"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function initTypeSchema(type) {
    if (type.hasOwnProperty('$schema')) {
        return type.$schema;
    }
    let parentSchema = Object.getPrototypeOf(type).$schema;
    let schema;
    if (parentSchema) {
        schema = type.$schema = { __proto__: parentSchema };
        schema.fields = { __proto__: schema.fields };
    }
    else {
        schema = type.$schema = { fields: {} };
    }
    return schema;
}
exports.initTypeSchema = initTypeSchema;
