export function isListsEqual(a: Array<any>, b: Array<any> | null | undefined): boolean {
	let aLength = a.length;

	if (!b) {
		return !aLength;
	}

	if (aLength != b.length) {
		return false;
	}

	for (let i = aLength; i; ) {
		if (a[--i] !== b[i]) {
			return false;
		}
	}

	return true;
}
