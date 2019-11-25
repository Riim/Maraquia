import {
	CollectionAggregationOptions,
	Db,
	DeleteWriteOpResultObject,
	FilterQuery,
	ObjectId
	} from 'mongodb';
import { isSingular } from 'pluralize';
import * as prettyFormat from 'pretty-format';
import { getDefaultDatabase } from './getDefaultDatabase';
import { initCollection } from './initCollection';
import { initDocument } from './initDocument';
import { isListsEqual } from './lib/isListsEqual';
import { isModelListsEqual } from './lib/isModelListsEqual';
import { setKeypath } from './lib/setKeypath';

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

export interface IQuery {
	$set?: { [keypath: string]: any };
	$unset?: { [keypath: string]: any };
}

export interface IFindOptions {
	sort?: Record<string, number>;
	skip?: number;
	limit?: number;
}

export const KEY_REFERENCE_FIELDS = Symbol('referenceFields');
export const KEY_DB_COLLECTION_INITIALIZED = Symbol('collectionInitialized');
export const KEY_DATA = Symbol('data');
export const KEY_VALUES = Symbol('values');
export const KEY_VALUE = Symbol('value');

let currentlyFieldsInitialization = false;
let currentlyFetchedDataApplying = false;

const savedModels = new Set<BaseModel>();

export class BaseModel {
	static $schema: ISchema;

	static [KEY_REFERENCE_FIELDS]: Set<string> | undefined;
	static [KEY_DB_COLLECTION_INITIALIZED]: true | undefined;

	static _db: Db | null = null;

	static get db(): Db | null {
		return this._db;
	}

	static use(db: Db): typeof BaseModel {
		this._db = db;
		return this;
	}

	static async getDatabase(): Promise<Db> {
		return this._db || (this._db = await getDefaultDatabase());
	}

	static async exists<T = any>(query: FilterQuery<T>): Promise<boolean> {
		let collectionName = this.$schema.collectionName;

		if (!collectionName) {
			throw new TypeError('$schema.collectionName is required');
		}

		let db = this._db || (this._db = await getDefaultDatabase());

		if (!this[KEY_DB_COLLECTION_INITIALIZED]) {
			await initCollection(this, db);
		}

		return !!(await db.collection(collectionName).findOne(query));
	}

	static async find<T extends BaseModel>(
		query?: FilterQuery<T> | null,
		resolvedFields?: Array<keyof T> | null,
		options?: IFindOptions
	): Promise<Array<T>> {
		let collectionName = this.$schema.collectionName;

		if (!collectionName) {
			throw new TypeError('$schema.collectionName is required');
		}

		let db = this._db || (this._db = await getDefaultDatabase());

		if (!this[KEY_DB_COLLECTION_INITIALIZED]) {
			await initCollection(this, db);
		}

		let pipeline: Array<Object> = [];

		if (query) {
			pipeline.push({ $match: query });
		}

		if (options) {
			if (options.sort) {
				pipeline.push({ $sort: options.sort });
			}
			if (options.skip) {
				pipeline.push({ $skip: options.skip });
			}
			if (options.limit) {
				pipeline.push({ $limit: options.limit });
			}
		}

		if (resolvedFields) {
			for (let fieldName of resolvedFields) {
				let fieldSchema = this.$schema.fields[fieldName as any];

				if (!fieldSchema) {
					throw new TypeError(`Field "${fieldName}" is not declared`);
				}

				let fieldType = fieldSchema.type;

				if (!fieldType) {
					throw new TypeError(`Field "${fieldName}" has not type`);
				}

				let fieldTypeCollectionName = fieldType().$schema.collectionName;

				if (!fieldTypeCollectionName) {
					throw new TypeError(
						`$schema.collectionName of type "${fieldType().name}" is required`
					);
				}

				pipeline.push({
					$lookup: {
						from: fieldTypeCollectionName,
						localField: fieldName,
						foreignField: '_id',
						as: fieldName
					}
				});
			}
		}

		let data = await db
			.collection(collectionName)
			.aggregate(pipeline)
			.toArray();

		currentlyFetchedDataApplying = true;
		let result = data.map(data => new this(data, db) as any);
		currentlyFetchedDataApplying = false;

		return result;
	}

	static async findOne<T extends BaseModel>(
		query?: FilterQuery<T> | null,
		resolvedFields?: Array<keyof T> | null
	): Promise<T | null> {
		return (await this.find(query, resolvedFields, { limit: 1 }))[0] || null;
	}

	static async aggregate<T extends BaseModel>(
		pipeline?: Array<Object>,
		options?: CollectionAggregationOptions
	): Promise<Array<T>> {
		let collectionName = this.$schema.collectionName;

		if (!collectionName) {
			throw new TypeError('$schema.collectionName is required');
		}

		let db = this._db || (this._db = await getDefaultDatabase());

		if (!this[KEY_DB_COLLECTION_INITIALIZED]) {
			await initCollection(this, db);
		}

		let data = await db
			.collection(collectionName)
			.aggregate(pipeline, options)
			.toArray();

		currentlyFetchedDataApplying = true;
		let result = data.map(data => new this(data, db) as any);
		currentlyFetchedDataApplying = false;

		return result;
	}

	static async remove<T = any>(query: FilterQuery<T>): Promise<DeleteWriteOpResultObject> {
		let collectionName = this.$schema.collectionName;

		if (!collectionName) {
			throw new TypeError('$schema.collectionName is required');
		}

		let db = this._db || (this._db = await getDefaultDatabase());

		if (!this[KEY_DB_COLLECTION_INITIALIZED]) {
			await initCollection(this, db);
		}

		return await db.collection(collectionName).deleteMany(query);
	}

	static async removeOne<T = any>(query: FilterQuery<T>): Promise<boolean> {
		let collectionName = this.$schema.collectionName;

		if (!collectionName) {
			throw new TypeError('$schema.collectionName is required');
		}

		let db = this._db || (this._db = await getDefaultDatabase());

		if (!this[KEY_DB_COLLECTION_INITIALIZED]) {
			await initCollection(this, db);
		}

		return (await db.collection(collectionName).deleteOne(query)).deletedCount == 1;
	}

	_db: Db | null = null;

	get db(): Db | null {
		return this._db;
	}

	use(db: Db): this {
		if (this._db) {
			throw new TypeError('Cannot change defined database');
		}

		this._db = db;
		return this;
	}

	[KEY_DATA]: Record<string, any>;
	[KEY_VALUES]: Map<string, ObjectId | Array<ObjectId> | Promise<any> | null>;

	_id: ObjectId | null;

	constructor(data?: Record<string, any> | null, db?: Db) {
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

		if (db) {
			this._db = db;
		}

		this[KEY_DATA] = (currentlyFetchedDataApplying && data) || {};
		this[KEY_VALUES] = new Map();

		if (!fieldSchemas._id) {
			this._id = (data && data._id) || null;
		}

		currentlyFieldsInitialization = true;

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
													(itemData: any) => new fieldType(itemData, db)
											  )
											: new fieldType(value, db);

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
								value instanceof BaseModel ? value : new fieldType(value, db)
							);

							continue;
						}

						if (value.length) {
							this[name] = this._validateFieldValue(
								name,
								fieldSchema,
								value[0] instanceof BaseModel
									? value.slice()
									: value.map((itemData: any) => new fieldType(itemData, db))
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
			currentlyFieldsInitialization = false;
		}
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

		let db =
			this._db ||
			(this._db = (this.constructor as typeof BaseModel)._db || (await getDefaultDatabase()));
		let valuePromise: Promise<T | null> = Array.isArray(value)
			? db
					.collection(collectionName!)
					.find({ _id: { $in: value } })
					.toArray()
					.then(
						data =>
							(valuePromise[KEY_VALUE] = this._validateFieldValue(
								name as any,
								schema,
								data.map(itemData => new type(itemData, db))
							))
					)
			: db
					.collection(collectionName!)
					.findOne({ _id: value })
					.then(
						data =>
							(valuePromise[KEY_VALUE] = this._validateFieldValue(
								name as any,
								schema,
								new type(data, db)
							)) as any
					);

		valuePromise[KEY_VALUE] = value;
		this[KEY_VALUES].set(name as any, valuePromise);

		return valuePromise;
	}

	setField(name: keyof this, value: any, _key?: Symbol | string): this {
		if (_key && currentlyFieldsInitialization) {
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

	async save(): Promise<IQuery> {
		let type = this.constructor as typeof BaseModel;

		if (!type.$schema.collectionName) {
			throw new TypeError('$schema.collectionName is required');
		}

		let db =
			this._db ||
			(this._db = (this.constructor as typeof BaseModel)._db || (await getDefaultDatabase()));

		if (!type[KEY_DB_COLLECTION_INITIALIZED]) {
			await initCollection(type, db);
		}

		let query: IQuery;

		try {
			query = await this._save(db);
		} catch (err) {
			throw err;
		} finally {
			// https://github.com/Riim/Maraquia/pull/1#issuecomment-491389356
			savedModels.clear();
		}

		return query;
	}

	async _save(db: Db): Promise<IQuery> {
		savedModels.add(this);

		if (this.beforeSave) {
			let r = this.beforeSave();

			if (r instanceof Promise) {
				await r;
			}
		}

		let modelSchema = (this.constructor as typeof BaseModel).$schema;

		if (!this._id) {
			await initDocument(this, db, modelSchema.collectionName!);
		}

		let query = await this._buildUpdateQuery(
			modelSchema,
			this._id !== this[KEY_DATA]._id,
			'',
			{ __proto__: null } as any,
			db
		);

		// console.log('_id:', this._id);
		// console.log('query:', query);

		await db.collection(modelSchema.collectionName!).updateOne({ _id: this._id }, query);

		let $set = query.$set;
		let $unset = query.$unset;

		if ($set) {
			for (let keypath in $set) {
				setKeypath(this, keypath, $set[keypath]);
			}
		}

		if ($unset) {
			for (let keypath in $unset) {
				setKeypath(this, keypath, null);
			}
		}

		if (this.afterSave) {
			let r = this.afterSave();

			if (r instanceof Promise) {
				await r;
			}
		}

		return query;
	}

	async _buildUpdateQuery(
		modelSchema: ISchema,
		isNew: boolean,
		keypath: string,
		query: IQuery,
		db: Db
	): Promise<IQuery> {
		let fieldSchemas = modelSchema.fields;

		for (let name in fieldSchemas) {
			if (!hasOwn.call(fieldSchemas, name)) {
				continue;
			}

			let fieldSchema = fieldSchemas[name];
			let fieldKeypath = (keypath ? keypath + '.' : '') + (fieldSchema.dbFieldName || name);
			let fieldValue;

			if (fieldSchema.type) {
				let fieldTypeSchema = fieldSchema.type().$schema;

				if (fieldTypeSchema.collectionName) {
					fieldValue = this[KEY_VALUES].get(name);

					if (fieldValue instanceof Promise) {
						fieldValue = fieldValue[KEY_VALUE];
					}
				} else {
					fieldValue = this[name];
				}

				if (fieldValue) {
					if (fieldTypeSchema.collectionName) {
						if (Array.isArray(fieldValue)) {
							let modelListLength = fieldValue.length;

							if (modelListLength) {
								if (fieldValue[0] instanceof BaseModel) {
									for (let i = 0; i < modelListLength; i++) {
										if (!savedModels.has(fieldValue[i])) {
											await (fieldValue[i] as BaseModel)._save(db);
										}
									}

									if (
										isNew ||
										!isModelListsEqual(
											fieldValue,
											this[KEY_DATA][fieldSchema.dbFieldName || name]
										)
									) {
										(query.$set || (query.$set = { __proto__: null }))[
											fieldKeypath
										] = fieldValue.map(model => model._id);
									}
								}
							} else if (
								!isNew &&
								(this[KEY_DATA][fieldSchema.dbFieldName || name] || []).length
							) {
								(query.$unset || (query.$unset = { __proto__: null }))[
									fieldKeypath
								] = true;
							}
						} else if (fieldValue instanceof BaseModel) {
							if (!savedModels.has(fieldValue)) {
								await fieldValue._save(db);
							}

							if (
								isNew ||
								fieldValue._id !== this[KEY_DATA][fieldSchema.dbFieldName || name]
							) {
								(query.$set || (query.$set = { __proto__: null }))[fieldKeypath] =
									fieldValue._id;
							}
						}
					} else if (Array.isArray(fieldValue)) {
						let modelListLength = fieldValue.length;

						if (modelListLength) {
							let equal =
								!isNew &&
								isListsEqual(
									fieldValue,
									this[KEY_DATA][fieldSchema.dbFieldName || name]
								);
							let query_ = equal ? query : ({ __proto__: null } as any);

							for (let i = 0; i < modelListLength; i++) {
								await (fieldValue[i] as BaseModel)._buildUpdateQuery(
									fieldTypeSchema,
									isNew,
									fieldKeypath + '.' + i,
									query_,
									db
								);
							}

							if (!equal && (query_.$set || query_.$unset)) {
								(query.$set || (query.$set = { __proto__: null }))[
									fieldKeypath
								] = fieldValue.map((model: BaseModel) => model.toData());
							}
						} else if (
							!isNew &&
							(this[KEY_DATA][fieldSchema.dbFieldName || name] || []).length
						) {
							(query.$unset || (query.$unset = { __proto__: null }))[
								fieldKeypath
							] = true;
						}
					} else {
						await (fieldValue as BaseModel)._buildUpdateQuery(
							fieldTypeSchema,
							isNew /* || fieldValue !== this[KEY_DATA][fieldSchema.dbFieldName || name] */,
							fieldKeypath,
							query,
							db
						);
					}
				} else if (!isNew && this[KEY_DATA][fieldSchema.dbFieldName || name]) {
					(query.$unset || (query.$unset = { __proto__: null }))[fieldKeypath] = true;
				}
			} else {
				fieldValue = this[name];

				if (
					(name != '_id' || !modelSchema.collectionName) &&
					(isNew ||
						(Array.isArray(fieldValue)
							? !isListsEqual(
									fieldValue,
									this[KEY_DATA][fieldSchema.dbFieldName || name]
							  )
							: fieldValue === null
							? fieldValue != this[KEY_DATA][fieldSchema.dbFieldName || name]
							: fieldValue !== this[KEY_DATA][fieldSchema.dbFieldName || name]))
				) {
					if (fieldValue == null || (Array.isArray(fieldValue) && !fieldValue.length)) {
						if (!isNew) {
							(query.$unset || (query.$unset = { __proto__: null }))[
								fieldKeypath
							] = true;
						}
					} else {
						(query.$set || (query.$set = { __proto__: null }))[
							fieldKeypath
						] = fieldValue;
					}
				}
			}
		}

		return query;
	}

	async remove(): Promise<boolean> {
		let collectionName = (this.constructor as typeof BaseModel).$schema.collectionName;

		if (!collectionName) {
			throw new TypeError('$schema.collectionName is required');
		}

		if (!this._id) {
			throw new TypeError('Field "_id" is required');
		}

		if (this.beforeRemove) {
			let r = this.beforeRemove();

			if (r instanceof Promise) {
				await r;
			}
		}

		let db =
			this._db ||
			(this._db = (this.constructor as typeof BaseModel)._db || (await getDefaultDatabase()));

		let result =
			(await db!.collection(collectionName).deleteOne({ _id: this._id })).deletedCount == 1;

		if (this.afterRemove) {
			let r = this.afterRemove();

			if (r instanceof Promise) {
				await r;
			}
		}

		return result;
	}

	beforeSave(): Promise<any> | void {}
	afterSave(): Promise<any> | void {}
	beforeRemove(): Promise<any> | void {}
	afterRemove(): Promise<any> | void {}

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
