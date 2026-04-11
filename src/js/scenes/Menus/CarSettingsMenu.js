import { playSound } from "../../modules/audio";
import { createCursor } from "../../modules/cursor";
import { createMenuButton } from "../../modules/menu";
import { createSlider } from "../../modules/sliders";

const debugging = process.env.DEBUG == "true";

export default class CarSettingsMenu extends Phaser.Scene {
	constructor () {
		super({
			key: "carSettingsMenu",
		});
	}

	preload() {
		
	}

	create() {
		const scene = this;
		scene.events.off();
		const bg = scene.add.image(0,0,"CAROPT.FGF").setOrigin(0,0);
		const cursor = createCursor(scene);

		let tires = scene.registry.get("currentTires");
		let transmission = scene.registry.get("transmissionVal");
		let brakes = scene.registry.get("brakesVal");

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

		const maxSpeedText = scene.add.bitmapText(132, 216, "systemFont").setOrigin(0, 0);
		const zeroTo60Text = scene.add.bitmapText(132, 245, "systemFont").setOrigin(0, 0);
		const zeroTo120Text = scene.add.bitmapText(133, 275, "systemFont").setOrigin(0, 0);

		function updateTransmissionStats() {
			const stats = getTransmissionStats(transmission);
			maxSpeedText.setText(stats.maxSpeed);
			zeroTo60Text.setText(stats.zeroTo60);
			zeroTo120Text.setText(stats.zeroTo120);
		}
		updateTransmissionStats();


		const transmissionSlider = createSlider(scene, {
			xStart: 67,
			xEnd: 277,
			y: 118,
			texture: "POSUV1.FSF",
			steps: 21,
			value: scene.registry.get("transmissionVal"),
			changeCallback: (value) => {
				transmission = value;
				scene.registry.set("transmissionVal", transmission);
				updateTransmissionStats();
			},
		});

		const brakesSlider = createSlider(scene, {
			xStart: 380,
			xEnd: 590,
			y: 118,
			texture: "POSUV2.FSF",
			steps: 21,
			value: scene.registry.get("brakesVal"),
			changeCallback: (value) => {
				brakes = value;
				scene.registry.set("brakesVal", brakes);
			},
		});


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