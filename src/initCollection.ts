import { Db } from 'mongodb';
import { BaseModel, KEY_DB_COLLECTION_INITIALIZED } from './BaseModel';

export async function initCollection(type: typeof BaseModel, db: Db) {
	let typeSchema = type.$schema;
	let indexes = typeSchema.indexes;

	if (indexes) {
		for (let index of indexes) {
			await db
				.collection(typeSchema.collectionName!)
				.createIndex(
					Array.isArray(index.fields)
						? index.fields.reduce((fields, field) => ((fields[field] = 1), fields), {})
						: index.fields,
					index.options
				);
		}
	}

	type[KEY_DB_COLLECTION_INITIALIZED] = true;
}
