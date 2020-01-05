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
		let result = data.map(data => new this(data, db) as T);
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

	_db: Db | null;

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

	_pushData: boolean;

	[KEY_DATA]: Record<string, any>;
	[KEY_VALUES]: Map<string, ObjectId | Array<ObjectId> | Promise<any> | null>;

	_id: ObjectId | null;

	constructor(data: Record<string, any> = {}, db?: Db | null) {
		let fieldSchemas = (this.constructor as typeof BaseModel).$schema.fields;
		let referenceFields: Set<string>;

		if ((this.constructor as typeof BaseModel).hasOwnProperty(KEY_REFERENCE_FIELDS)) {
			referenceFields = (this.constructor as typeof BaseModel)[KEY_REFERENCE_FIELDS]!;
		} else {
			referenceFields = (this.constructor as typeof BaseModel)[
				KEY_REFERENCE_FIELDS
			] = new Set();

			for (let name in fieldSchemas) {
				if (fieldSchemas[name] !== Object.prototype[name]) {
					let fieldSchema = fieldSchemas[name];

					if (fieldSchema.type && fieldSchema.type().$schema.collectionName) {
						referenceFields.add(fieldSchema.dbFieldName || name);
					}
				}
			}
		}

		this._db = db || (this.constructor as typeof BaseModel)._db;

		this._pushData = currentlyFetchedDataApplying;

		this[KEY_DATA] = data;
		this[KEY_VALUES] = new Map();

		if (!fieldSchemas._id) {
			this._id = data._id ? new ObjectId(data._id) : null;
		}

		currentlyFieldsInitialization = true;

		try {
			for (let name in fieldSchemas) {
				let fieldSchema = fieldSchemas[name];

				if (fieldSchema === Object.prototype[name]) {
					continue;
				}

				let value_ = data[name];

				if (value_ === undefined && fieldSchema.dbFieldName) {
					value_ = data[fieldSchema.dbFieldName];
				}

				let value = value_ === undefined ? null : value_;

				if (fieldSchema.type) {
					let fieldType = fieldSchema.type();

					if (fieldType.$schema.collectionName) {
						if (value !== null) {
							let isArray = Array.isArray(value);

							if (!isArray || value.length) {
								if ((isArray ? value[0] : value) instanceof ObjectId) {
									this[KEY_VALUES].set(name, isArray ? value.slice() : value);
								} else {
									if (
										isArray &&
										value.length == 1 &&
										!(value[0] instanceof BaseModel) &&
										isSingular(name)
									) {
										value = value[0];
										isArray = false;
									}

									if (!((isArray ? value[0] : value) instanceof BaseModel)) {
										value = isArray
											? value.map(
													(itemData: Object) =>
														new fieldType(itemData, db)
											  )
											: new fieldType(value, db);
										data[name] = value;
									}

									this._validateFieldValue(name, fieldSchema, value);

									let valuePromise = Promise.resolve(value);
									valuePromise[KEY_VALUE] = isArray ? value.slice() : value;
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

						if (value !== null || value_ !== null) {
							data[name] =
								value_ === undefined
									? undefined
									: Array.isArray(value)
									? value.slice()
									: value;
						}

						let valuePromise = Promise.resolve(value);
						valuePromise[KEY_VALUE] = value;
						this[KEY_VALUES].set(name, valuePromise);

						continue;
					}

					if (value !== null) {
						if (!Array.isArray(value)) {
							value = this._validateFieldValue(
								name,
								fieldSchema,
								value instanceof BaseModel ? value : new fieldType(value, db)
							);

							data[name] = value;
							this[name] = value;

							continue;
						}

						if (value.length) {
							value = this._validateFieldValue(
								name,
								fieldSchema,
								value[0] instanceof BaseModel
									? value
									: value.map((itemData: any) => new fieldType(itemData, db))
							);

							data[name] = value.slice();
							this[name] = value;

							continue;
						}
					}
				} else if (value !== null) {
					// Поле идентификатора получит значение поля с внешней моделью
					// если не отменять это проверкой: `!(value[0] instanceof BaseModel)`.

					let isArray = Array.isArray(value);

					if (!isArray || value.length) {
						if (
							fieldSchema.dbFieldName &&
							referenceFields.has(fieldSchema.dbFieldName)
						) {
							if (isArray && value.length == 1 && isSingular(name)) {
								let value0 = value[0];

								if (
									typeof value0 !== 'string' &&
									!(value0 instanceof ObjectId) &&
									!(value0 instanceof BaseModel)
								) {
									value = value0;
									isArray = false;
								}
							}

							if (isArray) {
								if (!(value[0] instanceof ObjectId)) {
									value = value.map(
										typeof value[0] == 'string'
											? (value: string) => new ObjectId(value)
											: (value: BaseModel | { _id?: ObjectId }) =>
													value._id ? new ObjectId(value._id) : null
									);

									data[name] = value;
								}
							} else if (!(value instanceof ObjectId)) {
								value =
									typeof value == 'string'
										? new ObjectId(value)
										: value._id
										? new ObjectId(value._id)
										: null;

								data[name] = value;
							}
						}

						this[name] = this._validateFieldValue(
							name,
							fieldSchema,
							isArray ? value.slice() : value
						);

						continue;
					}
				}

				value =
					fieldSchema.default !== undefined
						? typeof fieldSchema.default == 'function'
							? fieldSchema.default()
							: fieldSchema.default
						: this._validateFieldValue(name, fieldSchema, null);

				if (value !== null || value_ !== null) {
					data[name] =
						value_ === undefined
							? undefined
							: Array.isArray(value)
							? value.slice()
							: value;
				}

				this[name] = value;
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

		if (value === undefined) {
			this[KEY_DATA][name as string] = undefined;
		} else if (this[KEY_DATA][name as string] === undefined) {
			this[KEY_DATA][name as string] = null;
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
									? value.map((itemData: Object) => new type(itemData, this._db))
									: new type(value, this._db);
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
						value instanceof BaseModel ? value : new type(value, this._db)
					);

					return this;
				}

				if (value.length) {
					this[_key as any] = this._validateFieldValue(
						name as any,
						schema,
						value[0] instanceof BaseModel
							? value
							: value.map(itemData => new type(itemData, this._db))
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

	async save(_noSave?: boolean): Promise<IQuery> {
		let modelCtor = this.constructor as typeof BaseModel;

		if (!modelCtor.$schema.collectionName) {
			throw new TypeError('$schema.collectionName is required');
		}

		let db =
			this._db ||
			(this._db = (this.constructor as typeof BaseModel)._db || (await getDefaultDatabase()));

		if (!_noSave && !modelCtor[KEY_DB_COLLECTION_INITIALIZED]) {
			await initCollection(modelCtor, db);
		}

		let query: IQuery;

		try {
			query = await this._save(db, _noSave || false);
		} catch (err) {
			throw err;
		} finally {
			// https://github.com/Riim/Maraquia/pull/1#issuecomment-491389356
			savedModels.clear();
		}

		return query;
	}

	async _save(db: Db, noSave: boolean): Promise<IQuery> {
		savedModels.add(this);

		if (this.beforeSave) {
			let r = this.beforeSave();

			if (r instanceof Promise) {
				await r;
			}
		}

		let modelSchema = (this.constructor as typeof BaseModel).$schema;

		if (!noSave && !this._id) {
			await initDocument(this, db, modelSchema.collectionName!);
		}

		let query = await this._save$(
			modelSchema,
			!this._id,
			!!this._id && !this._pushData,
			'',
			{ __proto__: null } as any,
			db,
			noSave
		);

		// console.log('_id:', this._id);
		// console.log('query:', query);

		if (!noSave) {
			await db.collection(modelSchema.collectionName!).updateOne({ _id: this._id }, query);
		}

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

	async _save$(
		modelSchema: ISchema,
		isNew: boolean,
		updateData: boolean,
		keypath: string,
		query: IQuery,
		db: Db,
		noSave: boolean
	): Promise<IQuery> {
		let fieldSchemas = modelSchema.fields;

		for (let name in fieldSchemas) {
			let fieldSchema = fieldSchemas[name];

			if (fieldSchema === Object.prototype[name]) {
				continue;
			}

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
										if (!noSave && !savedModels.has(fieldValue[i])) {
											await (fieldValue[i] as BaseModel)._save(db, false);
										}
									}

									if (
										isNew ||
										updateData ||
										!isModelListsEqual(fieldValue, this[KEY_DATA][name])
									) {
										(query.$set || (query.$set = { __proto__: null }))[
											fieldKeypath
										] = fieldValue.map(model => model._id);
									}
								}
							} else if (
								!isNew &&
								(updateData || (this[KEY_DATA][name] || []).length)
							) {
								(query.$unset || (query.$unset = { __proto__: null }))[
									fieldKeypath
								] = true;
							}
						} else if (fieldValue instanceof BaseModel) {
							if (!noSave && !savedModels.has(fieldValue)) {
								await fieldValue._save(db, false);
							}

							if (isNew || updateData || fieldValue !== this[KEY_DATA][name]) {
								(query.$set || (query.$set = { __proto__: null }))[fieldKeypath] =
									fieldValue._id;
							}
						}
					} else if (Array.isArray(fieldValue)) {
						let modelListLength = fieldValue.length;

						if (modelListLength) {
							if (
								isNew ||
								updateData ||
								!isListsEqual(fieldValue, this[KEY_DATA][name])
							) {
								(query.$set || (query.$set = { __proto__: null }))[
									fieldKeypath
								] = fieldValue.map((model: BaseModel) => model.toData(null, true));
							} else {
								for (let i = 0; i < modelListLength; i++) {
									await (fieldValue[i] as BaseModel)._save$(
										fieldTypeSchema,
										false,
										false,
										fieldKeypath + '.' + i,
										query,
										db,
										noSave
									);
								}
							}
						} else if (!isNew && (updateData || (this[KEY_DATA][name] || []).length)) {
							(query.$unset || (query.$unset = { __proto__: null }))[
								fieldKeypath
							] = true;
						}
					} else if (isNew || fieldValue[KEY_DATA] !== this[KEY_DATA][name]) {
						(query.$set || (query.$set = { __proto__: null }))[
							fieldKeypath
						] = (fieldValue as BaseModel).toData(null, true);
					} else {
						await (fieldValue as BaseModel)._save$(
							fieldTypeSchema,
							false,
							updateData,
							fieldKeypath,
							query,
							db,
							noSave
						);
					}
				} else if (!isNew && !(updateData && this[KEY_DATA][name] === undefined)) {
					(query.$unset || (query.$unset = { __proto__: null }))[fieldKeypath] = true;
				}
			} else {
				fieldValue = this[name];

				if (
					(name != '_id' || !modelSchema.collectionName) &&
					(isNew ||
						updateData ||
						(Array.isArray(fieldValue)
							? !isListsEqual(fieldValue, this[KEY_DATA][name])
							: fieldValue === null
							? fieldValue != this[KEY_DATA][fieldSchema.dbFieldName || name]
							: fieldValue !== this[KEY_DATA][fieldSchema.dbFieldName || name]))
				) {
					if (fieldValue === null || (Array.isArray(fieldValue) && !fieldValue.length)) {
						if (!isNew && !(updateData && this[KEY_DATA][name] === undefined)) {
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

	query() {
		return this.save(true);
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

	toData(fields?: Record<string, any> | null, skipNull?: boolean, methodName = 'toData'): Object {
		let schema = (this.constructor as typeof BaseModel).$schema;
		let fieldSchemas = schema.fields;
		let data: Record<string, any> = {};

		if (
			!fieldSchemas._id &&
			schema.collectionName &&
			(!fields || fields._id) &&
			(!skipNull || this._id)
		) {
			data._id = this._id || null;
		}

		for (let name in fieldSchemas) {
			if (fieldSchemas[name] === Object.prototype[name] || (fields && !fields[name])) {
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
						data[name] = value[methodName]();
						break;
					}
					case 1: {
						data[name] = value[methodName](
							fields && typeof fields[name] == 'object' ? fields[name] : undefined
						);

						break;
					}
					case 2: {
						data[name] = value[methodName](
							fields && typeof fields[name] == 'object' ? fields[name] : undefined,
							skipNull
						);

						break;
					}
				}
			} else if (Array.isArray(value)) {
				data[name] =
					value.length && value[0] instanceof BaseModel
						? value.map((model: BaseModel) => {
								switch (model[methodName].length) {
									case 0: {
										return model[methodName]();
									}
									case 1: {
										return model[methodName](
											fields && typeof fields[name] == 'object'
												? fields[name]
												: undefined
										);
									}
									case 2: {
										return model[methodName](
											fields && typeof fields[name] == 'object'
												? fields[name]
												: undefined,
											skipNull
										);
									}
								}
						  })
						: value;
			} else if (!skipNull || value !== null) {
				data[name] = value;
			}
		}

		return data;
	}

	inspectData(): string {
		return prettyFormat(this.toData());
	}

	printData() {
		console.log(this.inspectData());
	}
}
