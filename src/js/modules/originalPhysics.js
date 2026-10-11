import { readPascalReal48 } from "./carParams.js";

export const ORIGINAL_TICK_RATE = 60;
export const ORIGINAL_TICK_MS = 1000 / ORIGINAL_TICK_RATE;
export const ORIGINAL_SPEED_TO_KPH = 13;

const single = Math.fround;
const clampSetting = (value, maximum) => Math.max(0, Math.min(maximum, Math.trunc(value)));
const wrapAngle = (angle) => single(((angle % 360) + 360) % 360);

export function roundOriginal(value) {
	const lower = Math.floor(value);
	const fraction = value - lower;
	return fraction < 0.5 || (fraction === 0.5 && lower % 2 === 0) ? lower : lower + 1;
}

export function getOriginalDamageFrame(percent) {
	return roundOriginal(Math.max(0, Math.min(3, single(percent * 3 / 100))));
}

export function getOriginalSurfaceType(tileIndex, maskedOffroad = false) {
	if (tileIndex >= 87 && tileIndex <= 98) return 3;
	if (tileIndex < 0 || [0, 2, 31, 44, 54, 57].includes(tileIndex) || maskedOffroad) return 1;
	return 0;
}

export function createOriginalParameters(data, { transmission = 10, brakes = 10, tires = 1 } = {}) {
	const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
	if (!bytes || bytes.length < 25) throw new Error("Original physics requires a 25-byte PAR record");
	const transmissionSetting = clampSetting(transmission, 21);
	const brakeSetting = clampSetting(brakes, 21);
	const tireSetting = clampSetting(tires, 2);
	return {
		maxSpeed: readPascalReal48(bytes, 0) + (transmissionSetting - 10) / 5,
		acceleration: readPascalReal48(bytes, 6) + (10 - transmissionSetting) * 0.003,
		braking: readPascalReal48(bytes, 12) + (10 - brakeSetting) / 1000,
		spin: bytes[18] + (1 - tireSetting) * 2,
		handbrakeThreshold: readPascalReal48(bytes, 19) + [-0.2, 0, 0.5][tireSetting]
	};
}

export function createOriginalState({ x = 0, y = 0, heading = 0, speed = 0 } = {}) {
	return {
		x: single(x), y: single(y), speed: single(speed),
		heading: wrapAngle(heading), travelAngle: wrapAngle(heading),
		steering: single(0.3), spinVelocity: 0, spinBase: 0,
		turnDistance: 0, turningLeft: false, accelerationModifier: 0,
		blockedLeft: false, blockedRight: false, damage: [0, 0, 0, 0], gearShiftTicks: 0, pitTicks: 0, pitServiced: false, ticks: 0
	};
}

export function getOriginalWheelPositions(state) {
	return [180 - 28.6105, 180 + 28.6105, 28.6105, -28.6105].map((offset) => {
		const radians = (state.heading + offset) * Math.PI / 180;
		return {
			x: roundOriginal(state.x - Math.sin(radians) * 25.0599),
			y: roundOriginal(state.y - Math.cos(radians) * 25.0599)
		};
	});
}

export function getOriginalCarCorners(state) {
	return [25.2011, -25.2011, 180 - 25.2011, 180 + 25.2011].map((offset) => {
		const radians = (state.heading + offset) * Math.PI / 180;
		return {
			x: roundOriginal(state.x - Math.sin(radians) * 37.5766),
			y: roundOriginal(state.y - Math.cos(radians) * 37.5766)
		};
	});
}

export function resolveOriginalCarContacts(states) {
	const contacts = states.map(() => new Set());
	const axesFor = (state) => {
		const angle = state.heading * Math.PI / 180;
		return [{ x: Math.cos(angle), y: -Math.sin(angle) }, { x: -Math.sin(angle), y: -Math.cos(angle) }];
	};
	for (let iteration = 0; iteration < states.length; iteration++) {
		for (let first = 0; first < states.length; first++) {
			for (let second = first + 1; second < states.length; second++) {
				const firstCar = states[first];
				const secondCar = states[second];
				if (Math.hypot(firstCar.x - secondCar.x, firstCar.y - secondCar.y) > 76) continue;
				const firstCorners = getOriginalCarCorners(firstCar);
				const secondCorners = getOriginalCarCorners(secondCar);
				let penetration = Infinity;
				let normal = null;
				for (const axis of [...axesFor(firstCar), ...axesFor(secondCar)]) {
					const project = (point) => point.x * axis.x + point.y * axis.y;
					const firstProjection = firstCorners.map(project);
					const secondProjection = secondCorners.map(project);
					const overlap = Math.min(Math.max(...firstProjection), Math.max(...secondProjection)) -
						Math.max(Math.min(...firstProjection), Math.min(...secondProjection));
					if (overlap <= 0) { normal = null; break; }
					if (overlap < penetration) {
						penetration = overlap;
						normal = axis;
					}
				}
				if (!normal) continue;
				const orientation = (secondCar.x - firstCar.x) * normal.x + (secondCar.y - firstCar.y) * normal.y < 0 ? -1 : 1;
				for (const [index, otherIndex] of [[first, second], [second, first]]) {
					const car = states[index];
					const other = states[otherIndex];
					if (!contacts[index].has(otherIndex) && !car.carContacts?.has(otherIndex)) {
						const [lateral, forward] = axesFor(car);
						const delta = { x: other.x - car.x, y: other.y - car.y };
						const front = delta.x * forward.x + delta.y * forward.y >= 0;
						const left = delta.x * lateral.x + delta.y * lateral.y < 0;
						const corner = (front ? 0 : 2) + (left ? 0 : 1);
						const difference = Math.abs((other.heading - car.heading + 540) % 360 - 180);
						if (difference <= 45) {
							const impact = 45 - Math.max(10, roundOriginal(difference));
							car.speed = single(car.speed + (front ? -impact / 40 : impact / 90));
							car.damage[corner] = single(Math.min(3, car.damage[corner] + impact / 540));
						} else if (difference > 135) {
							const impact = 180 - roundOriginal(difference);
							car.speed = single(car.speed - impact / 10);
							car.damage[corner] = single(Math.min(3, car.damage[corner] + impact / 270));
						}
						if (front && car.speed > 0) {
							if (left) car.blockedLeft = true;
							else car.blockedRight = true;
						}
					}
					contacts[index].add(otherIndex);
				}
				const displacement = (penetration + 1) / 2;
				firstCar.x = single(firstCar.x - normal.x * orientation * displacement);
				firstCar.y = single(firstCar.y - normal.y * orientation * displacement);
				secondCar.x = single(secondCar.x + normal.x * orientation * displacement);
				secondCar.y = single(secondCar.y + normal.y * orientation * displacement);
			}
		}
	}
	states.forEach((state, index) => { state.carContacts = contacts[index]; });
}

export function resolveOriginalWallCollision(state, wallAt) {
	if (!wallAt) return false;
	const contacts = () => getOriginalCarCorners(state)
		.map((point, index) => wallAt(point.x, point.y) ? index + 1 : 0).filter(Boolean);
	let colliding = contacts();
	if (!colliding.length) return false;
	const struckCorner = colliding[colliding.length - 1];
	for (let push = 0; push < 256 && colliding.length; push++) {
		const lastCorner = colliding[colliding.length - 1];
		const corners = lastCorner === colliding[0] ? [lastCorner] : [lastCorner, colliding[0]];
		for (const corner of corners) {
			let angle = state.heading;
			if (angle % 90 === 0) angle++;
			if (corner > 2) angle = (angle + 180) % 360;
			const quadrant = Math.floor(angle / 90) % 4;
			const direction = corner === 1 || corner === 4
				? [[1, 0], [0, -1], [-1, 0], [0, 1]][quadrant]
				: [[0, 1], [1, 0], [0, -1], [-1, 0]][quadrant];
			state.x = single(state.x + direction[0]);
			state.y = single(state.y + direction[1]);
		}
		colliding = contacts();
	}
	const roundedHeading = roundOriginal(state.heading);
	const incidence = struckCorner === 1 || struckCorner === 4
		? roundedHeading - Math.trunc(roundedHeading / 90) * 90
		: (Math.trunc(roundedHeading / 90) + 1) * 90 - roundedHeading;
	const radians = incidence * Math.PI / 180;
	const damage = incidence < 45 ? Math.abs(state.speed / 20 * Math.cos(radians)) : Math.abs(state.speed / 10);
	const damageIndex = [0, 1, 3, 2][struckCorner - 1];
	state.damage[damageIndex] = single(Math.min(3, state.damage[damageIndex] + damage));
	if (incidence < 45) {
		state.heading = wrapAngle(state.heading + (struckCorner === 1 || struckCorner === 4 ? -1 : 1) * Math.cos(radians) * 3);
	}
	state.speed = single(state.speed - Math.sin(radians) * state.speed);
	if (colliding.length) state.speed = 0;
	return true;
}

export function normalizeOriginalInput(input = {}) {
	return {
		left: Boolean(input.left),
		right: Boolean(input.right),
		throttle: Boolean(input.throttle && !input.handbrake),
		brake: Boolean(input.brake),
		handbrake: Boolean(input.handbrake)
	};
}

export function stepOriginalPhysics(state, parameters, rawInput, environment = {}) {
	if (state.pitTicks > 0) {
		rawInput = {};
		state.speed = 0;
	}
	const input = normalizeOriginalInput(rawInput);
	let smokeInterval = 5;
	const skidPairs = [];
	const surfaces = environment.surfaces ?? [0, 0, 0, 0];
	const surfaceSum = surfaces.reduce((sum, surface) => sum + surface, 0);
	if (state.speed > 1) state.speed = single(state.speed - surfaceSum / 150);
	if (state.speed < -1) state.speed = single(state.speed + surfaceSum / 150);
	if (surfaces[2] !== 0 && surfaces[3] === 0) {
		state.heading = single(state.heading + surfaces[0] * state.speed / 10);
	}
	if (surfaces[3] !== 0 && surfaces[2] === 0) {
		state.heading = single(state.heading - surfaces[1] * state.speed / 10);
	}
	if (surfaces.every((surface) => surface !== 0)) {
		state.heading = single(state.heading + ((environment.randomInt?.(3) ?? 1) - 1) * state.speed / 2);
	}

	if (input.throttle) {
		const acceleration = parameters.acceleration + state.accelerationModifier / 4000 * state.speed;
		if (state.speed < 0) state.speed = single(Math.min(0, state.speed + parameters.braking));
		if (state.speed >= 0 && state.speed <= 1.5) {
			state.speed = single(state.speed + (state.speed + 0.1) / 15);
		}
		if (state.speed > 1.5) {
			state.speed = single(state.speed + 1.3 *
				(acceleration + parameters.maxSpeed / 8 / state.speed * acceleration) / (state.speed + 2));
		}
		smokeInterval = 2;
		for (const ratio of [0.2, 0.4, 0.65]) {
			if (state.gearShiftTicks === 0 && state.speed > parameters.maxSpeed * ratio - 0.2 &&
				state.speed < parameters.maxSpeed * ratio + 0.2) state.gearShiftTicks = 60;
		}
	}
	if (state.gearShiftTicks > 0) state.gearShiftTicks--;
	if (state.gearShiftTicks > 30) smokeInterval = 5;
	if (input.brake) {
		state.speed = state.speed <= 0
			? single(state.speed + (state.speed - 0.1) / 10)
			: single(Math.max(0, state.speed - parameters.braking));
	}
	if (!input.left && !input.right) state.steering = single(0.3);
	else if (state.steering < 1) state.steering = single(state.steering + 0.05);
	for (const [pressed, blocked, direction] of [
		[input.left, state.blockedLeft, 1], [input.right, state.blockedRight, -1]
	]) {
		if (!pressed || blocked) continue;
		state.heading = single(state.heading + direction * Math.min(state.speed, 1.5) * state.steering);
		if (!input.handbrake) state.speed = single(state.speed - state.speed * state.steering / 300);
	}
	state.blockedLeft = false;
	state.blockedRight = false;

	if (input.handbrake || state.spinBase > 1) {
		state.spinVelocity = single(input.handbrake && state.speed > parameters.handbrakeThreshold
			? parameters.spin / (state.speed + 5) + state.spinBase : state.spinBase / 2);
		if (state.spinVelocity < 1) state.spinVelocity = 0;
		if (state.speed > 0 && !input.brake) state.speed = single(state.speed - 0.1);
		if (state.speed < 0 && !input.brake) state.speed = single(state.speed + 0.1);
		if (Math.abs(state.speed) < parameters.handbrakeThreshold) state.speed = 0;
		state.spinBase = single((state.spinBase + state.spinVelocity) / 4);
		if (input.left || input.right) {
			if (state.turnDistance === 0) state.turningLeft = input.left;
			if ((state.turningLeft && !input.left) || (!state.turningLeft && !input.right)) {
				state.turnDistance = 0;
			}
			state.turnDistance = (state.turnDistance + roundOriginal(state.speed)) << 16 >> 16;
		}
		if (input.left) state.travelAngle = single(state.travelAngle + state.spinVelocity);
		if (input.right) state.travelAngle = single(state.travelAngle - state.spinVelocity);
		if (state.turnDistance <= 2000 / parameters.spin) state.travelAngle = state.heading;
		else {
			if (state.speed < 2) state.turnDistance = 0;
			state.spinVelocity = single(state.spinVelocity * state.speed / 1.5);
		}
		if (state.spinBase < 1) state.spinBase = 0;
		if (input.left) state.heading = single(state.heading + state.spinVelocity);
		if (input.right) state.heading = single(state.heading - state.spinVelocity);
		if (state.speed > 1) {
			skidPairs.push([surfaces[1] === 0 ? 1 : null, surfaces[0] === 0 ? 0 : null]);
			if (state.turnDistance > 2000 / parameters.spin) {
				skidPairs.push([surfaces[3] === 0 ? 3 : null, surfaces[2] === 0 ? 2 : null]);
			}
		}
	} else {
		state.turnDistance = 0;
		if (Math.abs(state.heading - state.travelAngle) > 5) {
			let difference = Math.abs(roundOriginal(state.heading) - roundOriginal(state.travelAngle)) % 360;
			if (difference > 180) difference = 360 - difference;
			if (difference > 90) {
				state.speed = single(-state.speed);
				difference = 180 - difference;
			}
			state.speed = single(state.speed * (90 - Math.max(10, difference)) / 90);
		}
		state.travelAngle = state.heading;
	}
	environment.onEffects?.({
		smokeInterval,
		heavySmoke: state.damage[0] === 3 || state.damage[1] === 3,
		skidPairs
	});
	if (Math.abs(state.speed) < 0.1 && !input.throttle && !input.brake) state.speed = 0;
	state.speed = single(Math.max(-2, Math.min(parameters.maxSpeed + roundOriginal(state.accelerationModifier / 10), state.speed)));
	state.heading = wrapAngle(state.heading);
	state.travelAngle = wrapAngle(state.travelAngle);

	const startX = state.x;
	const startY = state.y;
	const substeps = Math.trunc(Math.abs(state.speed));
	for (let substep = 0; substep <= substeps; substep++) {
		const movementAngle = Math.abs(state.heading - state.travelAngle) > 5 ? state.travelAngle : state.heading;
		const radians = movementAngle * Math.PI / 180;
		const distance = state.speed > 0
			? substep + state.speed - Math.trunc(Math.abs(state.speed))
			: state.speed + Math.trunc(Math.abs(state.speed)) - substep;
		state.x = single(startX - Math.sin(radians) * distance);
		state.y = single(startY - Math.cos(radians) * distance);
		resolveOriginalWallCollision(state, environment.wallAt);
		if (!input.throttle && !input.brake) {
			if (state.speed > 0) state.speed = single(state.speed - 0.004 - 0.001 * surfaceSum);
			if (state.speed < 0) state.speed = single(state.speed + 0.004 + 0.001 * surfaceSum);
		}
	}
	state.ticks++;
	return state;
}

export function createOriginalClock(tickRate = ORIGINAL_TICK_RATE) {
	const tickMilliseconds = 1000 / tickRate;
	let accumulated = 0;
	return {
		advance(delta, step) {
			if (!Number.isFinite(delta) || delta <= 0) return 0;
			accumulated += Math.min(delta, 250);
			let ticks = 0;
			while (accumulated + 1e-8 >= tickMilliseconds) {
				step();
				accumulated -= tickMilliseconds;
				ticks++;
			}
			return ticks;
		},
		reset() { accumulated = 0; }
	};
}