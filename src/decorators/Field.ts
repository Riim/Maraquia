import { BaseModel, IFieldSchema } from '../BaseModel';
import { initTypeSchema } from '../initTypeSchema';

export function Field(type?: () => typeof BaseModel, options?: IFieldSchema): any;
export function Field(options?: IFieldSchema): any;
export function Field(
	typeOrOptions?: (() => typeof BaseModel) | IFieldSchema,
	options?: IFieldSchema
) {
	let type: (() => typeof BaseModel) | undefined;

	if (typeof typeOrOptions == 'object') {
		options = typeOrOptions;
	} else if (typeOrOptions) {
		type = typeOrOptions;
	}

	if (!type && options && options.type) {
		type = options.type;
	}

	return (target: BaseModel, propertyName: string, propertyDesc?: PropertyDescriptor): any => {
		let schema: IFieldSchema = (initTypeSchema(target.constructor as any).fields[
			propertyName
		] = {});

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

		const KEY_VALUE = Symbol(`Maraquia/Field[value:${propertyName}]`);

		return {
			configurable: true,
			enumerable: true,

			get(this: BaseModel) {
				return type && type().$schema.collectionName
					? this.fetchField(propertyName as any)
					: this[KEY_VALUE];
			},

			set(this: BaseModel, value: any) {
				this.setField(propertyName as any, value, KEY_VALUE);
			}
		};
	};
}
