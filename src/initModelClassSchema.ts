import { BaseModel, ISchema } from './BaseModel';

export function initModelClassSchema(modelCtor: typeof BaseModel): ISchema {
	if (modelCtor.hasOwnProperty('$schema')) {
		return modelCtor.$schema;
	}

	let parentSchema: ISchema | undefined = Object.getPrototypeOf(modelCtor).$schema;
	let schema: ISchema;

	if (parentSchema) {
		schema = modelCtor.$schema = {
			__proto__: parentSchema,
			fields: { __proto__: parentSchema.fields }
		} as any;
	} else {
		schema = modelCtor.$schema = { fields: {} };
	}

	return schema;
}
