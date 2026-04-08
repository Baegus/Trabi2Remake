export const createSpeedometer = (scene, x, y) => {
	const speedometer = scene.add.image(x, y, "TACHO.FSF", 0).setOrigin(0, 0).setDepth(60);
	// const speedDebugText = scene.add.bitmapText(10, y + 60, "systemFont", "0 km/h").setDepth(100);

	const angleOffset = -128;
	const needle = scene.add.rectangle(x + 122, y + 74.5, 1, 51, 0x485048).setOrigin(0.5, 0.68).setDepth(101).setRotation(Phaser.Math.DegToRad(angleOffset));
	const maxSpeedKPH = 120; // in km/h
	const angleRange = 256;

	const lapText = scene.add.bitmapText(x + 22, y + 27, "HUDFontGray", "1/5").setDepth(100);
	const positionText = scene.add.bitmapText(x + 33, y + 109, "HUDFontGray", "1").setDepth(100);

	scene.events.on("update", () => {
		const raceScene = scene.scene.get("race");
		if (!raceScene || !raceScene.playerCar) return;
		const playerCar = raceScene.playerCar;
		const SPEED_SCALE = 0.05; // adjust (e.g. 0.5 = half speed)
		const speedKPH = Math.round(Math.sqrt(playerCar.body.velocity.x ** 2 + playerCar.body.velocity.y ** 2) * 3.6 * SPEED_SCALE);
		// speedDebugText.setText(`${speedKPH} km/h`);

		// Map speed to needle angle (tune the divisor and offset to match the speedometer design)
		const needleAngle = Phaser.Math.Clamp(speedKPH / maxSpeedKPH * angleRange + angleOffset, -128, 128);
		needle.setRotation(Phaser.Math.DegToRad(needleAngle));
	});

	return speedometer;
}