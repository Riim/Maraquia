import { BaseModel, IIndex } from '../BaseModel';
import { initTypeSchema } from '../initTypeSchema';

export function Model(options?: {
	collectionName?: string | null;
	indexes?: Array<IIndex> | null;
}) {
	return (type: typeof BaseModel) => {
		let schema = initTypeSchema(type);

		if (options) {
			if (options.collectionName !== undefined) {
				schema.collectionName = options.collectionName;
			}

			if (options.indexes !== undefined) {
				schema.indexes = options.indexes;
			}
		}
	};
}
