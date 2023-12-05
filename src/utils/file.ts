export function base64ToUint8Array(base64Image: string): Uint8Array {
	const binaryString = atob(base64Image);
	const length = binaryString.length;
	const uintArray = new Uint8Array(length);

	for (let i = 0; i < length; i++) {
		uintArray[i] = binaryString.charCodeAt(i);
	}

	return uintArray;
}
