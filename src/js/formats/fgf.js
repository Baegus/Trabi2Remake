class FGFFile extends Phaser.Loader.FileTypes.BinaryFile {
	constructor (loader, key, url, xhrSettings) {
		super(loader, key, url, xhrSettings);
		this.key = key;
		this.isFGF = url.toLowerCase().endsWith(".fgf");
	}

	async processGraphics (data,isFGF = false) {
		return new Promise(async (resolve,reject) => {
			const headerSize = isFGF ? 0 : 5;
			const sizeHeader = isFGF ? [] : new Uint16Array(data.buffer.slice(1, headerSize));
			const actualData = new Uint16Array(data.slice(headerSize));
			const xCount = isFGF ? 1 : 1 + data[2];
			const yCount = isFGF ? 1 : data[0];
			const rowWidth  = isFGF ? 640 : sizeHeader[0];
			const rowHeight = isFGF ? 480 : sizeHeader[1];

			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");

			canvas.width  = rowWidth;
			canvas.height = rowHeight * yCount;
			const imageData = ctx.createImageData(canvas.width, canvas.height);
			let dataIndex = 0;
			let pixelIndex = headerSize;

			for (let yRow = 0; yRow < yCount; yRow++) {
				for (let xRow = 0; xRow < xCount; xRow++) {
					for (let y = 0; y < rowHeight; y++) {
						for (let x = 0; x < rowWidth; x++) {
							const value = data[pixelIndex] | (data[pixelIndex + 1] << 8);
							let redValue = (value >> 11) & 0x1F;
							let greenValue = (value >> 5) & 0x3F;
							let blueValue = value & 0x1F;

							redValue = (redValue * 255) / 31;
							greenValue = (greenValue * 255) / 63;
							blueValue = (blueValue * 255) / 31;

							imageData.data[dataIndex++] = redValue;
							imageData.data[dataIndex++] = greenValue;
							imageData.data[dataIndex++] = blueValue;
							const transparent = (!isFGF && (redValue+greenValue+blueValue)===0);
							imageData.data[dataIndex++] = transparent ? 0 : 255;


							pixelIndex += 2;
						}
					}
					pixelIndex += 4;
				}
			}
		
			await ctx.putImageData(imageData, 0, 0);
			canvas.toBlob((blob) => {
				const newImg = document.createElement("img");
				const url = URL.createObjectURL(blob);
				newImg.onload = () => {
					resolve({
						image: newImg,
						frameWidth: rowWidth,
						frameHeight: rowHeight,
					});
					URL.revokeObjectURL(url);
				};
				newImg.src = url;
			},"image/png")
		});
	};


	async onProcess () {
		const decoded = await this.processGraphics(new Uint8Array(this.xhrLoader.response),this.isFGF);
		this.data = decoded.image;
		if (this.isFGF) {
			await this.loader.textureManager.addImage(this.key,this.data);
		} else {
			await this.loader.textureManager.addSpriteSheet(this.key,decoded.image,{frameWidth:decoded.frameWidth,frameHeight:decoded.frameHeight})
		}
		this.onProcessComplete();
	}

}

export default class FGFPlugin extends Phaser.Plugins.BasePlugin {

	constructor (pluginManager) {
		super(pluginManager);
		pluginManager.registerFileType('fgf', this.fileCallback);
		pluginManager.registerFileType('fsf', this.fileCallback);
	}

	fileCallback (key, url, xhrSettings) {
		this.addFile(new FGFFile(this, key, url, xhrSettings));
		return this;
	}

}
