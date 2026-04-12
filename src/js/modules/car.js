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
import { assignB2BodyBox } from "../modules/box2dUtils.js";

const clampTransmission = (v) => Phaser.Math.Clamp(v, 0, 21);

// =============================================================================
// PHYSICS CONVERSION CONSTANTS
// =============================================================================
// Derived from original game measurements (see physicsMeasurements.md):
//   - At top speed, car travels ~2.306 * kph pixels per 30 frames at 60fps
//   - pxPerSec = 2.306 * kph * 2 = 4.612 * kph
//   - Box2D world uses PTM_RATIO = 30 (30 pixels = 1 meter)
//   - worldSpeed = pxPerSec / 30 = 0.1537 * kph
const KPH_TO_WORLD = 0.1537;
const WORLD_TO_KPH = 1 / KPH_TO_WORLD;
const MAX_REVERSE_KPH = 26;
const REVERSE_ACCEL = 5.0;
const MIN_STOP_VELOCITY = 0.5;

// Convert kph to Box2D world speed (meters/second)
const kphToWorldSpeed = (kph) => KPH_TO_WORLD * kph;

// Convert Box2D world speed to kph
const worldSpeedToKph = (worldSpeed) => WORLD_TO_KPH * worldSpeed;

// =============================================================================
// TRANSMISSION PROFILE - Simple fitted functions
// =============================================================================
// All formulas derived from linear/quadratic regression on original game data:
//   topKph = 2.6 * T + 91                    (max error ~0.6 kph)
//   a1 (low-speed accel) ≈ 30 kph/s          (0-20 kph phase, fairly constant)
//   a2 (mid-speed accel) = 54 - 0.83 * T     (kph/s, 20-40 kph phase)
//   a3 (high-speed accel) = 26 - 0.64 * T    (kph/s, for v > 40 kph)

const buildTransmissionProfile = (transmissionVal) => {
	const T = clampTransmission(transmissionVal);

	// Top speed: linear fit from measured data
	const topKph = 2.6 * T + 91;
	const maxSpeedWorld = kphToWorldSpeed(topKph);

	// 3-phase acceleration model (simulates gear behavior from original game):
	// Phase 1 (0-20 kph):  ~30 kph/s - initial acceleration (fairly constant)
	// Phase 2 (20-40 kph): decreases with T, from ~54 to ~37 kph/s
	// Phase 3 (40+ kph):   decreases with T, from ~26 to ~12 kph/s
	const a1_kph = 30;
	const a2_kph = 54 - 0.83 * T;
	const a3_kph = 26 - 0.64 * T;

	// Convert accelerations to world units (m/s²)
	const a1_world = KPH_TO_WORLD * a1_kph;
	const a2_world = KPH_TO_WORLD * a2_kph;
	const a3_world = KPH_TO_WORLD * a3_kph;

	// Speed thresholds in world units
	const v1_world = kphToWorldSpeed(20);
	const v2_world = kphToWorldSpeed(40);

	const accelAtWorldSpeed = (worldSpeed) => {
		if (worldSpeed <= 0) return a1_world;
		if (worldSpeed >= maxSpeedWorld) return 0;

		if (worldSpeed < v1_world) {
			// Phase 1: constant acceleration
			return a1_world;
		} else if (worldSpeed < v2_world) {
			// Phase 2: higher constant acceleration
			return a2_world;
		} else {
			// Phase 3: constant acceleration until top speed
			// Stop just before top speed to avoid overshoot
			const remaining = maxSpeedWorld - worldSpeed;
			if (remaining < 0.5) {
				return a3_world * (remaining / 0.5);
			}
			return a3_world;
		}
	};

	return {
		T,
		topKph,
		maxSpeedWorld,
		accelAtWorldSpeed
	};
};

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
	const transmission = scene.registry.get("transmissionVal") ?? 0;
	const brakesVal = scene.registry.get("brakesVal") ?? 0;
	// TODO - figure out how tire types affect handling and implement here

	const transmissionProfile = buildTransmissionProfile(transmission);
	const maxSpeedKph = transmissionProfile.maxSpeedKph;
	const maxSpeedMps = transmissionProfile.maxSpeedMps;

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
		const vWorld = Math.abs(forwardVelocityMag);
		const throttleAccel = transmissionProfile.accelAtWorldSpeed(vWorld);
		const driveForceMag = mass * throttleAccel;

		let forceMag = 0;
		const brakeForceMag = mass * brakeDecelMs2;

		if (isAccelerating) {
			if (forwardVelocityMag < -1) {
				forceMag = brakeForceMag;
			} else {
				forceMag = driveForceMag;
			}
		} else if (isBraking) {
			if (forwardVelocityMag > 1) {
				forceMag = -brakeForceMag;
			} else {
				
				const maxReverseSpeed = kphToWorldSpeed(MAX_REVERSE_KPH);
				let reverseForce = -mass * REVERSE_ACCEL;

				if (vWorld > maxReverseSpeed - 0.5) {
					const drop = Math.max(0, (maxReverseSpeed - vWorld) / 0.5);
					reverseForce *= drop;
				}
				if (vWorld >= maxReverseSpeed) {
					reverseForce = 0;
				}
				forceMag = reverseForce;
			}
		} else {
			// coast / engine braking
			if (Math.abs(forwardVelocityMag) > 0.5) {
				forceMag = -mass * Math.sign(forwardVelocityMag);
			}
		}

		// Optional overspeed pullback if collision/downhill pushes past top speed while throttling
		const overspeed = Math.max(0, vWorld - transmissionProfile.maxSpeedWorld);
		if (overspeed > 0) {
			forceMag -= mass * Math.min(overspeed * 8.0, 20.0) * Math.sign(forwardVelocityMag || 1);
		}

		const forwardForce = new b2Vec2(forward.x * forceMag, forward.y * forceMag);
		b2Body_ApplyForceToCenter(bodyId, forwardForce, true);

		// Steering & Angular Torque
		const currentAngularVel = b2Body_GetAngularVelocity(bodyId);
		const turningFactor = Math.min(Math.abs(forwardVelocityMag) / 2, 1); // Limits static turning
		const baseSteerSpeed = 2.1; // rad/s - seems to match pretty wall with transmissionVal 0 and tires 1

		// Invert steering visually when moving backwards
		const desiredAngularVel = steerInput * baseSteerSpeed * turningFactor * Math.sign(forwardVelocityMag || 1);

		// Blend safely to the desired angle over time to prevent unnatural snapping
		const angularVelDiff = desiredAngularVel - currentAngularVel;
		b2Body_SetAngularVelocity(bodyId, currentAngularVel + angularVelDiff * 10 * dt);

		

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

		if (!isAccelerating && !isBraking && steerInput === 0 && Math.abs(forwardVelocityMag) < MIN_STOP_VELOCITY && Math.abs(lateralVelocityMag) < MIN_STOP_VELOCITY) {
			b2Body_SetLinearVelocity(bodyId, new b2Vec2(0, 0));
			b2Body_SetAngularVelocity(bodyId, 0);
		}

		if (hudScene && isPlayer) {
			const currentSpeedWorld = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
			const kph = worldSpeedToKph(currentSpeedWorld);
			hudScene.events.emit("playerCarUpdate", { speedKPH: Math.round(kph) });
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