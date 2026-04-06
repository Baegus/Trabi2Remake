import { createDamageIndicator } from "../modules/damageIndicator.js";
import { createSpeedometer } from "../modules/speedometer.js";

export default class HUD extends Phaser.Scene {
	constructor() {
		super({
			key: "hud",
		});
	}

	create() {
		const scene = this;
		const damageIndicator = createDamageIndicator(scene, 560, 348);
		const speedometer = createSpeedometer(scene, 0, 341);
	}
}