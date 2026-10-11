import { parseMenuLayout } from "../../formats/mnu.js";
import { createCursor } from "../../modules/cursor.js";
import { createMenuButton } from "../../modules/menu.js";
import { getOriginalGridSlots, ORIGINAL_RACERS, ORIGINAL_TRACK_NAMES } from "../../modules/originalRace.js";

export default class RaceResultsMenu extends Phaser.Scene {
	constructor() {
		super({ key: "raceResultsMenu" });
	}

	init({ results, nextScene = "raceMenu" } = {}) {
		this.results = results ?? this.registry.get("sessionResults");
		this.nextScene = nextScene;
	}

	create() {
		const layout = parseMenuLayout(this.cache.binary.get("KLASIF.MNU"));
		this.add.image(0, 0, layout.background).setOrigin(0, 0);
		const playerTeam = this.registry.get("playerTeam") ?? 0;
		const results = this.results?.length ? this.results : getOriginalGridSlots([0, 1, 2, 3, 4, 5], playerTeam, [], true)
			.map((team, index) => ({ team, position: index + 1, finishTime: null }));
		const title = layout.textPositions[0];
		const header = layout.textPositions[1];
		this.add.bitmapText(title.x, title.y, "systemFont", this.registry.get("sessionTitle") ??
			`${ORIGINAL_TRACK_NAMES[this.registry.get("currentMap") ?? 0]} - zavod`, 8).setTint(0x000000);
		this.add.bitmapText(header.x, header.y, "systemFont", "c.   jezdec          cas", 8).setTint(0x000000);
		this.rows = results.map((result, index) => {
			const position = layout.textPositions[index + 2];
			const row = this.add.container(position.x, position.y);
			row.add(this.add.bitmapText(0, 0, "systemFont", String(result.position ?? index + 1).padStart(2, "0"), 8).setTint(0x000000));
			const racer = ORIGINAL_RACERS[result.team];
			const driver = result.team === playerTeam ? this.registry.get("playerName") || "Novy hrac" : racer.name;
			const name = this.add.bitmapText(32, 0, "systemFont", `${String(racer.number).padStart(2, "0")} - ${driver}`, 8).setTint(0x000000);
			row.add(name);
			const seconds = Math.floor(result.finishTime / 1000);
			const time = this.add.bitmapText(168, 0, "systemFont", Number.isFinite(result.finishTime)
				? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}` : "-----", 8).setTint(0x000000);
			row.add(time);
			return row;
		});
		const continueToMenu = () => this.scene.start(this.nextScene);
		const button = layout.buttons[0];
		createMenuButton(this, { ...button, clickCallback: continueToMenu });
		createCursor(this);
		this.input.keyboard.on("keydown-ENTER", continueToMenu);
		this.input.keyboard.on("keydown-ESC", continueToMenu);
		this.events.once("shutdown", () => {
			this.input.keyboard.off("keydown-ENTER", continueToMenu);
			this.input.keyboard.off("keydown-ESC", continueToMenu);
		});
	}
}