import { createDamageIndicator } from "../modules/damageIndicator.js";
import { createSpeedometer } from "../modules/speedometer.js";
import { createPauseMenu } from "../modules/pauseMenu.js";
import { createTimers } from "../modules/timers.js";
import { getOriginalPitBay } from "../modules/originalAi.js";
import { getOriginalStartLights } from "../modules/originalRace.js";

const debugging = process.env.DEBUG == "true";

export default class HUD extends Phaser.Scene {
	constructor() {
		super({
			key: "hud",
		});
	}

	create() {
		const scene = this;
		scene.events.once("shutdown", () => {
			for (const event of ["carDamage", "lapCompleted", "hideHUD", "showHUD"]) scene.events.off(event);
		});
		const damageIndicator = createDamageIndicator(scene, 560, 347);
		const speedometer = createSpeedometer(scene, 0, 341);

		const timers = createTimers(scene, 10, 10);
		const lights = scene.add.container(225, 0).setDepth(100);
		const topLights = [];
		const bottomLights = [];
		for (let index = 0; index < 3; index++) {
			topLights.push(scene.add.image(index * 63, 0, "SEMAFOR.FSF", 0).setOrigin(0, 0));
			bottomLights.push(scene.add.image(index * 63, 63, "SEMAFOR.FSF", 0).setOrigin(0, 0));
		}
		lights.add([...topLights, ...bottomLights]);
		const positionImage = scene.add.image(320, 170, "POS.FSF", 0).setDepth(110).setVisible(false);
		const race = scene.scene.get("race");
		const updateLights = () => {
			const state = getOriginalStartLights(race.countdownTicks);
			lights.setY(state.y).setVisible(state.visible);
			topLights.forEach((light, index) => light.setFrame(state.top[index]));
			bottomLights.forEach((light) => light.setFrame(state.bottom));
		};
		const showPosition = (position) => {
			if (position >= 1 && position <= 3) positionImage.setFrame(position - 1).setVisible(true);
		};
		const bay = getOriginalPitBay(race.points.repairDepo, race.playerCar.team);
		const depotArrow = race.add.image((bay.left + bay.right) / 2 + 149, bay.bottom + 77, "SIPKA.FSF", 0)
			.setOrigin(0.5, 1).setDepth(1).setVisible(false);
		const updateArrow = () => {
			const player = race.playerCar?.originalPhysics.snapshot();
			depotArrow.setVisible(!!player && Math.abs(player.x - bay.right) < 600 &&
				player.y > bay.top - 100 && player.y < bay.bottom + 100);
		};
		updateLights();
		scene.events.on("update", updateArrow);
		race.events.on("countdown", updateLights);
		race.events.on("playerFinished", showPosition);
		scene.events.once("shutdown", () => {
			scene.events.off("update", updateArrow);
			race.events.off("countdown", updateLights);
			race.events.off("playerFinished", showPosition);
			depotArrow.destroy();
		});

		const standingsText = scene.add.bitmapText(200, 460, "raceMessageFont", "", 8)
			.setOrigin(0, 0).setDepth(100).setTint(0x000000);
		standingsText.name = "lapStandingsMessage";
		const updateStandings = () => {
			const message = race.standingsMessage;
			if (standingsText.text !== message.text) standingsText.setText(message.text);
			standingsText.setVisible(message.ticks > 0);
		};
		updateStandings();
		scene.events.on("update", updateStandings);
		scene.events.once("shutdown", () => scene.events.off("update", updateStandings));

		const pauseMenu = createPauseMenu(scene);

		scene.events.on("hideHUD", () => {
			scene.scene.setVisible(false);
			scene.scene.pause();
		});

		scene.events.on("showHUD", () => {
			scene.scene.resume();
			scene.scene.setVisible(true);
		});
	}
}