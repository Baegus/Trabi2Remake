// Pre-compute the RGB565 look-up tables
const redTable = new Uint32Array(32);
for (let i = 0; i < 32; i++) { redTable[i] = (i * 255) / 31; }

const greenTable = new Uint32Array(64);
for (let i = 0; i < 64; i++) { greenTable[i] = (i * 255) / 63; }

const blueTable = redTable;
const alphaMask = (255 << 24);

export function getGraphicsAtlasLayout(frameWidth, frameHeight, frameCount, maxTextureSize = 2048, framePadding = 0) {
	const cellWidth = frameWidth + framePadding * 2;
	const cellHeight = frameHeight + framePadding * 2;
	if (cellWidth > maxTextureSize || cellHeight > maxTextureSize) throw new RangeError("Frame exceeds texture size limit");
	const maxColumns = Math.floor(maxTextureSize / cellWidth);
	const maxRows = Math.floor(maxTextureSize / cellHeight);
	const columns = Math.min(frameCount, maxColumns, Math.max(Math.ceil(frameCount / maxRows), Math.ceil(Math.sqrt(frameCount * cellHeight / cellWidth))));
	const rows = Math.ceil(frameCount / columns);
	if (rows > maxRows) throw new RangeError("Atlas exceeds texture size limit");
	return { columns, rows, width: columns * cellWidth, height: rows * cellHeight };
}

/**
 * Parses binary RGB565 data into a standardized canvas element
 */
export function parseGraphics(data, config) {
	return new Promise((resolve) => {
		const {
			headerSize = 0,
			xCount = 1,
			yCount = 1,
			rowWidth,
			rowHeight,
			transparent = false,
			transparentColor = 0,
			paddingPerFrame = 0,
			maxTextureSize = 2048,
			framePadding = 0
		} = config;

		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");

		const layout = getGraphicsAtlasLayout(rowWidth, rowHeight, yCount * xCount, maxTextureSize, framePadding);
		canvas.width = layout.width;
		canvas.height = layout.height;

		const imageData = ctx.createImageData(canvas.width, canvas.height);
		const buf32 = new Uint32Array(imageData.data.buffer);

		let pixelIndex = headerSize;

		for (let yRow = 0; yRow < yCount; yRow++) {
			for (let xRow = 0; xRow < xCount; xRow++) {
				const frame = yRow * xCount + xRow;
				const frameX = frame % layout.columns * (rowWidth + framePadding * 2) + framePadding;
				const frameY = Math.floor(frame / layout.columns) * (rowHeight + framePadding * 2) + framePadding;
				for (let y = 0; y < rowHeight; y++) {
					for (let x = 0; x < rowWidth; x++) {
						const value = data[pixelIndex] | (data[pixelIndex + 1] << 8);

						const redIdx = (value >> 11) & 0x1F;
						const greenIdx = (value >> 5) & 0x3F;
						const blueIdx = value & 0x1F;

						const redValue = redTable[redIdx];
						const greenValue = greenTable[greenIdx];
						const blueValue = blueTable[blueIdx];

						const isTransparent = transparent && value === transparentColor;

						// JS uses little-endian TypedArrays so format is ABGR locally
						const dataIndex = (frameY + y) * canvas.width + frameX + x;
						buf32[dataIndex] = isTransparent ? 0 :
							(alphaMask | (blueValue << 16) | (greenValue << 8) | redValue);

						pixelIndex += 2;
					}
				}
				for (let borderY = -framePadding; borderY < rowHeight + framePadding; borderY++) {
					for (let borderX = -framePadding; borderX < rowWidth + framePadding; borderX++) {
						if (borderX >= 0 && borderX < rowWidth && borderY >= 0 && borderY < rowHeight) continue;
						const sourceX = Math.max(0, Math.min(rowWidth - 1, borderX));
						const sourceY = Math.max(0, Math.min(rowHeight - 1, borderY));
						buf32[(frameY + borderY) * canvas.width + frameX + borderX] =
							buf32[(frameY + sourceY) * canvas.width + frameX + sourceX];
					}
				}
				pixelIndex += paddingPerFrame;
			}
		}

		ctx.putImageData(imageData, 0, 0);

		resolve({
			image: canvas,
			frameWidth: rowWidth,
			frameHeight: rowHeight,
			frameCount: yCount * xCount,
			framePadding,
		});
	});
}