import { BaseModel, IIndex } from '../BaseModel';
import { initModelClassSchema } from '../initModelClassSchema';

export function Model(options?: {
	collectionName?: string | null;
	indexes?: Array<IIndex> | null;
}) {
	return (modelConstr: typeof BaseModel) => {
		let schema = initModelClassSchema(modelConstr);

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
