import { textToWholePixels } from "../modules/utils";
import { playSound } from "../modules/audio";
import { createCursor } from "../modules/cursor";

export default class Race extends Phaser.Scene {
	constructor () {
		super({
			key: "race",
			maxLights: 30,
			physics: {
				arcade: {
					// debug: true
				},
				matter: {
					// debug: true,
					// gravity: { y: 0.5 }
				}
			}
		});
		this.spr = {};

	}

	preload() {
		const mapOrder = this.registry.get("mapOrder");
		const currentMap = mapOrder[this.registry.get("currentMap")];
		const currentMapFile = currentMap>9 ? `Trat${[currentMap]}.map` : `Trat0${currentMap}.map`;
		console.log(currentMapFile);
		const binaryMapData = this.cache.binary.get(currentMapFile);
		const mapData = Array.from(binaryMapData.slice(2));
		const mapWidth  = binaryMapData[0]; // in tiles
		const mapHeight = binaryMapData[1]; // in tiles
		const tilemapData = [];
		while (mapData.length > 0) {
			tilemapData.push(mapData.splice(0, mapWidth));
		}

		const tileSize = 100;
		
		this.tilemap = this.make.tilemap({ data: tilemapData, tileWidth: tileSize, tileHeight: tileSize });
		
	}

	create() {
		this.events.off();

		const toPx = (tileUnits) => tileUnits * this.tileSize;

		const mapTextures = "POZ.FSF"; // TODO set according to map
		const tiles = this.tilemap.addTilesetImage(mapTextures);
		const layer = this.tilemap.createLayer(0, tiles, 0, 0);

		// this.add.rectangle(toPx(21), toPx(28), this.tileSize, this.tileSize, 0xff0000).setOrigin(0, 0);
		this.add.model3D(toPx(21), toPx(28), "VEZ.3D", mapTextures3D);
		this.add.model3D(toPx(22), toPx(28), "DEPO8.3D", mapTextures3D);

		const cursor = createCursor(this);

		const cam = this.cameras.main;

		cam.scrollX = 2036;
		cam.scrollY = 2913;

		this.input.on("pointermove", function (p) {
			if (!p.isDown) return;
			cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
			cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
		});

		this.input.on("wheel", function (e) {
			if (!e.event.shiftKey) return;
			const amount = (e.deltaY<0?-0.1:0.1);
			cam.setZoom(cam.zoom - amount);
		});
	}
		
}