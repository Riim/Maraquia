import { ObjectId } from 'mongodb';
import { BaseModel } from '../BaseModel';

export function isModelListsEqual(
	a: Array<BaseModel>,
	b: Array<BaseModel | ObjectId> | null | undefined
): boolean {
	if (!b) {
		return false;
	}

	let aLength = a.length;

	if (aLength != b.length) {
		return false;
	}

	for (let i = aLength; i; ) {
		if (a[--i]._id !== b[i]) {
			return false;
		}
	}

	return true;
}
