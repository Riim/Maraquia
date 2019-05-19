export function setKeypath(obj: Object, keypath: string, value: any) {
	let index = keypath.indexOf('.');

	if (index == -1) {
		obj[keypath] = value;
	} else {
		obj = obj[keypath.slice(0, index)] || {};

		for (let index2: number; (index2 = keypath.indexOf('.', index + 1)) != -1; ) {
			obj = obj[keypath.slice(index + 1, index2)] || {};
			index = index2;
		}

		obj[keypath.slice(index + 1)] = value;
	}
}
