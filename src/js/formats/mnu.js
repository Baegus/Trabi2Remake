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
		return button;
	});
	const switches = Array.from({ length: view.getUint8(offset++) }, () => {
		const position = readPosition();
		const value = view.getUint8(offset++);
		return { ...position, value, texture: readString() };
	});
	const sliders = Array.from({ length: view.getUint8(offset++) }, () => {
		const position = readPosition();
		const value = view.getUint8(offset++);
		const width = view.getUint16(offset, true);
		offset += 2;
		return { ...position, value, width, texture: readString() };
	});
	const images = Array.from({ length: view.getUint8(offset++) }, () => {
		const position = readPosition();
		const frame = view.getUint8(offset++);
		return { ...position, frame, texture: readString() };
	});
	const inputs = Array.from({ length: view.getUint8(offset++) }, () => {
		const position = readPosition();
		const maxLength = view.getUint8(offset++);
		const text = readString();
		view.getUint8(offset + 2);
		offset += 3;
		return { ...position, maxLength, text };
	});
	const textCount = view.getUint8(offset++);
	const textPositions = Array.from({ length: textCount }, () => {
		const position = readPosition();
		view.getUint8(offset + 2);
		offset += 3;
		return position;
	});
	return { background, cursor, tooltips, buttons, switches, sliders, images, inputs, textPositions };
}