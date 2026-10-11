import { playSound } from "../../modules/audio";
import { createCursor } from "../../modules/cursor";
import { createMenuButton } from "../../modules/menu";
import { createOriginalChampionship } from "../../modules/originalRace.js";
import { parseMenuLayout } from "../../formats/mnu.js";
import { formatSaveDate, readSaveSlot, restoreGameState } from "../../modules/saveGame.js";
import { makeClickable } from "../../modules/utils";

const debugging = process.env.DEBUG == "true";

export default class SinglePlayerMenu extends Phaser.Scene {
	constructor () {
		super({
			key: "singlePlayerMenu",
		});
	}

	preload() {
		
	}

	create() {
		const scene = this;
		const bg = scene.add.image(0,0,"SINGLE.FGF").setOrigin(0,0);
		const cursor = createCursor(scene);
		const layout = parseMenuLayout(scene.cache.binary.get("SINGLE.MNU"));
		for (const [slot, position] of layout.textPositions.entries()) {
			let saved = null;
			try { saved = readSaveSlot(window.localStorage, slot); } catch {}
			const stamp = saved ? formatSaveDate(saved.savedAt) : { time: "12:00", date: "01.01" };
			const row = scene.add.bitmapText(position.x, position.y, "systemFont",
				`${(saved?.name ?? "-volna-").padEnd(8)} ${stamp.time} ${stamp.date}`, 8).setOrigin(0, 0).setTint(0x000000).setAlpha(1);
			if (!saved) continue;
			makeClickable(row);
			row.on("pointerover", () => playSound(scene, "MENU.SND-KLIK1", { global: true }));
			row.on("click", () => {
				playSound(scene, "MENU.SND-KLIK2", { global: true });
				restoreGameState(scene.registry, saved);
				scene.scene.start("raceMenu");
			});
		}


		const backButton = createMenuButton(scene,{
			x: 60,
			y: 405,
			texture: "BACK.FSF",
			hoverTextureFrame: 1,
			clickCallback: () => {
				scene.scene.start("mainMenu");
			}
		});

		const selectRaceType = (type) => {
			scene.registry.set("currentRaceType",type);
			scene.registry.set("currentMap", 0);
			scene.registry.set("lastRaceResults", []);
			scene.registry.set("championship", type === "championship"
				? createOriginalChampionship(scene.registry.get("playerTeam") ?? 0) : null);
			scene.registry.set("raceLaps", type === "ghostRace" ? 4 : 12);
			scene.registry.set("raceOpponents", type === "ghostRace" ? 0 : 5);
			scene.scene.start("raceMenu");
		}
		const championshipButton = createMenuButton(scene,{
			x: 53,
			y: 146,
			texture: "CHAMPION.FSF",
			clickCallback: () => {
				selectRaceType("championship");
			}
		});
		const freeRaceButton = createMenuButton(scene,{
			x: 53,
			y: 228,
			texture: "FREE.FSF",
			clickCallback: () => {
				selectRaceType("freeRace");
			}
		});
		const ghostRaceButton = createMenuButton(scene,{
			x: 56,
			y: 310,
			texture: "GHOST.FSF",
			clickCallback: () => {
				selectRaceType("ghostRace");
			}
		});



	}
		
}