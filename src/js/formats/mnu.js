export function parseMenuLayout(data) {
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	const decoder = new TextDecoder();
	let offset = 0;
	const readString = () => {
		const length = view.getUint8(offset);
		if (length > 12 || offset + 13 > data.byteLength) throw new RangeError("Invalid MNU filename record");
		const value = decoder.decode(data.subarray(offset + 1, offset + 1 + length)).toUpperCase();
		offset += 13;
		return value;
	};
	const readPosition = () => {
		const position = { x: view.getInt16(offset, true), y: view.getInt16(offset + 2, true) };
		offset += 4;
		return position;
	};
	const background = readString();
	const cursor = readString();
	const tooltips = readString();
	const buttonCount = view.getUint8(offset++);
	const buttons = Array.from({ length: buttonCount }, () => {
		const button = { ...readPosition(), texture: readString() };
		view.getUint32(offset, true);
		offset += 4;
		return button;
	});
	const textCount = view.getUint8(offset++);
	const textPositions = Array.from({ length: textCount }, () => {
		const position = readPosition();
		view.getUint8(offset + 2);
		offset += 3;
		return position;
	});
	return { background, cursor, tooltips, buttons, textPositions };
}