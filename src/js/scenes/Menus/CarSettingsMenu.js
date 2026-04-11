import { playSound } from "../../modules/audio";
import { createCursor } from "../../modules/cursor";
import { createMenuButton } from "../../modules/menu";

const debugging = process.env.DEBUG == "true";

export default class CarSettingsMenu extends Phaser.Scene {
	constructor () {
		super({
			key: "carSettingsMenu",
			maxLights: 30,
		});
	}

	preload() {
		
	}

	create() {
		const scene = this;
		scene.events.off();
		const bg = scene.add.image(0,0,"CAROPT.FGF").setOrigin(0,0);
		const cursor = createCursor(scene);

		const defaultTires = 1;
		const defaultTransmissionValue = 12;
		const defaultBrakesValue = 14;

		// TODO: If game is loaded/in progress, load actual values from registry here:
		let tires = defaultTires;
		let transmission = defaultTransmissionValue;
		let brakes = defaultBrakesValue;


		// Both Transmission and Brakes sliders have 22 steps (0-21)

		function getTransmissionStats(t) {
			// Ensure t is within bounds
			t = Math.max(0, Math.min(21, Math.floor(t)));

			// Top Speed Equation
			// Using 2.6 maintains the 3-2-3-2-3-3 pattern perfectly.
			const maxSpeed = 91 + Math.round(t * 2.6);

			// 0-60 Acceleration (Step logic)
			// These steps are non-linear (likely hand-tuned)
			let zeroTo60;
			if (t <= 2) zeroTo60 = 4;
			else if (t <= 10) zeroTo60 = 5;
			else if (t <= 15) zeroTo60 = 6;
			else if (t <= 19) zeroTo60 = 7;
			else zeroTo60 = 8;

			// 0-120 Acceleration (Step logic)
			let zeroTo120 = "---";
			if (t >= 11) {
				const z120Values = [18, 18, 19, 19, 20, 21, 21, 22, 23, 24, 25];
				zeroTo120 = z120Values[t - 11] + "s";
			}

			return {
				index: t,
				maxSpeed: maxSpeed,
				zeroTo60: zeroTo60 + "s",
				zeroTo120: zeroTo120
			};
		}


		// TIRES SELECTOR:

		const tireThumbnails = scene.add.image(366,355,"PNEU.FSF").setOrigin(0,0);
		const totalTires = scene.registry.get("totalTires");
		const lastTires = totalTires-1;
		const setTires = (offset=1,forceValue=false) => {
			let selectedTires = tires+offset;
			if (forceValue) selectedTires = offset
			if (selectedTires > lastTires) return;
			if (selectedTires < 0) return;
			tires = selectedTires;
			scene.registry.set("currentTires",tires);
			tireThumbnails.setFrame(selectedTires);
		};
		setTires(tires,true);

		const prevTiresButton = createMenuButton(scene,{
			x: 332,
			y: 362,
			texture: "SIPKA5.FSF",
			clickCallback: () => {
				setTires(-1);
			}
		});
		const nextTiresButton = createMenuButton(scene,{
			x: 420,
			y: 364,
			texture: "SIPKA6.FSF",
			clickCallback: () => {
				setTires(1);
			}
		});



		const okButton = createMenuButton(scene,{
			x: 468,
			y: 363,
			texture: "OK.FSF",
			clickCallback: () => {
				scene.scene.start("raceMenu");
			}
		});



	}
		
}