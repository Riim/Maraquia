import { BaseModel, KEY_DB_COLLECTION_INITIALIZED } from './BaseModel';
import { Maraquia } from './Maraquia';

export async function initCollection(type: typeof BaseModel, m: Maraquia) {
	let schema = type.$schema;
	let indexes = schema.indexes;

	if (indexes) {
		for (let index of indexes) {
			await m.db
				.collection(schema.collectionName!)
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
