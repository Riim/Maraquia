import { CollectionAggregationOptions, FilterQuery, ObjectId } from 'mongodb';
import { isSingular } from 'pluralize';
import * as prettyFormat from 'pretty-format';
import { getDefaultInstance } from './getDefaultInstance';
import { IFindOptions, Maraquia } from './Maraquia';

const hasOwn = Object.prototype.hasOwnProperty;

export interface IFieldSchema {
	dbFieldName?: string;
	type?: () => typeof BaseModel;
	default?: any;
	validate?:
		| ((value: any) => Error | string | boolean | undefined)
		| {
				validate: (value: any, options: any) => { error: any };
		  };
}

export interface IIndex {
	fields: Record<string, 1 | -1> | Array<string>;
	options?: Record<string, any>;
}

export interface ISchema {
	collectionName?: string | null;
	fields: Record<string, IFieldSchema>;
	indexes?: Array<IIndex> | null;
}

export const KEY_REFERENCE_FIELDS = Symbol('Maraquia/BaseModel[referenceFields]');
export const KEY_DB_COLLECTION_INITIALIZED = Symbol('Maraquia/BaseModel[collectionInitialized]');
export const KEY_DATA = Symbol('Maraquia/BaseModel[data]');
export const KEY_VALUES = Symbol('Maraquia/BaseModel[values]');
export const KEY_VALUE = Symbol('Maraquia/BaseModel[value]');

let currentlyValueSetting = false;

export class BaseModel {
	static $schema: ISchema;

	static [KEY_REFERENCE_FIELDS]: Set<string> | undefined;
	static [KEY_DB_COLLECTION_INITIALIZED]: true | undefined;

	static _m: Maraquia;

	static use(m: Maraquia): typeof BaseModel {
		this._m = m;
		return this;
	}

	static async getMaraquia(): Promise<Maraquia> {
		return this._m || (await getDefaultInstance());
	}

	static async exists<T = any>(query: FilterQuery<T>): Promise<boolean> {
		return (this._m || (await getDefaultInstance())).exists(this, query);
	}

	static async find<T extends BaseModel>(
		query?: FilterQuery<T> | null,
		resolvedFields?: Array<keyof T> | null,
		options?: IFindOptions
	): Promise<Array<T>> {
		return (this._m || (await getDefaultInstance())).find<T>(
			this,
			query,
			resolvedFields,
			options
		);
	}

	static async findOne<T extends BaseModel>(
		query?: FilterQuery<T> | null,
		resolvedFields?: Array<keyof T>
	): Promise<T | null> {
		return (this._m || (await getDefaultInstance())).findOne<T>(this, query, resolvedFields);
	}

	static async aggregate<T extends BaseModel>(
		pipeline?: Array<Object>,
		options?: CollectionAggregationOptions
	): Promise<Array<T>> {
		return (this._m || (await getDefaultInstance())).aggregate<T>(this, pipeline, options);
	}

	static async remove<T = any>(query: FilterQuery<T>): Promise<boolean> {
		return (this._m || (await getDefaultInstance())).removeOne(this, query);
	}

	m: Maraquia;

	[KEY_DATA]: Record<string, any>;
	[KEY_VALUES]: Map<string, ObjectId | Array<ObjectId> | Promise<any> | null>;

	_id: ObjectId | null;

	constructor(data?: Record<string, any> | null, m?: Maraquia) {
		let fieldSchemas = (this.constructor as typeof BaseModel).$schema.fields;
		let referenceFields: Set<string>;

		if ((this.constructor as typeof BaseModel).hasOwnProperty(KEY_REFERENCE_FIELDS)) {
			referenceFields = (this.constructor as typeof BaseModel)[KEY_REFERENCE_FIELDS]!;
		} else {
			referenceFields = (this.constructor as typeof BaseModel)[
				KEY_REFERENCE_FIELDS
			] = new Set();

			for (let name in fieldSchemas) {
				if (hasOwn.call(fieldSchemas, name)) {
					let fieldSchema = fieldSchemas[name];

					if (fieldSchema.type && fieldSchema.type().$schema.collectionName) {
						referenceFields.add(fieldSchema.dbFieldName || name);
					}
				}
			}
		}

		if (m) {
			this.m = m;
		}

		this[KEY_DATA] = data || {};
		this[KEY_VALUES] = new Map();

		if (!fieldSchemas._id) {
			this._id = (data && data._id) || null;
		}

		currentlyValueSetting = true;

		try {
			for (let name in fieldSchemas) {
				if (!hasOwn.call(fieldSchemas, name)) {
					continue;
				}

				let fieldSchema = fieldSchemas[name];
				let value = data && data[fieldSchema.dbFieldName || name];

				if (fieldSchema.type) {
					let fieldType = fieldSchema.type();

					if (fieldType.$schema.collectionName) {
						if (value != null) {
							let isArray = Array.isArray(value);

							if (!isArray || value.length) {
								if ((isArray ? value[0] : value) instanceof ObjectId) {
									this[KEY_VALUES].set(name, isArray ? value.slice() : value);
								} else {
									if (!((isArray ? value[0] : value) instanceof BaseModel)) {
										value = isArray
											? value.map(
													(itemData: any) => new fieldType(itemData, m)
											  )
											: new fieldType(value, m);

										if (isArray && value.length == 1 && isSingular(name)) {
											value = value[0];
											data![fieldSchema.dbFieldName || name] = value;
										}
									}

									this._validateFieldValue(name, fieldSchema, value);

									let valuePromise = Promise.resolve(value);
									valuePromise[KEY_VALUE] = value;
									this[KEY_VALUES].set(name, valuePromise);
								}

								continue;
							}
						}

						value =
							fieldSchema.default !== undefined
								? typeof fieldSchema.default == 'function'
									? fieldSchema.default()
									: fieldSchema.default
								: this._validateFieldValue(name, fieldSchema, null);

						let valuePromise = Promise.resolve(value);
						valuePromise[KEY_VALUE] = value;
						this[KEY_VALUES].set(name, valuePromise);

						continue;
					}

					if (value != null) {
						if (!Array.isArray(value)) {
							this[name] = this._validateFieldValue(
								name,
								fieldSchema,
								value instanceof BaseModel ? value : new fieldType(value, m)
							);

							continue;
						}

						if (value.length) {
							this[name] = this._validateFieldValue(
								name,
								fieldSchema,
								value[0] instanceof BaseModel
									? value.slice()
									: value.map((itemData: any) => new fieldType(itemData, m))
							);

							continue;
						}
					}
				} else if (value != null) {
					// Поле идентификатора получит значение поля с внешней моделью:
					// `let value = data && data[fieldSchema.dbFieldName || name];`,
					// если не отменить это проверкой: `!(value[0] instanceof BaseModel)`.

					let isArray = Array.isArray(value);

					if (
						referenceFields.has(fieldSchema.dbFieldName || name)
							? isArray
								? value.length && !(value[0] instanceof BaseModel)
								: !(value instanceof BaseModel)
							: !isArray || value.length
					) {
						this[name] = this._validateFieldValue(
							name,
							fieldSchema,
							isArray ? value.slice() : value
						);

						continue;
					}
				}

				this[name] =
					fieldSchema.default !== undefined
						? typeof fieldSchema.default == 'function'
							? fieldSchema.default()
							: fieldSchema.default
						: this._validateFieldValue(name, fieldSchema, null);
			}
		} catch (err) {
			throw err;
		} finally {
			currentlyValueSetting = false;
		}
	}

	use(m: Maraquia): this {
		this.m = m;
		return this;
	}

	async fetchField<T = BaseModel | Array<BaseModel>>(name: keyof this): Promise<T | null> {
		let schema = (this.constructor as typeof BaseModel).$schema.fields[name as any];

		if (!schema) {
			throw new TypeError(`Field "${name}" is not declared`);
		}

		if (!schema.type) {
			throw new TypeError(`Field "${name}" has no type`);
		}

		let type = schema.type();
		let collectionName = type.$schema.collectionName;

		if (!collectionName) {
			throw new TypeError('$schema.collectionName is required');
		}

		let value = this[KEY_VALUES].get(name as any) as
			| ObjectId
			| Array<ObjectId>
			| Promise<T | null>
			| null;

		if (value instanceof Promise) {
			return value;
		}

		let m = this.m || (this.constructor as typeof BaseModel)._m || (await getDefaultInstance());
		let valuePromise: Promise<T | null> = Array.isArray(value)
			? m.db
					.collection(collectionName!)
					.find({ _id: { $in: value } })
					.toArray()
					.then(
						data =>
							(valuePromise[KEY_VALUE] = this._validateFieldValue(
								name as any,
								schema,
								data.map(itemData => new type(itemData, m))
							))
					)
			: m.db
					.collection(collectionName!)
					.findOne({ _id: value })
					.then(
						data =>
							(valuePromise[KEY_VALUE] = this._validateFieldValue(
								name as any,
								schema,
								new type(data, m)
							)) as any
					);

		valuePromise[KEY_VALUE] = value;
		this[KEY_VALUES].set(name as any, valuePromise);

		return valuePromise;
	}

	setField(name: keyof this, value: any, _key?: Symbol | string): this {
		if (_key && currentlyValueSetting) {
			this[_key as any] = value;
			return this;
		}

		if (!_key) {
			_key = name as any;
		}

		let schema = (this.constructor as typeof BaseModel).$schema.fields[name as any];

		if (!schema) {
			throw new TypeError(`Field "${name}" is not declared`);
		}

		if (schema.type) {
			let type = schema.type();

			if (type.$schema.collectionName) {
				if (value != null) {
					let isArray = Array.isArray(value);

					if (!isArray || value.length) {
						if ((isArray ? value[0] : value) instanceof ObjectId) {
							this[KEY_VALUES].set(name as any, value);
						} else {
							if (!((isArray ? value[0] : value) instanceof BaseModel)) {
								value = isArray
									? value.map((itemData: any) => new type(itemData))
									: new type(value);
							}

							this._validateFieldValue(name as any, schema, value);

							let valuePromise = Promise.resolve(value);
							valuePromise[KEY_VALUE] = value;
							this[KEY_VALUES].set(name as any, valuePromise);
						}

						return this;
					}
				}

				value =
					schema.default !== undefined
						? typeof schema.default == 'function'
							? schema.default()
							: schema.default
						: this._validateFieldValue(name as any, schema, null);

				let valuePromise = Promise.resolve(value);
				valuePromise[KEY_VALUE] = value;
				this[KEY_VALUES].set(name as any, valuePromise);

				return this;
			}

			if (value != null) {
				if (!Array.isArray(value)) {
					this[_key as any] = this._validateFieldValue(
						name as any,
						schema,
						value instanceof BaseModel ? value : new type(value)
					);

					return this;
				}

				if (value.length) {
					this[_key as any] = this._validateFieldValue(
						name as any,
						schema,
						value[0] instanceof BaseModel
							? value
							: value.map(itemData => new type(itemData))
					);

					return this;
				}
			}
		} else if (value != null && (!Array.isArray(value) || value.length)) {
			this[_key as any] = this._validateFieldValue(name as any, schema, value);
			return this;
		}

		this[_key as any] =
			schema.default !== undefined
				? typeof schema.default == 'function'
					? schema.default()
					: schema.default
				: this._validateFieldValue(name as any, schema, null);

		return this;
	}

	_validateFieldValue<T>(fieldName: string, fieldSchema: IFieldSchema, value: T): T {
		if (fieldSchema.validate) {
			// joi возвращает { validate: () => { error: ValidationError | null } }

			let result =
				typeof fieldSchema.validate == 'function'
					? fieldSchema.validate(value)
					: fieldSchema.validate.validate(value, { convert: false });

			if (result === false) {
				throw new TypeError(
					`Not valid value "${prettyFormat(value)}" for field "${fieldName}"`
				);
			}
			if (typeof result == 'string') {
				throw new TypeError(result);
			}
			if (result instanceof Error) {
				throw result;
			}
			if (result && typeof result == 'object' && result.error) {
				throw result.error;
			}
		}

		return value;
	}

	async save(): Promise<boolean> {
		return (
			this.m ||
			(this.constructor as typeof BaseModel)._m ||
			(await getDefaultInstance())
		).save(this);
	}

	async remove(): Promise<boolean> {
		return (
			this.m ||
			(this.constructor as typeof BaseModel)._m ||
			(await getDefaultInstance())
		).removeOne(this);
	}

	beforeSave: (() => Promise<any> | void) | undefined;
	afterSave: (() => Promise<any> | void) | undefined;
	beforeRemove: (() => Promise<any> | void) | undefined;
	afterRemove: (() => Promise<any> | void) | undefined;

	toData(fields?: Record<string, any>, methodName = 'toData'): Object {
		let schema = (this.constructor as typeof BaseModel).$schema;
		let fieldSchemas = schema.fields;
		let obj: Record<string, any> = {};

		if (!fieldSchemas._id && schema.collectionName && (!fields || fields._id)) {
			obj._id = this._id || null;
		}

		for (let name in fieldSchemas) {
			if ((fields && !fields[name]) || !hasOwn.call(fieldSchemas, name)) {
				continue;
			}

			let value;

			if (fieldSchemas[name].type && fieldSchemas[name].type!().$schema.collectionName) {
				value = this[KEY_VALUES].get(name);

				if (value instanceof Promise) {
					value = value[KEY_VALUE];
				}
			} else {
				value = this[name];
			}

			if (value instanceof BaseModel) {
				switch (value[methodName].length) {
					case 0: {
						obj[name] = value[methodName]();
						break;
					}
					case 1: {
						obj[name] = value[methodName](
							fields && typeof fields[name] == 'object'
								? (fields[name] as any)
								: undefined
						);

						break;
					}
					default: {
						obj[name] = value[methodName](
							fields && typeof fields[name] == 'object'
								? (fields[name] as any)
								: undefined,
							methodName
						);

						break;
					}
				}
			} else if (Array.isArray(value)) {
				obj[name] =
					value.length && value[0] instanceof BaseModel
						? value.map((model: BaseModel) => {
								switch (model[methodName].length) {
									case 0: {
										return model[methodName]();
									}
									case 1: {
										return model[methodName](
											fields && typeof fields[name] == 'object'
												? (fields[name] as any)
												: undefined
										);
									}
									default: {
										return model[methodName](
											fields && typeof fields[name] == 'object'
												? (fields[name] as any)
												: undefined,
											methodName
										);
									}
								}
						  })
						: value;
			} else {
				obj[name] = value;
			}
		}

		return obj;
	}

	inspectData(): string {
		return prettyFormat(this.toData());
	}

	printData() {
		console.log(this.inspectData());
	}
}
