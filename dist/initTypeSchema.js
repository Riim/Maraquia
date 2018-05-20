"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function initTypeSchema(type) {
    if (type.hasOwnProperty('$schema')) {
        return type.$schema;
    }
    var parentSchema = Object.getPrototypeOf(type).$schema;
    var schema;
    if (parentSchema) {
        schema = type.$schema = Object.create(parentSchema);
        schema.fields = Object.create(schema.fields);
    }
    else {
        schema = type.$schema = { fields: {} };
    }
    return schema;
}
exports.initTypeSchema = initTypeSchema;
