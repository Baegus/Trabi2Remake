import { textToWholePixels } from "../../modules/utils";
import { playSound } from "../../modules/audio";
import { createCursor } from "../../modules/cursor";
import { createMenuButton } from "../../modules/menu";

export default class CarSettingsMenu extends Phaser.Scene {
	constructor () {
		super({
			key: "carSettingsMenu",
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
		const bg = this.add.image(0,0,"CAROPT.FGF").setOrigin(0,0);
		const cursor = createCursor(this);

		const defaultTires = 1;
		const defaultTransmissionValue = 12;
		const defaultBrakesValue = 14;

		// TODO: If game is loaded/in progress, load actual values from registry here:
		let tires = defaultTires;
		let transmission = defaultTransmissionValue;
		let brakes = defaultBrakesValue;
		

		// TIRES SELECTOR:

		const tireThumbnails = this.add.image(366,355,"PNEU.FSF").setOrigin(0,0);
		const totalTires = this.registry.get("totalTires");
		const lastTires = totalTires-1;
		const setTires = (offset=1,forceValue=false) => {
			let selectedTires = tires+offset;
			if (forceValue) selectedTires = offset
			if (selectedTires > lastTires) return;
			if (selectedTires < 0) return;
			tires = selectedTires;
			this.registry.set("currentTires",tires);
			tireThumbnails.setFrame(selectedTires);
		};
		setTires(tires,true);

		const prevTiresButton = createMenuButton(this,{
			x: 332,
			y: 362,
			texture: "SIPKA5.FSF",
			clickCallback: () => {
				setTires(-1);
			}
		});
		const nextTiresButton = createMenuButton(this,{
			x: 420,
			y: 364,
			texture: "SIPKA6.FSF",
			clickCallback: () => {
				setTires(1);
			}
		});



		const okButton = createMenuButton(this,{
			x: 468,
			y: 363,
			texture: "OK.FSF",
			clickCallback: () => {
				this.scene.start("raceMenu");
			}
		});



	}
		
}