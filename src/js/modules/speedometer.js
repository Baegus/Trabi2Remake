export const createSpeedometer = (scene, x, y) => {
	const speedometer = scene.add.image(x, y, "TACHO.FSF", 0).setOrigin(0, 0).setDepth(100);
	const speedDebugText = scene.add.bitmapText(10, y + 60, "systemFont", "0 km/h").setDepth(100);

	scene.events.on("update", () => {
		const raceScene = scene.scene.get("race");
		if (!raceScene || !raceScene.playerCar) return;
		const playerCar = raceScene.playerCar;
		const SPEED_SCALE = 0.05; // adjust (e.g. 0.5 = half speed)
		const speedKPH = Math.round(Math.sqrt(playerCar.body.velocity.x ** 2 + playerCar.body.velocity.y ** 2) * 3.6 * SPEED_SCALE);
		speedDebugText.setText(`${speedKPH} km/h`);
	});

	return speedometer;
}