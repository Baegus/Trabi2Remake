import {
	DYNAMIC,
	b2Body_ApplyForceToCenter,
	b2Body_ApplyLinearImpulseToCenter,
	b2Body_GetAngularVelocity,
	b2Body_GetLinearVelocity,
	b2Body_GetMass,
	b2Body_GetRotation,
	b2Body_IsValid,
	b2Body_SetAngularVelocity,
	b2Body_SetLinearVelocity,
	b2Vec2,
	pxm
} from "phaser-box2d/dist/PhaserBox2D.js";
import { assignB2BodyBox, assignB2BodyCircle, createB2World, updateB2worldStepAndCollisions } from "../modules/box2dUtils.js";

export const createCar = (scene, x, y, team = 0, isPlayer = false) => {
	const car = scene.add.container(x, y);
	car.name = `car${team}`;

	const hudScene = scene.scene.get("hud");

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

	car.updateDamage = function () {
		// damage values are percentages (0-100). Map them to 4 frames (0..3)
		this.topLeft.setFrame(this.team * 4 + dmgToFrame(this.damage[0]));
		this.topRight.setFrame(this.team * 4 + dmgToFrame(this.damage[1]));
		this.bottomLeft.setFrame(this.team * 4 + dmgToFrame(this.damage[2]));
		this.bottomRight.setFrame(this.team * 4 + dmgToFrame(this.damage[3]));
		hudScene.events.emit("carDamage", { damageState: this.damage });
	};
	car.updateDamage();

	car.setRotation(Phaser.Math.DegToRad(-90)).setDepth(10);

	// Controls & physics params
	car.width = 32;
	car.height = 72;

	// linearDamping: 0 so we can manually control top speed with dynamic drag
	assignB2BodyBox(car, {
		type: DYNAMIC,
		fixedRotation: false,
		linearDamping: 0,
		angularDamping: 3.0
	});

	const cursors = scene.input.keyboard.createCursorKeys();
	const keys = scene.input.keyboard.addKeys({
		W: Phaser.Input.Keyboard.KeyCodes.W,
		A: Phaser.Input.Keyboard.KeyCodes.A,
		S: Phaser.Input.Keyboard.KeyCodes.S,
		D: Phaser.Input.Keyboard.KeyCodes.D,
		SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE
	});

	// Load variables from registry with defaults
	const transmission = scene.registry.get("transmissionVal") ?? 12; // TODO set this in CarSettingsMenu
	const brakesVal = scene.registry.get("brakesVal") ?? 14;  // TODO set this in CarSettingsMenu
	// TODO - figure out how tire types affect handling and implement here

	// Scale multipliers mapping config to arcade game logic
	const maxSpeedKph = 91 + Math.round(transmission * 2.6);
	const speedConversion = 91 / 30; // 30m/s (900px/s or 15px/frame) = 91 kph
	const maxSpeedMs = maxSpeedKph / speedConversion;

	let zeroTo60;
	if (transmission <= 2) zeroTo60 = 4;
	else if (transmission <= 10) zeroTo60 = 5;
	else if (transmission <= 15) zeroTo60 = 6;
	else if (transmission <= 19) zeroTo60 = 7;
	else zeroTo60 = 8;

	const accelMs2 = 60 / zeroTo60;

	const brakeDecelMs2 = (10 + (brakesVal / 21) * 15) * 2.0;
	const maxLateralAccel = 25 * 2.0;



	// Vehicle Control Update loop
	car.updateRef = (time, delta) => {
		if (!car.body || !b2Body_IsValid(car.body.bodyId)) return;
		const bodyId = car.body.bodyId;
		const dt = Math.min(delta / 1000, 0.1);
		if (dt === 0) return;

		const velocity = b2Body_GetLinearVelocity(bodyId);
		const rot = b2Body_GetRotation(bodyId);

		const forward = { x: -rot.s, y: rot.c };
		const right = { x: rot.c, y: rot.s };

		const mass = b2Body_GetMass(bodyId);

		const forwardVelocityMag = velocity.x * forward.x + velocity.y * forward.y;
		const lateralVelocityMag = velocity.x * right.x + velocity.y * right.y;

		// Input evaluation
		const isAccelerating = cursors.up.isDown || keys.W.isDown;
		const isBraking = cursors.down.isDown || keys.S.isDown;
		const steerInput = (cursors.left.isDown || keys.A.isDown ? 1 : 0) + (cursors.right.isDown || keys.D.isDown ? -1 : 0);

		// Stop micro-gliding at rest if no inputs are pressed
		if (!isAccelerating && !isBraking && steerInput === 0 && Math.abs(forwardVelocityMag) < 0.2 && Math.abs(lateralVelocityMag) < 0.2) {
			b2Body_SetLinearVelocity(bodyId, new b2Vec2(0, 0));
			b2Body_SetAngularVelocity(bodyId, 0);
			return;
		}

		// Lateral Friction (Tire Grip & Handbrake drifting)
		let currentMaxLateralAccel = maxLateralAccel;
		if (cursors.space.isDown || keys.SPACE.isDown) {
			currentMaxLateralAccel = 4; // Handbrake drift logic
		}
		const maxImpulse = mass * currentMaxLateralAccel * dt;
		let lateralImpulseMag = -mass * lateralVelocityMag;
		lateralImpulseMag = Math.max(-maxImpulse, Math.min(maxImpulse, lateralImpulseMag)); // Clamp exactly to grip limit

		const lateralImpulse = new b2Vec2(right.x * lateralImpulseMag, right.y * lateralImpulseMag);
		b2Body_ApplyLinearImpulseToCenter(bodyId, lateralImpulse, true);

		// Engine Force (Forward/Reverse/Brake)
		let forceMag = 0;
		const forwardForceMag = mass * accelMs2;
		const brakeForceMag = mass * brakeDecelMs2;

		if (isAccelerating) {
			if (forwardVelocityMag < -1) {
				forceMag = brakeForceMag; // Braking while in reverse
			} else {
				forceMag = forwardForceMag;
			}
		} else if (isBraking) {
			if (forwardVelocityMag > 1) {
				forceMag = -brakeForceMag; // Conventional braking
			} else {
				forceMag = -forwardForceMag * 0.6; // Reversing limits torque
			}
		} else {
			if (Math.abs(forwardVelocityMag) > 0.5) {
				forceMag = -mass * 2.0 * Math.sign(forwardVelocityMag); // Engine braking / friction
			}
		}

		// Calculate drag consistently based on the car's intended maximum speed capability
		const theoreticalForwardForce = mass * accelMs2;
		const dragCoefficient = theoreticalForwardForce / maxSpeedMs;
		const dragForceMag = -dragCoefficient * forwardVelocityMag;

		const totalForwardForce = forceMag + dragForceMag;
		const forwardForce = new b2Vec2(forward.x * totalForwardForce, forward.y * totalForwardForce);
		b2Body_ApplyForceToCenter(bodyId, forwardForce, true);

		// Steering & Angular Torque
		const currentAngularVel = b2Body_GetAngularVelocity(bodyId);
		const turningFactor = Math.min(Math.abs(forwardVelocityMag) / 2, 1); // Limits static turning
		const baseSteerSpeed = 1.5; // rad/s

		// Invert steering visually when moving backwards
		const desiredAngularVel = steerInput * baseSteerSpeed * turningFactor * Math.sign(forwardVelocityMag || 1);

		// Blend safely to the desired angle over time to prevent unnatural snapping
		const angularVelDiff = desiredAngularVel - currentAngularVel;
		b2Body_SetAngularVelocity(bodyId, currentAngularVel + angularVelDiff * 10 * dt);

		if (hudScene && isPlayer) {
			const currentSpeedMps = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
			hudScene.events.emit("playerCarUpdate", { speedKPH: Math.round(currentSpeedMps * speedConversion) });
		}

		// Damage calculation based on sudden velocity changes (impacts)
		const lastVel = car.lastVelocity || { x: velocity.x, y: velocity.y };
		const dvx = velocity.x - lastVel.x;
		const dvy = velocity.y - lastVel.y;
		const impactMag = Math.sqrt(dvx * dvx + dvy * dvy);
		
		// Threshold for taking damage
		if (impactMag > 2) {
			// The change in velocity is away from the impact point, so the hit directed -dv
			const hitDirX = -dvx;
			const hitDirY = -dvy;
			
			// Localize the hit direction using the forward and right vectors
			const localHitX = hitDirX * right.x + hitDirY * right.y;
			const localHitY = hitDirX * forward.x + hitDirY * forward.y;
			
			// Determine quadrant
			let quadIndex = 0;
			if (localHitX < 0 && localHitY > 0) quadIndex = 0; // topLeft
			else if (localHitX >= 0 && localHitY > 0) quadIndex = 1; // topRight
			else if (localHitX < 0 && localHitY <= 0) quadIndex = 2; // bottomLeft
			else if (localHitX >= 0 && localHitY <= 0) quadIndex = 3; // bottomRight
			
			// Apply damage based on impact magnitude
			car.damage[quadIndex] += impactMag * 2; // Adjust multiplier as needed
			if (car.damage[quadIndex] > 100) car.damage[quadIndex] = 100;
			car.updateDamage();
		}
		
		car.lastVelocity = { x: velocity.x, y: velocity.y };
	};

	scene.events.on("update", car.updateRef);
	car.on("destroy", () => {
		scene.events.off("update", car.updateRef);
	});

	if (isPlayer) {
		const dynamic = scene.registry.get("dynamicScreenEnabled");
		const lerpX = dynamic ? 0.1 : 1;
		const lerpY = dynamic ? 0.1 : 1;
		scene.cameras.main.startFollow(car, false, lerpX, lerpY);
	}
	return car;
}