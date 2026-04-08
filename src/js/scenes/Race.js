import { textToWholePixels } from "../modules/utils";
import { playSound } from "../modules/audio";
import { createCursor } from "../modules/cursor";
import { parse3DM } from "../modules/3dm";
import { parseIL } from "../modules/il";
import { parseSP1SP2 } from "../modules/sp1sp2";
import { createCar } from "../modules/car";
import { STATIC, b2Body_ApplyLinearImpulse, b2Body_GetLinearVelocity, b2Body_GetMass, b2Body_GetTransform, b2Body_GetWorldCenterOfMass, b2Vec2, pxm } from "phaser-box2d/dist/PhaserBox2D.js";
import { assignB2BodyBox, assignB2BodyCircle, createB2World, updateB2worldStepAndCollisions, createB2WallBoundaries } from "../modules/box2dUtils.js";


const debugging = process.env.DEBUG == "true";

export default class Race extends Phaser.Scene {
	constructor () {
		super({
			key: "race",
			maxLights: 30,
		});
	}

	preload() {
		const scene = this;
		const mapOrder = scene.registry.get("mapOrder");
		const currentMap = mapOrder[scene.registry.get("currentMap")];
		const currentMapFile = currentMap>9 ? `Trat${[currentMap]}.map` : `Trat0${currentMap}.map`;
		const currentMapFileUpper = currentMapFile.toUpperCase();
		console.log("Current map file:", currentMapFile);
		// Parse and make the main tilemap:
		const binaryMapData = scene.cache.binary.get(currentMapFile);
		const mapData = Array.from(binaryMapData.slice(2));
		const mapWidth  = binaryMapData[0]; // in tiles
		const mapHeight = binaryMapData[1]; // in tiles
		const tilemapData = [];
		while (mapData.length > 0) {
			tilemapData.push(mapData.splice(0, mapWidth));
		}

		scene.tileSize = 100;
		scene.tilemap = scene.make.tilemap({ data: tilemapData, tileWidth: scene.tileSize, tileHeight: scene.tileSize });

		// Get 3D model placements:
		const modelPlacementFile = currentMapFileUpper.replace(".MAP", ".3DM");
		const modelPlacementData = parse3DM(scene.cache.binary.get(modelPlacementFile));
		scene.modelPlacements = modelPlacementData;

		// Get AI node positions if they exist:
		const il1File = scene.cache.binary.get(currentMapFile.replace(".map",".il1"));
		const il2File = scene.cache.binary.get(currentMapFile.replace(".map",".il2"));
		if (il1File) scene.aiNodes1 = parseIL(il1File);
		if (il2File) scene.aiNodes2 = parseIL(il2File);

		// Parse SP1+SP2 additional sprite data
		const sp1Parsed = parseSP1SP2(scene, currentMapFile.replace(".map", ".sp1"));
		const sp2Parsed = parseSP1SP2(scene, currentMapFile.replace(".map", ".sp2"));

		// Save parsed entries for placing exact images later in create()
		scene.additionalSprites1Entries = sp1Parsed.entries || [];
		scene.additionalSprites2Entries = sp2Parsed.entries || [];
	}

	create() {
		const scene = this;
		scene.events.off();

		const toPx = (tileUnits) => tileUnits * scene.tileSize;

		const mapTextures = "POZ.FSF"; // TODO set according to map
		const mapTextures3D = "TEXTURY.PKG"; // TODO set according to map
		const mapTexturesSP1 = "ONIKY.FSF"; // TODO set according to map
		const mapTexturesSP2 = "DIVACI.FSF";
		const tiles = scene.tilemap.addTilesetImage(mapTextures);
		const layer = scene.tilemap.createLayer(0, tiles, 0, 0);

		for (const e of scene.additionalSprites1Entries) {
			const image = scene.add.image(e.x, e.y, mapTexturesSP1, e.frame).setOrigin(0, 0).setDepth(2);
		}

		for (const e of scene.additionalSprites2Entries) {
			const image = scene.add.image(e.x, e.y, mapTexturesSP2, e.frame).setOrigin(0, 0).setDepth(2);
		}

		scene.cars = [];
		scene.playerCar = createCar(scene, toPx(23), toPx(32), 0);
		scene.cars.push(scene.playerCar);

		// scene.add.rectangle(toPx(21), toPx(28), scene.tileSize, scene.tileSize, 0xff0000).setOrigin(0, 0);

		for (const model of scene.modelPlacements) {
			scene.add.model3D(model.x, model.y, model.name, mapTextures3D);

		}

		if (debugging) {
			const aiNodesGraphics = scene.add.graphics().setAlpha(0.5);
			if (scene.aiNodes1) {
				aiNodesGraphics.lineStyle(2, 0x00ff00);
				aiNodesGraphics.fillStyle(0x00ff00);
				aiNodesGraphics.beginPath();
				scene.aiNodes1.forEach(node => {
					aiNodesGraphics.lineTo(node.x, node.y);
					aiNodesGraphics.fillRect(node.x - 3, node.y - 3, 6, 6);
				});
				aiNodesGraphics.closePath();
				aiNodesGraphics.strokePath();
			}
			if (scene.aiNodes2) {
				aiNodesGraphics.lineStyle(2, 0x0000ff);
				aiNodesGraphics.fillStyle(0x0000ff);
				aiNodesGraphics.beginPath();
				scene.aiNodes2.forEach(node => {
					aiNodesGraphics.lineTo(node.x, node.y);
					aiNodesGraphics.fillRect(node.x - 3, node.y - 3, 6, 6);
				});
				aiNodesGraphics.closePath();
				aiNodesGraphics.strokePath();
			}
		}

		// scene._synOverlay = window.SYNDebug.createInteractiveOverlay("POZ.SYN", scene, scene.tilemap);

		const cursor = createCursor(scene);

		const cam = scene.cameras.main;

		cam.scrollX = 2036;
		cam.scrollY = 2913;
		

		scene.input.on("pointermove", function (p) {
			if (!p.isDown) return;
			cam.stopFollow();
			cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
			cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
		});

		scene.input.on("wheel", function (e) {
			if (!e.event.shiftKey) return;
			const amount = (e.deltaY<0?-0.1:0.1);
			cam.setZoom(cam.zoom - amount);
		});

		scene.scene.launch("hud");
	}
		
}