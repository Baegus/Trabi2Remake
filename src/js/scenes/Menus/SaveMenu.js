import { playSound } from "../../modules/audio";
import { createCursor } from "../../modules/cursor";
import { createMenuButton } from "../../modules/menu";
import { createTextInput } from "../../modules/textInput";
import { parseMenuLayout } from "../../formats/mnu.js";
import { formatSaveDate, readSaveSlot, writeSaveSlot } from "../../modules/saveGame.js";

const debugging = process.env.DEBUG == "true";

export default class SaveMenu extends Phaser.Scene {
	constructor() {
		super({
			key: "saveMenu",
		});
	}

	preload() {

	}

	create() {
		const scene = this;

		const bg = scene.add.image(0, 0, "SAVE.FGF").setOrigin(0, 0);
		const cursor = createCursor(scene);
		const layout = parseMenuLayout(scene.cache.binary.get("SAVE.MNU"));
		const errorText = scene.add.bitmapText(226, 140, "systemFont", "").setOrigin(0, 0).setTint(0x000000);

		for (const [slot, position] of layout.inputs.entries()) {
			let saved = null;
			try { saved = readSaveSlot(window.localStorage, slot); } catch {}
			const stamp = saved ? formatSaveDate(saved.savedAt) : { time: "12:00", date: "01.01" };
			const y = position.y;
			const positionNameInput = createTextInput(scene, {
				x: position.x,
				y,
				text: saved?.name ?? "-volna-",
				zoneWidth: 64,
				maxLength: position.maxLength,
				changeCallback: (value) => {
					if (!value.trim()) return;
					try {
						writeSaveSlot(window.localStorage, slot, value, scene.registry);
						scene.scene.start("raceMenu");
					} catch (error) {
						errorText.setText("Ulozeni se nezdarilo");
						console.warn("Saving failed", error);
					}
				}
			});
			positionNameInput.setTint(0x000000).setAlpha(1);
			scene.add.bitmapText(layout.textPositions[slot].x, y, "systemFont", stamp.time).setOrigin(0, 0).setTint(0x000000);
			scene.add.bitmapText(353, y, "systemFont", stamp.date).setOrigin(0, 0).setTint(0x000000);
		}

		const backButton = createMenuButton(scene, {
			x: 57,
			y: 369,
			texture: "BACK3.FSF",
			clickCallback: () => {
				scene.scene.start("raceMenu");
			}
		});
	}

}