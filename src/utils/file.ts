import axios from "axios";
import { ReadStream } from "fs";
import { FileLike } from "openai/uploads";
export function base64ToUint8Array(base64Image: string): Uint8Array {
	const binaryString = atob(base64Image);
	const length = binaryString.length;
	const uintArray = new Uint8Array(length);

	for (let i = 0; i < length; i++) {
		uintArray[i] = binaryString.charCodeAt(i);
	}

	return uintArray;
}

export async function urlToReadStream(url: string): Promise<ReadStream> {
	const response = await axios.get(url, { responseType: "stream" });
	return response.data;
}

export async function downloadAsFileLike(url: string): Promise<FileLike> {
	const response = await axios.get(url, { responseType: "arraybuffer" });
	const buffer = Buffer.from(response.data, "binary");
	const blob = new Blob([buffer]);
	const file = new File([blob], "file");
	return file;
}
