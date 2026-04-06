class SYNFile extends Phaser.Loader.FileTypes.BinaryFile {
	constructor(loader, key, url, xhrSettings) {
		super(loader, key, url, xhrSettings);
		this.key = key;
		this.isSYN = url.toLowerCase().endsWith(".syn");
	}

	processGraphics(data) {
		// data: Uint8Array
		return new Promise((resolve) => {
			// SYN files in this project appear to contain multiple 100x100 monochrome
			// tiles packed as 1 bit per pixel (100x100 = 10000 bits = 1250 bytes).
			// Some files contain a repeating header sequence: 0x64 0x00 0x64 0x00
			// We'll scan for that header and extract blocks of 1250 bytes. If none
			// found, fall back to splitting the file into 1250-byte chunks.

			const TILE_W = 100;
			const TILE_H = 100;
			const BYTES_PER_TILE = Math.ceil((TILE_W * TILE_H) / 8); // 1250

			const tiles = [];
			const header = [0x64, 0x00, 0x64, 0x00];
			let i = 0;
			let foundHeader = false;
			while (i <= data.length - 4) {
				if (data[i] === header[0] && data[i+1] === header[1] && data[i+2] === header[2] && data[i+3] === header[3]) {
					// try to slice next BYTES_PER_TILE bytes
					if (i + 4 + BYTES_PER_TILE <= data.length) {
						tiles.push(data.slice(i + 4, i + 4 + BYTES_PER_TILE));
						foundHeader = true;
						i += 4 + BYTES_PER_TILE;
						continue;
					} else {
						break;
					}
				}
				i++;
			}

			if (!foundHeader) {
				// fallback: split into consecutive tiles if the file length is a multiple
				// (or nearly multiple) of BYTES_PER_TILE
				if (data.length >= BYTES_PER_TILE) {
					const possibleCount = Math.floor(data.length / BYTES_PER_TILE);
					for (let t = 0; t < possibleCount; t++) {
						const start = t * BYTES_PER_TILE;
						tiles.push(data.slice(start, start + BYTES_PER_TILE));
					}
				}
			}

			// Build a canvas sprite sheet from tiles
			const tileCount = tiles.length;
			const cols = Math.max(1, Math.min(16, Math.ceil(Math.sqrt(tileCount))));
			const rows = Math.ceil(tileCount / cols);
			const canvas = document.createElement('canvas');
			canvas.width = cols * TILE_W;
			canvas.height = rows * TILE_H;
			const ctx = canvas.getContext('2d');
			const imgData = ctx.createImageData(canvas.width, canvas.height);

			// convert each tile's bitstream into pixels (neon-orange for 1, dark for 0)
			for (let t = 0; t < tileCount; t++) {
				const block = tiles[t];
				const offsetX = (t % cols) * TILE_W;
				const offsetY = Math.floor(t / cols) * TILE_H;
				for (let y = 0; y < TILE_H; y++) {
					for (let x = 0; x < TILE_W; x++) {
						const bitIndex = y * TILE_W + x;
						const byteIdx = Math.floor(bitIndex / 8)	;
						const bitOffset = bitIndex % 8;
						const byte = block[byteIdx];
						// MSB-first as typical in these assets
						const bit = (byte >> (7 - bitOffset)) & 1;
						const globalX = offsetX + x;
						const globalY = offsetY + y;
						const pxIdx = (globalY * canvas.width + globalX) * 4;
						if (bit) {
							imgData.data[pxIdx + 0] = 255; // R
							imgData.data[pxIdx + 1] = 170; // G
							imgData.data[pxIdx + 2] = 0;   // B
							imgData.data[pxIdx + 3] = 255; // A
						} else {
							imgData.data[pxIdx + 0] = 20;
							imgData.data[pxIdx + 1] = 20;
							imgData.data[pxIdx + 2] = 20;
							imgData.data[pxIdx + 3] = 255;
						}
					}
				}
			}

			ctx.putImageData(imgData, 0, 0);

			// Store parsed tiles for debug drawing into a global registry so other
			// code (or the console) can toggle overlays. Keep the raw bit blocks too.
			if (!window.SYNParsed) window.SYNParsed = {};
			window.SYNParsed[this.key] = {
				image: canvas,
				frameWidth: TILE_W,
				frameHeight: TILE_H,
				cols: cols,
				rows: rows,
				tileCount: tileCount,
				rawTiles: tiles
			};

			resolve({
				image: canvas,
				frameWidth: TILE_W,
				frameHeight: TILE_H
			});
		});
	}

	async onProcess() {
		const decoded = await this.processGraphics(new Uint8Array(this.xhrLoader.response));
		this.data = decoded.image;

		await this.loader.textureManager.addSpriteSheet(this.key, decoded.image, {
			frameWidth: decoded.frameWidth,
			frameHeight: decoded.frameHeight
		});

		this.onProcessComplete();
	}
}

export default class SYNPlugin extends Phaser.Plugins.BasePlugin {
	constructor(pluginManager) {
		super(pluginManager);
		pluginManager.registerFileType('syn', this.fileCallback);
	}

	fileCallback(key, url, xhrSettings) {
		this.addFile(new SYNFile(this, key, url, xhrSettings));
		return this;
	}
}

// Debug helper: call window.SYNDebug.drawOverlay(key, scene, tilemap, options)
// options: { alpha, cols, msbFirst, swapAxis, invert }
if (!window.SYNDebug) {
	window.SYNDebug = {};
}

window.SYNDebug.drawOverlay = function(key, scene, tilemap, options = {}) {
	const record = window.SYNParsed && window.SYNParsed[key];
	if (!record) {
		console.warn('SYN overlay: no parsed record for', key);
		return;
	}
	const opts = Object.assign({ alpha: 0.85, msbFirst: true, swapAxis: true, invert: false, indexOffset: 0 }, options);

	// Compose an overlay canvas sized to the tilemap world pixels and draw each
	// SYN tile at the corresponding tile position so it lines up with the map.
	const TILE_W = record.frameWidth;
	const TILE_H = record.frameHeight;

	const mapPixelWidth = tilemap.width * tilemap.tileWidth;
	const mapPixelHeight = tilemap.height * tilemap.tileHeight;

	const mapSequence = [
		{ type: 0, count: 6  },
		{ type: 1, count: 11 },
		{ type: 0, count: 1 },
		{ type: 1, count: 1 },
		{ type: 0, count: 1 },
		{ type: 1, count: 2 },
		{ type: 0, count: 1 },
		{ type: 1, count: 5 },
		{ type: 0, count: 1 },
		{ type: 1, count: 1 },
		{ type: 0, count: 1 },
		{ type: 1, count: 3 },
		{ type: 0, count: 1 },
		{ type: 1, count: 1 },
		{ type: 0, count: 1 },
		{ type: 1, count: 2 },
		{ type: 0, count: 1 },
		{ type: 1, count: 2 },
		{ type: 0, count: 2 },
		{ type: 1, count: 3 },
		{ type: 0, count: 1 },
		{ type: 1, count: 1 },
		{ type: 0, count: 1 },
		{ type: 1, count: 3 },
		{ type: 0, count: 1 },
		{ type: 1, count: 2 },
		{ type: 0, count: 2 },
		{ type: 1, count: 2 },
		{ type: 0, count: 1 },
		{ type: 1, count: 1 },
		{ type: 0, count: 37 },
		{ type: 1, count: 2 },
		{ type: 0, count: 2 },
		{ type: 1, count: 2 },
		{ type: 0, count: 2 },
		{ type: 1, count: 2 },
		{ type: 0, count: 2 },
		{ type: 1, count: 2 },
		{ type: 0, count: 14 }
	];

	const tileIndexToSynIndex = {};
	let seqTileIndex = 0;
	let seqSynIndex = 0;

	for (const seq of mapSequence) {
		for (let i = 0; i < seq.count; i++) {
			if (seq.type === 1) {
				tileIndexToSynIndex[seqTileIndex] = seqSynIndex;
				seqSynIndex++;
			}
			seqTileIndex++;
		}
	}

	const canvas = document.createElement('canvas');
	canvas.width = mapPixelWidth;
	canvas.height = mapPixelHeight;
	const ctx = canvas.getContext('2d');
	const imgData = ctx.createImageData(canvas.width, canvas.height);

	// iterate over tile coordinates
	for (let ty = 0; ty < tilemap.height; ty++) {
		for (let tx = 0; tx < tilemap.width; tx++) {
			const tile = tilemap.getTileAt(tx, ty);
			if (!tile) continue;
			// Phaser's tile.index is 1-based (0 means empty/no tile) for the first tileset
			let tileId = tile.index - 1; 
			
			// Get synIndex from our map
			const baseSynIndex = tileIndexToSynIndex[tileId];
			if (baseSynIndex === undefined) continue;
			
			const synIndex = (baseSynIndex + opts.indexOffset + record.tileCount) % record.tileCount;
			if (synIndex < 0 || synIndex >= record.tileCount) continue;

			const block = record.rawTiles[synIndex];

			// draw the tile's bits into the correct position on the map canvas
			const destX = tx * tilemap.tileWidth;
			const destY = ty * tilemap.tileHeight;

			for (let y = 0; y < TILE_H; y++) {
				for (let x = 0; x < TILE_W; x++) {
					let bitIndex = opts.swapAxis ? (x * TILE_H + y) : (y * TILE_W + x);
					const byteIdx = Math.floor(bitIndex / 8);
					const bitOffset = bitIndex % 8;
					const byte = block[byteIdx];
					let bit = ((byte >> (7 - bitOffset)) & 1);
					
					if (opts.invert) bit = bit ? 0 : 1;
					if (!bit) continue; // leave transparent

					let pX = opts.flipX ? (TILE_W - 1 - x) : x;
					let pY = opts.flipY ? (TILE_H - 1 - y) : y;
					
					const globalX = destX + pX;
					const globalY = destY + pY;
					if (globalX < 0 || globalX >= canvas.width || globalY < 0 || globalY >= canvas.height) continue;
					const pxIdx = (globalY * canvas.width + globalX) * 4;
					imgData.data[pxIdx + 0] = 255;
					imgData.data[pxIdx + 1] = 170;
					imgData.data[pxIdx + 2] = 0;
					imgData.data[pxIdx + 3] = Math.floor(255 * opts.alpha);
				}
			}
		}
	}

	ctx.putImageData(imgData, 0, 0);

	const texKey = `__SYN_DBG__${key}`;
	const gm = scene.textures;
	if (gm.exists(texKey)) gm.remove(texKey);
	gm.addImage(texKey, canvas);

	// place at tilemap world position (tilemap likely at 0,0 but keep generic)
	const layerX = (tilemap.layers && tilemap.layers[0] && tilemap.layers[0].x) || 0;
	const layerY = (tilemap.layers && tilemap.layers[0] && tilemap.layers[0].y) || 0;

	const img = scene.add.image(layerX, layerY, texKey).setOrigin(0, 0).setDepth(9999);
	// scroll with the world (so it lines up with the tilemap)
	img.setScrollFactor(1);

	return img; // caller can destroy when done
};

// createInteractiveOverlay: draw the overlay and install keyboard controls
// D: cycle indexOffset (0..tileCount) ; F: toggle swapAxis
window.SYNDebug.createInteractiveOverlay = function(key, scene, tilemap, options = {}) {
	const record = window.SYNParsed && window.SYNParsed[key];
	if (!record) {
		console.warn('SYN overlay: no parsed record for', key);
		return null;
	}
	const state = {
		key,
		scene,
		tilemap,
		opts: Object.assign({ indexOffset: 0, swapAxis: false, msbFirst: true, alpha: 0.85, invert: true, flipX: false, flipY: false }, options),
		img: null
	};

	function draw() {
		if (state.img && state.img.destroy) {
			state.img.destroy();
		}
		state.img = window.SYNDebug.drawOverlay(state.key, state.scene, state.tilemap, state.opts);
	}

	// cleanup on scene shutdown/destroy: only remove the overlay image
	const cleanup = () => {
		try {
			if (state.img && state.img.destroy) state.img.destroy();
		} catch (e) {}
	};

	state.scene.events.on('shutdown', cleanup);
	state.scene.events.on('destroy', cleanup);

	// initial draw
	draw();

	return {
		destroy: cleanup,
		state
	};
};