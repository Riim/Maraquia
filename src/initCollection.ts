import { Db } from 'mongodb';
import { BaseModel, KEY_DB_COLLECTION_INITIALIZED } from './BaseModel';

export async function initCollection(modelCtor: typeof BaseModel, db: Db) {
	let modelSchema = modelCtor.$schema;
	let indexes = modelSchema.indexes;

	if (indexes) {
		for (let index of indexes) {
			await db
				.collection(modelSchema.collectionName!)
				.createIndex(
					Array.isArray(index.fields)
						? index.fields.reduce((fields, field) => ((fields[field] = 1), fields), {})
						: index.fields,
					index.options
				);
		}
	}

	modelCtor[KEY_DB_COLLECTION_INITIALIZED] = true;
}
