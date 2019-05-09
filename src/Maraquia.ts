import {
	CollectionAggregationOptions,
	Db,
	FilterQuery,
	ObjectId
	} from 'mongodb';
import {
	BaseModel,
	ISchema,
	KEY_DATA,
	KEY_DB_COLLECTION_INITIALIZED,
	KEY_VALUE,
	KEY_VALUES
	} from './BaseModel';
import { initCollection } from './initCollection';
import { initDocument } from './initDocument';
import { setKeypath } from './lib/setKeypath';

export interface IQuery {
	$set?: { [keypath: string]: any };
	$unset?: { [keypath: string]: any };
}

export interface IFindOptions<T> {
	sort?: Record<string, number>;
	skip?: number;
	limit?: number;
	resolvedFields?: Array<keyof T>;
	aggregationPipeline?: Array<Object>;
	aggregationOptions?: CollectionAggregationOptions;
}

const currentlySavedModels = new Set<BaseModel>();

export class Maraquia {
	constructor(public db: Db) {}

	async exists<T = any>(type: typeof BaseModel, query: FilterQuery<T>): Promise<boolean> {
		let collectionName = type.$schema.collectionName;

		if (!collectionName) {
			throw new TypeError('$schema.collectionName is required');
		}

		if (!type[KEY_DB_COLLECTION_INITIALIZED]) {
			await initCollection(type, this);
		}

		return !!(await this.db.collection(collectionName).findOne(query));
	}

	async find<T extends BaseModel>(
		type: typeof BaseModel,
		query: FilterQuery<T>,
		limit?: number,
		resolvedFields?: Array<keyof T>
	): Promise<Array<T>>;
	async find<T extends BaseModel>(
		type: typeof BaseModel,
		query: FilterQuery<T>,
		options?: IFindOptions<T>
	): Promise<Array<T>>;
	async find<T extends BaseModel>(
		type: typeof BaseModel,
		query: FilterQuery<T>,
		limitOrOptions?: number | IFindOptions<T>,
		resolvedFields?: Array<keyof T>
	): Promise<Array<T>> {
		let collectionName = type.$schema.collectionName;

		if (!collectionName) {
			throw new TypeError('$schema.collectionName is required');
		}

		if (!type[KEY_DB_COLLECTION_INITIALIZED]) {
			await initCollection(type, this);
		}

		let limit: number;
		let aggregationPipeline: Array<Object> | undefined;
		let aggregationOptions: CollectionAggregationOptions | undefined;
		let pipeline: Array<Object> = [{ $match: query }];

		if (typeof limitOrOptions == 'number') {
			limit = limitOrOptions !== undefined ? limitOrOptions : -1;
		} else if (limitOrOptions) {
			limit = typeof limitOrOptions.limit == 'number' ? limitOrOptions.limit : -1;
			resolvedFields = limitOrOptions.resolvedFields;
			aggregationPipeline = limitOrOptions.aggregationPipeline;
			aggregationOptions = limitOrOptions.aggregationOptions;

			if (limitOrOptions.sort) {
				pipeline.push({ $sort: limitOrOptions.sort });
			}
			if (limitOrOptions.skip) {
				pipeline.push({ $skip: limitOrOptions.skip });
			}
		} else {
			limit = -1;
		}

		if (limit >= 0) {
			pipeline.push({ $limit: limit });
		}

		if (aggregationPipeline) {
			pipeline.push(...aggregationPipeline);
		}

		if (resolvedFields) {
			for (let fieldName of resolvedFields) {
				let fieldSchema = (type as typeof BaseModel).$schema.fields[fieldName as any];

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

		return (await this.db
			.collection(collectionName)
			.aggregate(pipeline, aggregationOptions)
			.toArray()).map(data => new type(data, this) as any);
	}

	async findOne<T extends BaseModel>(
		type: typeof BaseModel,
		query: FilterQuery<T>,
		resolvedFields?: Array<keyof T>
	): Promise<T | null> {
		return (await this.find(type, query, 1, resolvedFields))[0];
	}

	async findAll<T extends BaseModel>(
		type: typeof BaseModel,
		query: FilterQuery<T>,
		resolvedFields?: Array<keyof T>
	): Promise<Array<T>> {
		return await this.find(type, query, -1, resolvedFields);
	}

	async save(model: BaseModel): Promise<boolean> {
		if (currentlySavedModels.size) {
			throw new Error('Cannot save when saving');
		}

		let type = model.constructor as typeof BaseModel;

		if (!type.$schema.collectionName) {
			throw new TypeError('$schema.collectionName is required');
		}

		if (!type[KEY_DB_COLLECTION_INITIALIZED]) {
			await initCollection(type, this);
		}

		try {
			await this._save(model);
		} catch (err) {
			throw err;
		} finally {
			currentlySavedModels.clear();
		}

		return true;
	}

	async _save(model: BaseModel): Promise<boolean> {
		currentlySavedModels.add(model);

		if (model.m) {
			if (model.m !== this) {
				throw new TypeError('Cannot replace Maraquia instance on model');
			}
		} else {
			model.m = this;
		}

		let schema = (model.constructor as typeof BaseModel).$schema;

		if (!model._id) {
			await initDocument(this, model, schema.collectionName!);
		}

		let query = await this._save$(model, schema, model._id !== model[KEY_DATA]._id, '', {});

		if (model.beforeSave) {
			let r = model.beforeSave();

			if (r instanceof Promise) {
				await r;
			}
		}

		// console.log('model._id:', model._id);
		// console.log('query:', query);

		await this.db.collection(schema.collectionName!).updateOne({ _id: model._id }, query);

		updateData(model, query);

		if (model.afterSave) {
			let r = model.afterSave();

			if (r instanceof Promise) {
				await r;
			}
		}

		return true;
	}

	async _save$(
		model: BaseModel,
		typeSchema: ISchema,
		isNew: boolean,
		keypath: string,
		query: IQuery
	): Promise<Object> {
		let fieldsSchema = typeSchema.fields;
		let values = model[KEY_VALUES];

		for (let name in fieldsSchema) {
			let fieldSchema = fieldsSchema[name];
			let fieldKeypath = (keypath ? keypath + '.' : '') + (fieldSchema.dbFieldName || name);
			let fieldValue;

			if (fieldSchema.type) {
				let fieldTypeSchema = fieldSchema.type().$schema;

				if (fieldTypeSchema.collectionName) {
					fieldValue = values.get(name);

					if (fieldValue instanceof Promise) {
						fieldValue = fieldValue[KEY_VALUE];
					}
				} else {
					fieldValue = model[name];
				}

				if (fieldValue) {
					if (fieldTypeSchema.collectionName) {
						if (Array.isArray(fieldValue)) {
							let modelListLength = fieldValue.length;

							if (modelListLength) {
								if (fieldValue[0] instanceof BaseModel) {
									for (let i = 0; i < modelListLength; i++) {
										if (!currentlySavedModels.has(fieldValue[i])) {
											await this._save(fieldValue[i]);
										}
									}

									if (
										isNew ||
										!isModelListEqual(
											fieldValue,
											model[KEY_DATA][fieldSchema.dbFieldName || name],
											true
										)
									) {
										(query.$set || (query.$set = {}))[
											fieldKeypath
										] = fieldValue.map(model => model._id);
									}
								}
							} else if (
								!isNew &&
								(model[KEY_DATA][fieldSchema.dbFieldName || name] || []).length
							) {
								(query.$unset || (query.$unset = {}))[fieldKeypath] = true;
							}
						} else if (fieldValue instanceof BaseModel) {
							if (!currentlySavedModels.has(fieldValue)) {
								await this._save(fieldValue);
							}

							if (
								fieldValue._id !== model[KEY_DATA][fieldSchema.dbFieldName || name]
							) {
								(query.$set || (query.$set = {}))[fieldKeypath] = fieldValue._id;
							}
						}
					} else if (Array.isArray(fieldValue)) {
						let modelListLength = fieldValue.length;

						if (modelListLength) {
							let equal = isModelListEqual(
								fieldValue,
								model[KEY_DATA][fieldSchema.dbFieldName || name],
								false
							);
							let q = equal && !isNew ? query : {};

							for (let i = 0; i < modelListLength; i++) {
								await this._save$(
									fieldValue[i],
									fieldTypeSchema,
									isNew,
									fieldKeypath + '.' + i,
									q
								);
							}

							if (!equal || isNew) {
								for (let _ in q) {
									(query.$set || (query.$set = {}))[
										fieldKeypath
									] = fieldValue.map((model: BaseModel) => model.toObject());

									break;
								}
							}
						} else if (
							!isNew &&
							(model[KEY_DATA][fieldSchema.dbFieldName || name] || []).length
						) {
							(query.$unset || (query.$unset = {}))[fieldKeypath] = true;
						}
					} else {
						await this._save$(
							fieldValue,
							fieldTypeSchema,
							isNew ||
								fieldValue !== model[KEY_DATA][fieldSchema.dbFieldName || name],
							fieldKeypath,
							query
						);
					}
				} else if (!isNew && model[KEY_DATA][fieldSchema.dbFieldName || name]) {
					(query.$unset || (query.$unset = {}))[fieldKeypath] = true;
				}
			} else {
				fieldValue = model[name];

				if (
					(name != '_id' || !typeSchema.collectionName) &&
					(isNew ||
						(Array.isArray(fieldValue)
							? !isModelListEqual(
									fieldValue,
									model[KEY_DATA][fieldSchema.dbFieldName || name],
									false
							  )
							: fieldValue !== model[KEY_DATA][fieldSchema.dbFieldName || name]))
				) {
					if (fieldValue == null || (Array.isArray(fieldValue) && !fieldValue.length)) {
						if (!isNew) {
							(query.$unset || (query.$unset = {}))[fieldKeypath] = true;
						}
					} else {
						(query.$set || (query.$set = {}))[fieldKeypath] = fieldValue;
					}
				}
			}
		}

		return query;
	}

	async remove(model: BaseModel): Promise<boolean> {
		let collectionName = (model.constructor as typeof BaseModel).$schema.collectionName;

		if (!collectionName) {
			throw new TypeError('$schema.collectionName is required');
		}

		if (!model._id) {
			throw new TypeError('model._id is required');
		}

		if (model.m) {
			if (model.m !== this) {
				throw new TypeError('Cannot replace Maraquia instance on model');
			}
		} else {
			model.m = this;
		}

		if (model.beforeRemove) {
			let r = model.beforeRemove();

			if (r instanceof Promise) {
				await r;
			}
		}

		let result =
			((await this.db.collection(collectionName).deleteOne({ _id: model._id })) as any)
				.deletedCount == 1;

		if (model.afterRemove) {
			let r = model.afterRemove();

			if (r instanceof Promise) {
				await r;
			}
		}

		return result;
	}
}

function isModelListEqual(
	a: Array<BaseModel>,
	b: Array<BaseModel | ObjectId> | null | undefined,
	useId: boolean
): boolean {
	if (!b) {
		return false;
	}

	let aLength = a.length;

	if (useId && aLength && !(a[0] instanceof BaseModel)) {
		return true;
	}

	if (aLength != b.length) {
		return false;
	}

	if (useId) {
		for (let i = aLength; i; ) {
			if (a[--i]._id !== b[i]) {
				return false;
			}
		}
	} else {
		for (let i = aLength; i; ) {
			if (a[--i] != b[i]) {
				return false;
			}
		}
	}

	return true;
}

function updateData(model: BaseModel, query: IQuery) {
	let $set = query.$set;

	if ($set) {
		for (let keypath in $set) {
			setKeypath(model, keypath, $set[keypath]);
		}
	}

	let $unset = query.$unset;

	if ($unset) {
		for (let keypath in $unset) {
			setKeypath(model, keypath, null);
		}
	}
}
