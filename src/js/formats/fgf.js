class FGFFile extends Phaser.Loader.FileTypes.BinaryFile {
	constructor(loader, key, url, xhrSettings) {
		super(loader, key, url, xhrSettings);
		this.key = key;
		this.isFGF = url.toLowerCase().endsWith(".fgf");
	}

	processGraphics(data, isFGF = false) {
		return new Promise((resolve) => {
			const headerSize = isFGF ? 0 : 5;
			const sizeHeader = isFGF ? [] : new Uint16Array(data.buffer.slice(1, headerSize));
			const xCount = isFGF ? 1 : 1 + data[2];
			const yCount = isFGF ? 1 : data[0];
			const rowWidth = isFGF ? 640 : sizeHeader[0];
			const rowHeight = isFGF ? 480 : sizeHeader[1];

			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");

			canvas.width = rowWidth;
			canvas.height = rowHeight * yCount;
			const imageData = ctx.createImageData(canvas.width, canvas.height);

			let dataIndex = 0;
			let pixelIndex = headerSize;

			const redTable = new Array(32);
			for (let i = 0; i < 32; i++) {
				redTable[i] = (i * 255) / 31;
			}
			const greenTable = new Array(64);
			for (let i = 0; i < 64; i++) {
				greenTable[i] = (i * 255) / 63;
			}
			const blueTable = redTable;

			for (let yRow = 0; yRow < yCount; yRow++) {
				for (let xRow = 0; xRow < xCount; xRow++) {
					for (let y = 0; y < rowHeight; y++) {
						for (let x = 0; x < rowWidth; x++) {
							const value = data[pixelIndex] | (data[pixelIndex + 1] << 8);

							const redIdx = (value >> 11) & 0x1F;
							const greenIdx = (value >> 5) & 0x3F;
							const blueIdx = value & 0x1F;

							const redValue = redTable[redIdx];
							const greenValue = greenTable[greenIdx];
							const blueValue = blueTable[blueIdx];

							imageData.data[dataIndex++] = redValue;
							imageData.data[dataIndex++] = greenValue;
							imageData.data[dataIndex++] = blueValue;

							const transparent = (!isFGF && (redValue + greenValue + blueValue) === 0);
							imageData.data[dataIndex++] = transparent ? 0 : 255;

							pixelIndex += 2;
						}
					}
					pixelIndex += 4;
				}
			}

			ctx.putImageData(imageData, 0, 0);

			resolve({
				image: canvas,
				frameWidth: rowWidth,
				frameHeight: rowHeight,
			});
		});
	}

	async onProcess() {
		const decoded = await this.processGraphics(new Uint8Array(this.xhrLoader.response), this.isFGF);
		this.data = decoded.image;

		if (this.isFGF) {
			await this.loader.textureManager.addImage(this.key, this.data);
		} else {
			await this.loader.textureManager.addSpriteSheet(this.key, decoded.image, {
				frameWidth: decoded.frameWidth,
				frameHeight: decoded.frameHeight
			});
		}

		this.onProcessComplete();
	}
}

export default class FGFPlugin extends Phaser.Plugins.BasePlugin {
	constructor(pluginManager) {
		super(pluginManager);
		pluginManager.registerFileType('fgf', this.fileCallback);
		pluginManager.registerFileType('fsf', this.fileCallback);
	}

	fileCallback(key, url, xhrSettings) {
		this.addFile(new FGFFile(this, key, url, xhrSettings));
		return this;
	}
}