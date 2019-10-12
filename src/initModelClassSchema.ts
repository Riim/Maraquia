import { BaseModel, ISchema } from './BaseModel';

export function initModelClassSchema(modelConstr: typeof BaseModel): ISchema {
	if (modelConstr.hasOwnProperty('$schema')) {
		return modelConstr.$schema;
	}

	let parentSchema: ISchema | undefined = Object.getPrototypeOf(modelConstr).$schema;
	let schema: ISchema;

	if (parentSchema) {
		schema = modelConstr.$schema = {
			__proto__: parentSchema,
			fields: { __proto__: parentSchema.fields }
		} as any;
	} else {
		schema = modelConstr.$schema = { fields: {} };
	}

	return schema;
}
