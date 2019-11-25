"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function initModelClassSchema(modelCtor) {
    if (modelCtor.hasOwnProperty('$schema')) {
        return modelCtor.$schema;
    }
    let parentSchema = Object.getPrototypeOf(modelCtor).$schema;
    let schema;
    if (parentSchema) {
        schema = modelCtor.$schema = {
            __proto__: parentSchema,
            fields: { __proto__: parentSchema.fields }
        };
    }
    else {
        schema = modelCtor.$schema = { fields: {} };
    }
    return schema;
}
exports.initModelClassSchema = initModelClassSchema;
