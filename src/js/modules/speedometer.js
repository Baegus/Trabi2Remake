export const createSpeedometer = (scene, x, y) => {
	const speedometer = scene.add.image(x, y, "TACHO.FSF", 0).setOrigin(0, 0).setDepth(60);
	const speedDebugText = scene.add.bitmapText(10, y + 60, "systemFont", "0 km/h").setDepth(100);

	const angleOffset = -128;
	const needle = scene.add.rectangle(x + 122, y + 74.5, 1, 51, 0x485048).setOrigin(0.5, 0.68).setDepth(101).setRotation(Phaser.Math.DegToRad(angleOffset));
	const maxSpeedKPH = 149; // in km/h
	const angleRange = 320;

	const lapText = scene.add.bitmapText(x + 22, y + 27, "HUDFontGray", "1/5").setDepth(100);
	const positionText = scene.add.bitmapText(x + 33, y + 109, "HUDFontGray", "1").setDepth(100);

	scene.events.on("playerCarUpdate", (event) => {
		console.log("Player car update:", event);
		const speedKPH = event.speedKPH;
		speedDebugText.setText(`${speedKPH} km/h`);

		// Map speed to needle angle (tune the divisor and offset to match the speedometer design)
		const needleAngle = Phaser.Math.Clamp(speedKPH / maxSpeedKPH * angleRange + angleOffset, -128, 128);
		needle.setRotation(Phaser.Math.DegToRad(needleAngle));
	});

	return speedometer;
}