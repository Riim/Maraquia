import { BaseModel, ISchema } from './BaseModel';

export function initTypeSchema(type: typeof BaseModel): ISchema {
	if (type.hasOwnProperty('$schema')) {
		return type.$schema;
	}

	let parentSchema: ISchema | undefined = Object.getPrototypeOf(type).$schema;
	let schema: ISchema;

	if (parentSchema) {
		schema = type.$schema = Object.create(parentSchema);
		schema.fields = Object.create(schema.fields);
	} else {
		schema = type.$schema = { fields: {} };
	}

	return schema;
}
