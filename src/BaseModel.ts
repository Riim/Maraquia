import { ObjectId } from 'mongodb';
import * as prettyFormat from 'pretty-format';
import { getDefaultMaraquiaInstance } from './getDefaultMaraquiaInstance';
import { Maraquia } from './Maraquia';

export interface IFieldSchema {
	dbFieldName?: string;
	type?: () => typeof BaseModel;
	default?: any;
	validate?:
		| ((value: any) => Error | string | boolean | undefined)
		| {
				validate: (value: any) => { error: any };
		  };
}

export interface IIndex {
	fields: { [name: string]: 1 | -1 } | Array<string>;
	options?: { [name: string]: any };
}

export interface ISchema {
	collectionName?: string | null;
	fields: { [name: string]: IFieldSchema };
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

	static async exists(query: object, m?: Maraquia): Promise<boolean> {
		return (m || (await getDefaultMaraquiaInstance())).exists(this, query);
	}

	static async find<T extends BaseModel>(query: object, m?: Maraquia): Promise<T | null>;
	static async find<T extends BaseModel>(
		query: object,
		resolvedFields: Array<string>,
		m?: Maraquia
	): Promise<T | null>;
	static async find<T extends BaseModel>(
		query: object,
		mOrResolvedFields?: Maraquia | Array<string>,
		m?: Maraquia
	): Promise<T | null> {
		let resolvedFields: Array<string> | undefined;

		if (mOrResolvedFields) {
			if (mOrResolvedFields instanceof Maraquia) {
				m = mOrResolvedFields;
			} else {
				resolvedFields = mOrResolvedFields;
			}
		}

		return (m || (await getDefaultMaraquiaInstance())).find<T>(this, query, resolvedFields);
	}

	static async findAll<T extends BaseModel>(query: object, m?: Maraquia): Promise<Array<T>>;
	static async findAll<T extends BaseModel>(
		query: object,
		resolvedFields: Array<string>,
		m?: Maraquia
	): Promise<Array<T>>;
	static async findAll<T extends BaseModel>(
		query: object,
		mOrResolvedFields?: Maraquia | Array<string>,
		m?: Maraquia
	): Promise<Array<T>> {
		let resolvedFields: Array<string> | undefined;

		if (mOrResolvedFields) {
			if (mOrResolvedFields instanceof Maraquia) {
				m = mOrResolvedFields;
			} else {
				resolvedFields = mOrResolvedFields;
			}
		}

		return (m || (await getDefaultMaraquiaInstance())).findAll<T>(this, query, resolvedFields);
	}

	m: Maraquia;

	[KEY_DATA]: { [name: string]: any };
	[KEY_VALUES]: Map<string, ObjectId | Array<ObjectId> | Promise<any> | null>;

	_id: ObjectId | null;

	constructor(data?: { [name: string]: any }, m?: Maraquia) {
		let fieldsSchema = (this.constructor as typeof BaseModel).$schema.fields;
		let referenceFields = (this.constructor as typeof BaseModel)[KEY_REFERENCE_FIELDS];

		if (!referenceFields) {
			referenceFields = (this.constructor as typeof BaseModel)[
				KEY_REFERENCE_FIELDS
			] = new Set();

			for (let name in fieldsSchema) {
				let fieldSchema = fieldsSchema[name];

				if (fieldSchema.type && fieldSchema.type().$schema.collectionName) {
					referenceFields.add(fieldSchema.dbFieldName || name);
				}
			}
		}

		if (m) {
			this.m = m;
		}

		this[KEY_DATA] = data || {};
		this[KEY_VALUES] = new Map();

		if (!fieldsSchema._id) {
			this._id = (data && data._id) || null;
		}

		currentlyValueSetting = true;

		try {
			for (let name in fieldsSchema) {
				let fieldSchema = fieldsSchema[name];
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
											? value.map((itemData: any) => new fieldType(itemData))
											: new fieldType(value);
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
							fieldSchema.default != null
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
								value instanceof BaseModel ? value : new fieldType(value)
							);

							continue;
						}

						if (value.length) {
							this[name] = this._validateFieldValue(
								name,
								fieldSchema,
								value[0] instanceof BaseModel
									? value.slice()
									: value.map((itemData: any) => new fieldType(itemData))
							);

							continue;
						}
					}
				} else if (value != null) {
					// при передаче в конструктор полей с внешними моделями поля идентификаторов
					// забирают эти значения себе,
					// отменяем это через `!(value[0] instanceof BaseModel)`

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
					fieldSchema.default != null
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

	async fetchField<T = BaseModel | Array<BaseModel>>(
		name: string,
		m?: Maraquia
	): Promise<T | null> {
		let schema = (this.constructor as typeof BaseModel).$schema.fields[name];

		if (!schema) {
			throw new TypeError(`Field "${name}" is not declared`);
		}

		if (!schema.type) {
			throw new TypeError(`Field "${name}" has no type`);
		}

		let fieldType = schema.type();
		let collectionName = fieldType.$schema.collectionName;

		if (!collectionName) {
			throw new TypeError('$schema.collectionName is required');
		}

		let value = this[KEY_VALUES].get(name) as
			| ObjectId
			| Array<ObjectId>
			| Promise<T | null>
			| null;

		if (value instanceof Promise) {
			return value;
		}

		if (!m) {
			m = this.m || (await getDefaultMaraquiaInstance());
		}

		let valuePromise: Promise<T | null> = Array.isArray(value)
			? m.db
					.collection(collectionName!)
					.find({ _id: { $in: value } })
					.toArray()
					.then(
						data =>
							(valuePromise[KEY_VALUE] = this._validateFieldValue(
								name,
								schema,
								data.map(itemData => new fieldType(itemData, m))
							))
					)
			: m.db
					.collection(collectionName!)
					.findOne({ _id: value })
					.then(
						data =>
							(valuePromise[KEY_VALUE] = this._validateFieldValue(
								name,
								schema,
								new fieldType(data, m) as any
							))
					);

		valuePromise[KEY_VALUE] = value;
		this[KEY_VALUES].set(name, valuePromise);

		return valuePromise;
	}

	setField(name: string, value: any, _key?: Symbol | string): this {
		if (_key && currentlyValueSetting) {
			this[_key as any] = value;
			return this;
		}

		if (!_key) {
			_key = name;
		}

		let schema = (this.constructor as typeof BaseModel).$schema.fields[name];

		if (!schema) {
			throw new TypeError(`Field "${name}" is not declared`);
		}

		if (schema.type) {
			let fieldType = schema.type();

			if (fieldType.$schema.collectionName) {
				if (value != null) {
					let isArray = Array.isArray(value);

					if (!isArray || value.length) {
						if ((isArray ? value[0] : value) instanceof ObjectId) {
							this[KEY_VALUES].set(name, value);
						} else {
							if (!((isArray ? value[0] : value) instanceof BaseModel)) {
								value = isArray
									? value.map((itemData: any) => new fieldType(itemData))
									: new fieldType(value);
							}

							this._validateFieldValue(name, schema, value);

							let valuePromise = Promise.resolve(value);
							valuePromise[KEY_VALUE] = value;
							this[KEY_VALUES].set(name, valuePromise);
						}

						return this;
					}
				}

				value =
					schema.default != null
						? typeof schema.default == 'function'
							? schema.default()
							: schema.default
						: this._validateFieldValue(name, schema, null);

				let valuePromise = Promise.resolve(value);
				valuePromise[KEY_VALUE] = value;
				this[KEY_VALUES].set(name, valuePromise);

				return this;
			}

			if (value != null) {
				if (!Array.isArray(value)) {
					this[_key as any] = this._validateFieldValue(
						name,
						schema,
						value instanceof BaseModel ? value : new fieldType(value)
					);

					return this;
				}

				if (value.length) {
					this[_key as any] = this._validateFieldValue(
						name,
						schema,
						value[0] instanceof BaseModel
							? value
							: value.map(itemData => new fieldType(itemData))
					);

					return this;
				}
			}
		} else if (value != null && (!Array.isArray(value) || value.length)) {
			this[_key as any] = this._validateFieldValue(name, schema, value);
			return this;
		}

		this[_key as any] =
			schema.default != null
				? typeof schema.default == 'function'
					? schema.default()
					: schema.default
				: this._validateFieldValue(name, schema, null);

		return this;
	}

	_validateFieldValue<T>(fieldName: string, fieldSchema: IFieldSchema, value: T): T {
		if (fieldSchema.validate) {
			// joi возвращает { validate: () => { error: ValidationError | null } }

			let result =
				typeof fieldSchema.validate == 'function'
					? fieldSchema.validate(value)
					: fieldSchema.validate.validate(value);

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

	async save(m?: Maraquia): Promise<boolean> {
		return (m || this.m || (await getDefaultMaraquiaInstance())).save(this);
	}

	async remove(m?: Maraquia): Promise<boolean> {
		return (m || this.m || (await getDefaultMaraquiaInstance())).remove(this);
	}

	beforeSave: (() => Promise<any> | void) | undefined;
	afterSave: (() => Promise<any> | void) | undefined;
	beforeRemove: (() => Promise<any> | void) | undefined;
	afterRemove: (() => Promise<any> | void) | undefined;

	toObject(): Object {
		let schema = (this.constructor as typeof BaseModel).$schema;
		let fieldsSchema = schema.fields;
		let obj: { [name: string]: any } = {};

		if (!fieldsSchema._id && (schema.collectionName || this._id)) {
			obj._id = this._id || null;
		}

		for (let name in fieldsSchema) {
			let value;

			if (fieldsSchema[name].type && fieldsSchema[name].type!().$schema.collectionName) {
				value = this[KEY_VALUES].get(name);

				if (value instanceof Promise) {
					value = value[KEY_VALUE];
				}
			} else {
				value = this[name];
			}

			if (value instanceof BaseModel) {
				obj[name] = value.toObject();
			} else if (Array.isArray(value)) {
				obj[name] =
					value.length && value[0] instanceof BaseModel
						? value.map((model: BaseModel) => model.toObject())
						: value;
			} else {
				obj[name] = value;
			}
		}

		return obj;
	}

	inspectData(): string {
		return prettyFormat(this.toObject());
	}

	printData() {
		console.log(this.inspectData());
	}
}
