class SNDFile extends Phaser.Loader.FileTypes.BinaryFile {
	constructor (loader, key, url, xhrSettings) {
		super(loader, key, url, xhrSettings);
		this.key = key;
		this.audioContext = new AudioContext();
	}

	decodeFileName (arrayBuffer) {
		return new TextDecoder("windows-1250").decode(arrayBuffer).split(/\u0000{1,}/)[0];
	}

	async arrayBufferToAudioBuffer(arrayBuffer) {
		return new Promise((resolve, reject) => {
			this.audioContext.decodeAudioData(arrayBuffer, function(data) {
				resolve(data)
			}, reject)
		})
	}

	createWavHeader(dataLength, sampleRate = 22050, numChannels = 1, bitsPerSample = 8) {
		function writeString(view, offset, string) {
			for (let i = 0; i < string.length; i++) {
				view.setUint8(offset + i, string.charCodeAt(i));
			}
		}

		const blockAlign = numChannels * bitsPerSample / 8;
		const byteRate = sampleRate * blockAlign;
		const headerSize = 44;

		let buffer = new ArrayBuffer(headerSize);
		let view = new DataView(buffer);

		// "RIFF" chunk descriptor
		writeString(view, 0, 'RIFF');
		view.setUint32(4, 36 + dataLength, true); // File size - 8
		writeString(view, 8, 'WAVE');

		// "fmt " sub-chunk
		writeString(view, 12, 'fmt ');
		view.setUint32(16, 16, true); // Sub-chunk size (16 for PCM)
		view.setUint16(20, 1, true); // Audio format (1 for PCM)
		view.setUint16(22, numChannels, true);
		view.setUint32(24, sampleRate, true);
		view.setUint32(28, byteRate, true);
		view.setUint16(32, blockAlign, true);
		view.setUint16(34, bitsPerSample, true);

		// "data" sub-chunk
		writeString(view, 36, 'data');
		view.setUint32(40, dataLength, true);

		return new Uint8Array(buffer);
	}

	async unpackSND (data) {
		const decodedFiles = [];
		const fileCountHeaderLength = 2;
		const fileCount = new Uint8Array(data.buffer.slice(0, fileCountHeaderLength-1))[0];
		console.log("fileCount",fileCount);
		const fileNameLength = 8;
		const offsetInfoLength = 8;
		const fileInfoLength = fileNameLength+offsetInfoLength;

		let lastPosition = 0;

		for (let i=0;i<fileCount;i++) {
			const fileInfoStart = fileCountHeaderLength+(i*fileInfoLength);
			const fileName = this.decodeFileName(data.buffer.slice(fileInfoStart,fileInfoStart+fileInfoLength));
			const offsetInfoStart = fileInfoStart+fileNameLength;
			const offsetInfo = new Uint32Array(data.buffer.slice(offsetInfoStart,offsetInfoStart+offsetInfoLength));
			const pcmData = new Int8Array(data.buffer.slice(offsetInfo[0],offsetInfo[0]+offsetInfo[1]));

			for (let i = 0; i < pcmData.length; i++) {
				// Convert from signed to unsigned
				pcmData[i] += 128;
			}
			const header = this.createWavHeader(pcmData.length);
			const wavData = new Uint8Array(header.length + pcmData.length);
			wavData.set(header, 0);
			wavData.set(pcmData, header.length);

			decodedFiles.push({
				name: fileName,
				data: wavData
			});
		}
		return decodedFiles;
	}


	async onProcess () {
		const unpackedFiles = await this.unpackSND(new Uint8Array(this.xhrLoader.response));
		for (let i=0;i<unpackedFiles.length;i++) {
			const fileEntry = unpackedFiles[i];
			this.data = fileEntry.data;
			const audioBuffer = await this.arrayBufferToAudioBuffer(fileEntry.data.buffer);
			await this.loader.cacheManager.audio.add(`${this.key}-${fileEntry.name}`,audioBuffer);
		}
		this.onProcessComplete();
	}

}

export default class SNDPlugin extends Phaser.Plugins.BasePlugin {

	constructor (pluginManager) {
		super(pluginManager);
		pluginManager.registerFileType('snd', this.fileCallback);
	}

	fileCallback (key, url, xhrSettings) {
		this.addFile(new SNDFile(this, key, url, xhrSettings));
		return this;
	}

}
