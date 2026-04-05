class PKGFile extends Phaser.Loader.FileTypes.BinaryFile {
	constructor (loader, key, url, xhrSettings) {
		super(loader, key, url, xhrSettings);
		this.key = key;
	}

	decodeFileName (arrayBuffer) {
		return new TextDecoder("windows-1250").decode(arrayBuffer);
	}

	processGraphics(data) {
		return new Promise((resolve) => {
			const headerSize = 4;
			const sizeHeader = new Uint16Array(data.buffer.slice(0, headerSize));
			const imgWidth = sizeHeader[0];
			const imgHeight = sizeHeader[1];

			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");

			canvas.width = imgWidth;
			canvas.height = imgHeight;
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

			for (let y = 0; y < imgHeight; y++) {
				for (let x = 0; x < imgWidth; x++) {
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
					imageData.data[dataIndex++] = 255;

					pixelIndex += 2;
				}
			}

			ctx.putImageData(imageData, 0, 0);

			resolve({
				image: canvas,
				frameWidth: imgWidth,
				frameHeight: imgHeight,
			});
		});
	}

	async unPKG (data) {
		const decodedFiles = [];
		const fileCountHeaderLength = 2;
		const fileCount = new Uint8Array(data.buffer.slice(0, fileCountHeaderLength-1))[0];
		const fileNameLength = 12;


		let curByte = fileCountHeaderLength;

		for (let i=0;i<fileCount;i++) {
			const fileName = this.decodeFileName(data.buffer.slice(curByte,curByte+fileNameLength));
			curByte += fileNameLength;
			const imageWidth = new Uint8Array(data.buffer.slice(curByte,curByte+1))[0];
			curByte+=2;
			const imageHeight = new Uint8Array(data.buffer.slice(curByte,curByte+1))[0];
			curByte+=3;
			const fileLength = (imageWidth*imageHeight)*2;
			const fileData = data.buffer.slice(curByte-5,curByte+fileLength);
			curByte += fileLength;
			decodedFiles.push({
				name: fileName,
				data: fileData
			});
		}
		return decodedFiles;
	}


	async onProcess() {
		const unpackedFiles = await this.unPKG(new Uint8Array(this.xhrLoader.response));
		
		for (let i = 0; i < unpackedFiles.length; i++) {
			const fileEntry = unpackedFiles[i];
			const decoded = await this.processGraphics(new Uint8Array(fileEntry.data));

			this.data = decoded.image;
			await this.loader.textureManager.addImage(`${this.key}-${i}`, this.data);
		}

		this.onProcessComplete();
	}

}

export default class PKGPlugin extends Phaser.Plugins.BasePlugin {

	constructor (pluginManager) {
		super(pluginManager);
		pluginManager.registerFileType('pkg', this.fileCallback);
	}

	fileCallback (key, url, xhrSettings) {
		this.addFile(new PKGFile(this, key, url, xhrSettings));
		return this;
	}

}
