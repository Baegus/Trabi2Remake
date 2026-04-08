export const createCar = (scene, x, y, team=0) => {
	const car = scene.add.container(x, y);
	const sides = [
		"topLeft",
		"topRight",
		"bottomLeft",
		"bottomRight"
	];
	sides.forEach((side, index) => {
		const frame = team * 4 + index;
		const carPart = scene.add.image(0, 0, "TRABANT.FSF", frame).setOrigin(0.5, 0.5);
		// Add ~1px overlap on the right and bottom seams to avoid gaps
		switch (side) {
			case "topLeft":
				carPart.setCrop(0, 0, 42, 42);
				break;
			case "topRight":
				carPart.setCrop(40, 0, 40, 42);
				break;
			case "bottomLeft":
				carPart.setCrop(0, 40, 42, 40);
				break;
			case "bottomRight":
				carPart.setCrop(40, 40, 40, 40);
				break;
		}
		car.add(carPart);
		car[side] = carPart;
	});
	car.team = team;
	car.damage = [0, 0, 0, 0]; // topLeft, topRight, bottomLeft, bottomRight
	const dmgToFrame = (n) => {
		const clamped = Math.max(0, Math.min(100, n));
		return Math.min(3, Math.floor(clamped / 25));
	};
	car.updateDamage = function() {
		// damage values are percentages (0-100). Map them to 4 frames (0..3)
		

		this.topLeft.setFrame(this.team * 4 + dmgToFrame(this.damage[0]));
		this.topRight.setFrame(this.team * 4 + dmgToFrame(this.damage[1]));
		this.bottomLeft.setFrame(this.team * 4 + dmgToFrame(this.damage[2]));
		this.bottomRight.setFrame(this.team * 4 + dmgToFrame(this.damage[3]));
	};
	car.updateDamage();
	car.setRotation(Phaser.Math.DegToRad(-90)).setDepth(10);

	// Controls & physics params
	car.turnSpeed = Phaser.Math.DegToRad(90); // radians per second
	car.acceleration = 300; // pixels per second^2
	car.maxSpeed = 800; // pixels per second
	car.drag = 0.98;

	// Use cursor keys so holding works (smoother than keydown handlers)
	const keys = scene.input.keyboard.createCursorKeys();

	// Enable arcade body on the container
	scene.physics.add.existing(car);
	// Give the body a sensible size (tune to your sprite)
	car.body.setSize(72, 32).setOffset(-36, -16);
	// car.body.setCollideWorldBounds(true);

	// Update loop: apply turning and acceleration relative to current rotation
	scene.events.on("update", (time, delta) => {
		const dt = delta / 1000;

		// Smooth turning while key is held
		if (keys.left.isDown) {
			car.rotation -= car.turnSpeed * dt;
		}
		if (keys.right.isDown) {
			car.rotation += car.turnSpeed * dt;
		}

		// Compute forward vector. Subtract PI/2 because sprite rotation baseline is offset (keeps current behavior:
		// with rotation = -90deg the car will move left).
		const moveAngle = car.rotation - Math.PI / 2;
		if (keys.up.isDown) {
			car.body.velocity.x += Math.cos(moveAngle) * car.acceleration * dt;
			car.body.velocity.y += Math.sin(moveAngle) * car.acceleration * dt;
		} else if (keys.down.isDown) {
			// reverse with reduced accel for nicer handling
			car.body.velocity.x -= Math.cos(moveAngle) * (car.acceleration * 0.6) * dt;
			car.body.velocity.y -= Math.sin(moveAngle) * (car.acceleration * 0.6) * dt;
		}

		// Clamp max speed
		const vx = car.body.velocity.x;
		const vy = car.body.velocity.y;
		const speed = Math.hypot(vx, vy);
		if (speed > car.maxSpeed) {
			const scale = car.maxSpeed / speed;
			car.body.velocity.x = vx * scale;
			car.body.velocity.y = vy * scale;
		}

		// Apply simple drag (frame dependent; acceptable for arcade-style feel)
		car.body.velocity.x *= car.drag;
		car.body.velocity.y *= car.drag;
	});

	scene.cameras.main.startFollow(car, true, 0.1, 0.1);

	return car;
}