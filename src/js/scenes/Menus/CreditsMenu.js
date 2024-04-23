import { textToWholePixels } from "../../modules/utils";
import { playSound } from "../../modules/audio";
import { createCursor } from "../../modules/cursor";
import { createMenuButton } from "../../modules/menu";

export default class CreditsMenu extends Phaser.Scene {
	constructor () {
		super({
			key: "creditsMenu",
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
		const bg = this.add.image(0,0,"CREDITS.FGF").setOrigin(0,0);
		const cursor = createCursor(this);


		const okButton = createMenuButton(this,{
			x: 511,
			y: 392,
			texture: "OK5.FSF",
			clickCallback: () => {
				this.scene.start("mainMenu");
			}
		});

		const remakeCredits = this.add.image(272,406,"remakeCredits").setOrigin(0,0).setDepth(10);
	}
		
}