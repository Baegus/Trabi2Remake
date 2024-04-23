import { textToWholePixels } from "../../modules/utils";
import { playSound } from "../../modules/audio";
import { createCursor } from "../../modules/cursor";
import { createMenuButton } from "../../modules/menu";

export default class SinglePlayerMenu extends Phaser.Scene {
	constructor () {
		super({
			key: "singlePlayerMenu",
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
		
	}

	create() {
		this.events.off();
		const bg = this.add.image(0,0,"SINGLE.FGF").setOrigin(0,0);
		const cursor = createCursor(this);


		const backButton = createMenuButton(this,{
			x: 60,
			y: 405,
			texture: "BACK.FSF",
			hoverTextureFrame: 1,
			clickCallback: () => {
				this.scene.start("mainMenu");
			}
		});

		const selectRaceType = (type) => {
			this.registry.set("currentRaceType",type);
			this.scene.start("raceMenu");
		}
		const championshipButton = createMenuButton(this,{
			x: 53,
			y: 146,
			texture: "CHAMPION.FSF",
			clickCallback: () => {
				selectRaceType("championship");
			}
		});
		const freeRaceButton = createMenuButton(this,{
			x: 53,
			y: 228,
			texture: "FREE.FSF",
			clickCallback: () => {
				selectRaceType("freeRace");
			}
		});
		const ghostRaceButton = createMenuButton(this,{
			x: 56,
			y: 310,
			texture: "GHOST.FSF",
			clickCallback: () => {
				selectRaceType("ghostRace");
			}
		});



	}
		
}