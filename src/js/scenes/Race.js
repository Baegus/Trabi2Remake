import { textToWholePixels } from "../modules/utils";
import { createRaceAudio, nextMusicTrack, playMusicTrack, setRaceMusic } from "../modules/audio";
import { createCursor } from "../modules/cursor";
import { parse3DM } from "../modules/3dm";
import { parseIL } from "../modules/il";
import { parseSP1SP2 } from "../modules/sp1sp2";
import { parseLAP } from "../modules/lap";
import { createCar } from "../modules/car";
import { createOriginalClock, ORIGINAL_TICK_MS, resolveOriginalCarContacts } from "../modules/originalPhysics.js";
import { createOriginalCarEffects } from "../modules/originalCarEffects.js";
import { getGhostFrame, loadGhost, recordReplayFrame, saveGhost, updateGhostSprite } from "../modules/ghost.js";
import { advanceOriginalRoute, createOriginalAiState, getOriginalRoadContext, stepOriginalAi } from "../modules/originalAi.js";
import {
	advanceOriginalChampionship, createOriginalRacerProgress, getOriginalGridSlots, getOriginalRaceSettings, getOriginalStartingGrid, getOriginalStartLights,
	ORIGINAL_TRACK_NAMES, rankOriginalRacers, stepOriginalRacerProgress
} from "../modules/originalRace.js";
import { STATIC, b2Body_ApplyLinearImpulse, b2Body_GetLinearVelocity, b2Body_GetMass, b2Body_GetTransform, b2Body_GetWorldCenterOfMass, b2Body_SetTransform, b2Vec2, pxm } from "phaser-box2d/dist/PhaserBox2D.js";
import { assignB2BodyBox, assignB2BodyCircle, createB2World, updateB2worldStepAndCollisions } from "../modules/box2dUtils.js";


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
		const currentMapFile = `TRAT${currentMap.toString().padStart(2, "0")}.MAP`;
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
		const modelPlacementFile = currentMapFile.replace(".MAP", ".3DM");
		const modelPlacementData = parse3DM(scene.cache.binary.get(modelPlacementFile));
		scene.modelPlacements = modelPlacementData;

		// Get AI node positions if they exist:
		const il1File = scene.cache.binary.get(currentMapFile.replace(".MAP",".IL1"));
		const il2File = scene.cache.binary.get(currentMapFile.replace(".MAP",".IL2"));
		if (il1File) scene.aiNodes1 = parseIL(il1File);
		if (il2File) scene.aiNodes2 = parseIL(il2File);

		// Parse SP1+SP2 additional sprite data
		const sp1Parsed = parseSP1SP2(scene, currentMapFile.replace(".MAP", ".SP1"));
		const sp2Parsed = parseSP1SP2(scene, currentMapFile.replace(".MAP", ".SP2"));

		// Save parsed entries for placing exact images later in create()
		scene.additionalSprites1Entries = sp1Parsed.entries || [];
		scene.additionalSprites2Entries = sp2Parsed.entries || [];

		// Parse track point data (LAP)
		const lapFile = scene.cache.binary.get(currentMapFile.replace(".MAP", ".LAP"));
		if (lapFile) {
			scene.points = parseLAP(lapFile);
		}

	}

	create() {
		const scene = this;
		scene.raceSettings = getOriginalRaceSettings({
			mode: scene.registry.get("currentRaceType"), championship: scene.registry.get("championship"),
			laps: scene.registry.get("raceLaps") ?? 12, opponents: scene.registry.get("raceOpponents") ?? 5
		});
		scene.timerRunning = false;
		scene.raceOver = false;
		scene.finishTicks = null;
		scene.finishing = false;
		scene.countdownTicks = 0;

		createB2World(scene); // create Box2D world

		const toPx = (tileUnits) => tileUnits * scene.tileSize;

		const mapTextures = "POZ.FSF"; // TODO set according to map
		const mapTextures3D = "TEXTURY.PKG"; // TODO set according to map
		const mapTexturesSP1 = "ONIKY.FSF"; // TODO set according to map
		const mapTexturesSP2 = "DIVACI.FSF";
		const tiles = scene.tilemap.addTilesetImage(mapTextures, mapTextures, scene.tileSize, scene.tileSize, 1, 2);
		const layer = scene.tilemap.createLayer(0, tiles, 0, 0);

		for (const e of scene.additionalSprites1Entries) {
			const image = scene.add.image(e.x, e.y, mapTexturesSP1, e.frame).setOrigin(0, 0).setDepth(2);
		}

		for (const e of scene.additionalSprites2Entries) {
			const image = scene.add.image(e.x, e.y, mapTexturesSP2, e.frame).setOrigin(0, 0).setDepth(2);
		}

		for (const pointData in scene.points) {
			const point = scene.points[pointData];
			if (debugging) {
				const color = [0xff00ff, 0x00ff00, 0xffff00][["start", "checkpoint", "repairDepo"].indexOf(pointData)];
				const pointRect = scene.add.rectangle(point.x, point.y, 100, point.h, color, 0.5).setOrigin(0, 0);
			}
		}

		scene.carEffects = createOriginalCarEffects(scene);
		const playerTeam = scene.registry.get("playerTeam") ?? 0;
		const teams = [playerTeam, ...Array.from({ length: 6 }, (_, team) => team).filter((team) => team !== playerTeam)
			.slice(0, scene.raceSettings.opponents)];
		const previousResults = scene.registry.get("lastRaceResults") ?? [];
		const slots = getOriginalGridSlots(teams, playerTeam, previousResults, scene.registry.get("currentRaceType") === "championship");
		scene.cars = getOriginalStartingGrid(scene.points.start, teams, playerTeam, slots).map((position) => {
			const car = createCar(scene, position.x - 55, position.y - 53, position.team, position.isPlayer);
			car.isPlayer = position.isPlayer;
			car.gridPosition = slots.indexOf(position.team) + 1;
			car.raceProgress = createOriginalRacerProgress(position);
			car.aiState = createOriginalAiState();
			return car;
		});
		scene.playerCar = scene.cars.find((car) => car.isPlayer);
		scene.ghost = null;
		scene.ghostTick = 0;
		scene.replayFrames = [];
		if (scene.registry.get("currentRaceType") === "ghostRace") {
			const map = scene.registry.get("currentMap") + 1;
			const name = `T${String(map).padStart(2, "0")}_04`;
			let storage = null;
			try { storage = window.localStorage; } catch {}
			scene.ghost = loadGhost(storage, map, scene.cache.binary.get(name + ".GHO"), scene.cache.binary.get(name + ".TRR"));
			scene.ghost.map = map;
			const firstFrame = getGhostFrame(scene.ghost, 0);
			scene.ghostSprite = scene.add.image(firstFrame.x, firstFrame.y,
				"TRABANT.FSF", scene.ghost.team * 4).setDepth(9).setAlpha(0.45);
			scene.ghostSprite.name = "ghostCar";
			updateGhostSprite(scene.ghostSprite, firstFrame);
		}
		scene.originalClock = createOriginalClock();
		scene.physicsBackend = null;
		scene.setPhysicsBackend(debugging ? scene.registry.get("physicsBackend") ?? "original" : "original");
		setRaceMusic(scene);
		scene.raceAudio = createRaceAudio(scene);
		const changeMusic = (event) => {
			if (!event.repeat && ["+", "=", "-"].includes(event.key)) {
				playMusicTrack(scene, nextMusicTrack(scene.registry.get("musicTrack"), event.key === "-" ? -1 : 1));
			}
		};
		scene.input.keyboard.on("keydown", changeMusic);
		scene.events.once("shutdown", () => scene.input.keyboard.off("keydown", changeMusic));
		const togglePhysics = (event) => {
			if (!event.repeat) scene.setPhysicsBackend(scene.physicsBackend === "original" ? "box2d" : "original");
		};
		if (debugging) scene.input.keyboard.on("keydown-P", togglePhysics);
		scene.events.once("shutdown", () => {
			scene.input.keyboard.off("keydown-P", togglePhysics);
			scene.originalClock.reset();
			scene.cars = [];
			scene.playerCar = null;
			scene.timerRunning = false;
		});
		scene.events.on("resume", () => scene.originalClock.reset());

		// scene.add.rectangle(toPx(21), toPx(28), scene.tileSize, scene.tileSize, 0xff0000).setOrigin(0, 0);

		scene.originalWalls = [];
		for (const model of scene.modelPlacements) {
			const modelObject = scene.add.model3D(model.x, model.y, model.name, mapTextures3D);
			assignB2BodyBox(modelObject, {type: STATIC});
			scene.originalWalls.push({
				left: modelObject.x - modelObject.width / 2, right: modelObject.x + modelObject.width / 2,
				top: modelObject.y - modelObject.height / 2, bottom: modelObject.y + modelObject.height / 2
			});
		}

		const cursor = createCursor(scene);

		if (scene.scene.isActive("hud") || scene.scene.isPaused("hud")) scene.scene.stop("hud");
		scene.scene.launch("hud");
		

		scene.currentLapTime = 0;
		scene.bestLapTime = Infinity;
		scene.totalRaceTime = 0;
		scene.timerRunning = false;

		async function loadDebug() {
			if (process.env.DEBUG !== "true") return;
			const DEBUG = await import("../modules/debug.js");
			DEBUG.initToggleBox2dDebug(scene, true); // set true to show debug graphics by default, toggle with B
			scene.debugFPSText = scene.add.text(8, 18, "0 FPS", {
				color: "white",
				fontFamily: "Arial",
				fontSize: 13,
			}).setOrigin(0, 1).setDepth(99999).setAlpha(0);
			scene.input.keyboard.on("keydown-F", (e) => {
				scene.debugFPSText.setAlpha(scene.debugFPSText.alpha === 1 ? 0 : 1);
			});
			
			DEBUG.showAINodes(scene);
			DEBUG.showOffroadOverlay(scene);
			// DEBUG.mouseFreeCam(scene);
			DEBUG.showTileInfo(scene);
			DEBUG.switchMapsWithM(scene);
		}
		loadDebug();
	}

	setPhysicsBackend(backend) {
		if (backend !== "box2d" && backend !== "original") throw new Error(`Unknown physics backend: ${backend}`);
		if (this.physicsBackend === backend) return;
		for (const car of this.cars) {
			if (backend === "original") car.originalPhysics.enter();
			else if (this.physicsBackend === "original") car.originalPhysics.leave();
		}
		this.physicsBackend = backend;
		for (const car of this.cars) car.updateDamage();
		this.registry.set("physicsBackend", backend);
		this.originalClock.reset();
	}

	stepRacers() {
		if (!this.timerRunning || this.raceOver) return;
		for (const car of this.cars) {
			if (car.raceProgress.checkpoint || car.originalPhysics.state.pitTicks > 0) car.originalPhysics.stepPitService(this.points.repairDepo);
		}
		const snapshots = this.cars.map((car) => ({ ...car.originalPhysics.snapshot(), racerId: car.team }));
		for (const [index, car] of this.cars.entries()) {
			const state = snapshots[index];
			if (car.aiState.passing) car.aiState.passing = snapshots.find((racer) => racer.racerId === car.aiState.passing.racerId) ?? null;
			if (car.raceProgress.checkpoint && state.damage.some((damage) => damage > 1)) car.aiState.usePitRoute = true;
			const route = advanceOriginalRoute(state, this.aiNodes1, car.aiState.node);
			if (route) {
				car.raceProgress.node = route.node;
				car.raceProgress.distance = route.distance;
			}
			if (!car.isPlayer || car.raceProgress.finished) {
				car.aiControls = stepOriginalAi(car.aiState, state, car.originalPhysics.parameters, {
					nodes: this.aiNodes1, pitNodes: this.aiNodes2, finished: car.raceProgress.finished,
					racers: snapshots, repairDepo: this.points.repairDepo, team: car.team,
					road: getOriginalRoadContext(state, (x, y) => this.tilemap.getTileAt(Math.floor(x / 100), Math.floor(y / 100))?.index)
				});
				if (car.aiState.parked && this.physicsBackend === "original") car.originalPhysics.state.speed = 0;
			} else if (route) car.aiState.node = route.node;
		}
	}

	updateRaceProgress() {
		if (!this.timerRunning || this.raceOver) return;
		this.totalRaceTime += ORIGINAL_TICK_MS;
		for (const car of this.cars) {
			const state = car.originalPhysics.snapshot();
			const checkpoint = this.points.checkpoint;
			if (car.raceProgress.finished && Math.abs(state.x - checkpoint.x) <= 15 && state.y > checkpoint.y && state.y < checkpoint.y + checkpoint.h) {
				car.aiState.usePitRoute = true;
			}
			const event = stepOriginalRacerProgress(car.raceProgress, state, this.points,
				this.totalRaceTime, this.raceSettings.laps);
			if (event) car.originalPhysics.state.pitServiced = false;
			if (event && car.isPlayer) {
				this.bestLapTime = car.raceProgress.bestLap;
				this.scene.get("hud").events.emit("lapCompleted", event);
				if (event.finished) this.events.emit("playerFinished", this.cars.filter((racer) => racer.raceProgress.finished).length);
			}
		}
		this.currentLapTime = this.totalRaceTime - this.playerCar.raceProgress.lapStart;
		const ranking = rankOriginalRacers(this.cars.map((car) => ({ team: car.team, progress: car.raceProgress })));
		this.scene.get("hud").events.emit("raceProgress", {
			lap: Math.min(this.playerCar.raceProgress.laps + 1, this.raceSettings.laps), laps: this.raceSettings.laps,
			position: ranking.findIndex((racer) => racer.team === this.playerCar.team) + 1
		});
		if (this.playerCar.raceProgress.finished && !this.finishing) {
			if (this.finishTicks === null) this.finishTicks = 120;
			else this.finishTicks--;
			if (this.finishTicks === 0 || this.raceSettings.training) this.finishRace(ranking);
		}
	}

	exitTraining() {
		const championship = this.registry.get("championship");
		if (this.raceSettings.training && championship) {
			this.registry.set("sessionTitle", `${ORIGINAL_TRACK_NAMES[this.registry.get("currentMap")]} - trening`);
			advanceOriginalChampionship(championship);
			this.registry.set("championship", championship);
			this.registry.set("sessionResults", this.registry.get("lastRaceResults") ?? []);
			return true;
		}
		return false;
	}

	finishRace(ranking) {
		if (this.raceOver || this.finishing) return;
		this.finishing = true;
		if (this.ghost && this.playerCar.raceProgress.finished) {
			try {
				saveGhost(window.localStorage, this.ghost.map, this.ghost, this.playerCar.raceProgress.finishTime,
					this.registry.get("playerName") ?? "Novy hrac", this.playerCar.team, this.replayFrames);
			} catch (error) { console.warn("Ghost record was not saved", error); }
		}
		if (this.physicsBackend === "original" && !this.raceSettings.training) {
			for (let tick = 0; tick < 7200 && this.cars.some((car) => !car.raceProgress.finished); tick++) this.stepOriginalTick();
			ranking = rankOriginalRacers(this.cars.map((car) => ({ team: car.team, progress: car.raceProgress })));
		}
		this.raceOver = true;
		this.timerRunning = false;
		this.raceAudio.destroy();
		const results = ranking.map(({ team, progress }, index) => ({
			team, position: index + 1, finishTime: progress.finishTime, bestLap: progress.bestLap
		}));
		if (!this.raceSettings.training) this.registry.set("lastRaceResults", results);
		this.registry.set("sessionResults", this.raceSettings.training ? this.registry.get("lastRaceResults") ?? [] : results);
		this.registry.set("sessionTitle", `${ORIGINAL_TRACK_NAMES[this.registry.get("currentMap")]} - ${this.raceSettings.training ? "trening" : "zavod"}`);
		const championship = this.registry.get("championship");
		if (this.registry.get("currentRaceType") === "championship" && championship) {
			advanceOriginalChampionship(championship, results);
			this.registry.set("championship", championship);
			if (!championship.complete) this.registry.set("currentMap", championship.track);
		}
		this.time.delayedCall(1500, () => {
			this.scene.get("hud").events.emit("hideHUD");
			this.scene.start("raceResultsMenu", { nextScene: championship?.complete ? "outroMenu" : "raceMenu" });
		});
	}

	stepCountdown() {
		if (this.raceOver || this.finishing) return this.timerRunning;
		this.countdownTicks++;
		this.events.emit("countdown");
		if (!this.timerRunning && getOriginalStartLights(this.countdownTicks).released) {
			this.timerRunning = true;
			this.events.emit("raceStarted");
		}
		if (!this.timerRunning) {
			this.raceAudio.step(this.playerCar.originalPhysics.snapshot(), {}, this.playerCar.originalPhysics.parameters.maxSpeed);
		}
		return this.timerRunning;
	}

	stepOriginalTick() {
		if (!this.stepCountdown()) return;
		this.stepGhost();
		this.stepRacers();
		for (const car of this.cars) car.stepOriginalPhysics();
		resolveOriginalCarContacts(this.cars.map((car) => car.originalPhysics.state));
		for (const car of this.cars) car.originalPhysics.syncTransform();
		updateB2worldStepAndCollisions(this, ORIGINAL_TICK_MS, true);
		for (const car of this.cars) car.syncOriginalPhysics();
		this.raceAudio.step(this.playerCar.originalPhysics.snapshot(), this.playerCar.readControls(), this.playerCar.originalPhysics.parameters.maxSpeed);
		this.updateRaceProgress();
	}

	stepGhost() {
		if (!this.ghost || this.raceOver || this.playerCar.raceProgress.finished) return;
		const frame = getGhostFrame(this.ghost, this.ghostTick++);
		updateGhostSprite(this.ghostSprite, frame);
		this.replayFrames.push(recordReplayFrame(this.playerCar.originalPhysics.snapshot(), this.playerCar.readControls()));
	}

	update(time, delta) {
		const scene = this;
		if (scene.physicsBackend === "original") {
			scene.originalClock.advance(delta, () => scene.stepOriginalTick());
		} else {
			if (scene.timerRunning) updateB2worldStepAndCollisions(scene, delta);
			scene.originalClock.advance(delta, () => {
				if (!scene.stepCountdown()) return;
				scene.stepGhost();
				scene.stepRacers();
				for (const car of scene.cars) car.originalPhysics.stepBoxEffects(car.readControls());
				scene.raceAudio.step(scene.playerCar.originalPhysics.snapshot(), scene.playerCar.readControls(), scene.playerCar.originalPhysics.parameters.maxSpeed);
				scene.updateRaceProgress();
			});
		}
	}
}