"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function initModelClassSchema(modelConstr) {
    if (modelConstr.hasOwnProperty('$schema')) {
        return modelConstr.$schema;
    }
    let parentSchema = Object.getPrototypeOf(modelConstr).$schema;
    let schema;
    if (parentSchema) {
        schema = modelConstr.$schema = {
            __proto__: parentSchema,
            fields: { __proto__: parentSchema.fields }
        };
    }
    else {
        schema = modelConstr.$schema = { fields: {} };
    }
    return schema;
}
exports.initModelClassSchema = initModelClassSchema;
