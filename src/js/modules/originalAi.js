import { getOriginalCarCorners, roundOriginal } from "./originalPhysics.js";

export function originalTargetHeading(car, target) {
	return roundOriginal((Math.atan2(car.x - target.x, car.y - target.y) * 180 / Math.PI + 360) % 360);
}

export function createOriginalAiState() {
	return { node: 1, pitNode: 1, usePitRoute: false, passing: null, passed: false, braking: false, parked: false, target: null };
}

export function advanceOriginalRoute(car, nodes, cursor) {
	if (!nodes?.length) return null;
	cursor %= nodes.length;
	let target;
	for (let visited = 0; visited < nodes.length; visited++) {
		target = nodes[cursor];
		const distance = Math.hypot(roundOriginal(car.x) - target.x, roundOriginal(car.y) - target.y);
		const heading = originalTargetHeading(car, target);
		const difference = Math.abs(heading - car.heading);
		if (distance >= 50 && !(difference > 90 && difference < 270 && distance < 400)) {
			return { node: cursor, target, heading, distance };
		}
		cursor = (cursor + 1) % nodes.length;
	}
	return { node: cursor, target: nodes[cursor], heading: originalTargetHeading(car, nodes[cursor]), distance: 0 };
}

export function findOriginalAiTraffic(car, racers) {
	const radians = car.heading * Math.PI / 180;
	const forward = { x: -Math.sin(radians), y: -Math.cos(radians) };
	const lateral = { x: Math.cos(radians), y: -Math.sin(radians) };
	for (const offset of [0, -20, 20]) {
		for (const distance of [200, 150, 100]) {
			const point = { x: car.x + forward.x * distance + lateral.x * offset,
				y: car.y + forward.y * distance + lateral.y * offset };
			for (const racer of racers) {
				if (racer === car || (car.racerId !== undefined && racer.racerId === car.racerId)) continue;
				const angle = racer.heading * Math.PI / 180;
				const deltaX = point.x - racer.x;
				const deltaY = point.y - racer.y;
				if (Math.abs(deltaX * Math.cos(angle) - deltaY * Math.sin(angle)) <= 16 &&
					Math.abs(deltaX * Math.sin(angle) + deltaY * Math.cos(angle)) <= 34) {
					return { racer, distance, offset, near: distance === 100 };
				}
			}
		}
	}
	return null;
}

export function getOriginalPitBay(depot, team) {
	return { left: depot.x + team * 300 + 50, right: depot.x + (team + 1) * 300 - 150,
		top: depot.y + 10, bottom: depot.y + depot.h };
}

export function stepOriginalPitService(car, depot, team) {
	if (car.pitTicks > 0) {
		car.speed = 0;
		car.pitTicks--;
		if (car.pitTicks === 0) {
			car.damage = [0, 0, 0, 0];
			car.pitServiced = true;
		}
		return true;
	}
	const bay = getOriginalPitBay(depot, team);
	const headingDifference = Math.abs((roundOriginal(car.heading) - 90 + 540) % 360 - 180);
	if (car.pitServiced || headingDifference > 90 ||
		!getOriginalCarCorners(car).every((point) => point.x > bay.left && point.x < bay.right && point.y > bay.top && point.y < bay.bottom)) return false;
	car.pitTicks = 360;
	car.speed = 0;
	return true;
}

export function getOriginalRoadContext(car, tileAt, tileSize = 100) {
	const orientation = (tile) => [3, 4, 67, 68, 71, 72].includes(tile) ? 1
		: [5, 6, 69, 70, 73, 74].includes(tile) ? 2 : 0;
	const type = orientation(tileAt(car.x, car.y));
	if (!type) return { distance: 0, direction: Math.round(car.heading / 90) % 4, lateral: 0 };
	const direction = type === 1 ? (car.heading >= 45 && car.heading < 225 ? 1 : 3)
		: (car.heading >= 315 || car.heading < 135 ? 0 : 2);
	const delta = [[0, -1], [-1, 0], [0, 1], [1, 0]][direction];
	const coordinate = type === 1 ? car.x : car.y;
	const remainder = ((coordinate % tileSize) + tileSize) % tileSize;
	let distance = direction === 0 || direction === 1 ? remainder : tileSize - remainder;
	for (let tiles = 1; tiles < 256; tiles++) {
		if (orientation(tileAt(car.x + delta[0] * tiles * tileSize, car.y + delta[1] * tiles * tileSize)) !== type) break;
		distance += tileSize;
	}
	return { distance, direction, lateral: type === 1 ? car.y % tileSize : car.x % tileSize };
}

export function stepOriginalAi(ai, car, parameters, { nodes, pitNodes, finished = false, racers = [], repairDepo, team = 0, road } = {}) {
	const input = { left: false, right: false, throttle: !finished, brake: false, handbrake: finished };
	if (ai.parked || car.pitTicks > 0 || (finished && (!pitNodes?.length || !repairDepo))) {
		return { ...input, throttle: false, handbrake: true };
	}
	if (finished) {
		input.throttle = true;
		input.handbrake = false;
		const bay = getOriginalPitBay(repairDepo, team);
		if (car.x > bay.left + 34 && car.x < bay.right - 34 && car.y > bay.top + 16 && car.y < bay.bottom - 16) {
			ai.parked = true;
			return { ...input, throttle: false, handbrake: true };
		}
	}
	const main = advanceOriginalRoute(car, nodes, ai.node);
	if (!main) return { ...input, throttle: false };
	if (main.node < ai.node) ai.pitNode = 0;
	ai.node = main.node;
	const pit = advanceOriginalRoute(car, pitNodes, ai.pitNode);
	if (pit) ai.pitNode = pit.node;
	if (ai.usePitRoute && !finished && !car.damage.some((damage) => damage > 1) && ai.pitNode > 500 && ai.pitNode < 600) {
		ai.usePitRoute = false;
	}
	const route = ai.usePitRoute && pit ? pit : main;
	ai.target = route.target;
	const needsRepair = finished || car.damage.some((damage) => damage > 1);
	const straightDistance = road?.distance ?? route.distance;
	const traffic = findOriginalAiTraffic(car, racers);
	if (traffic) {
		const difference = roundOriginal(car.speed) - roundOriginal(traffic.racer.speed);
		let threshold = difference === 0 ? 1000 : Math.max(500, Math.min(1000, Math.trunc(1000 / difference)));
		if (threshold === 1000 && ai.braking) threshold = 700;
		if (car.accelerationModifier > 40) threshold = Math.trunc(threshold * 2 / 3);
		if (needsRepair || finished) threshold = 5000;
		ai.braking = false;
		if (car.speed > roundOriginal(traffic.racer.speed) && !ai.passing && traffic.near) {
			if (straightDistance < threshold) {
				input.throttle = false;
				input.brake = true;
				ai.braking = true;
			} else ai.passing = traffic.racer;
		}
	}
	if (ai.passing) {
		const direction = road?.direction ?? Math.round(car.heading / 90) % 4;
		const other = ai.passing;
		const horizontal = direction === 1 || direction === 3;
		const error = (horizontal ? car.y - other.y : car.x - other.x);
		const offset = error < 1 ? -(error + 60) : -(error - 60);
		const desired = ((direction * 90 + Math.max(-10, Math.min(10, error + offset)) + 360) % 360);
		const turn = (desired - car.heading + 540) % 360 - 180;
		input.left = turn > 0;
		input.right = turn < 0;
		const passed = direction === 1 ? car.x < other.x - 20 : direction === 3 ? car.x > other.x + 20
			: direction === 0 ? car.y < other.y - 20 : car.y > other.y + 20;
		if (passed || straightDistance < 400) {
			ai.passing = null;
			ai.passed = true;
		}
		return input;
	}
	const difference = Math.abs(route.heading - car.heading);
	if (difference > 20 && difference < 350 && car.speed > 2) input.throttle = false;
	if (difference > 40 && difference < 330 && !ai.passed) {
		if (car.speed < 3) input.throttle = true;
		if (car.speed > 3) input.handbrake = true;
	}
	if (difference <= 2 || difference >= 358) ai.passed = false;
	else if ((route.heading <= car.heading && (car.heading <= 270 || route.heading > 89)) ||
		(car.heading < 90 && route.heading > 270)) input.right = true;
	else input.left = true;
	if (needsRepair && repairDepo) {
		const bay = getOriginalPitBay(repairDepo, team);
		if (ai.usePitRoute && car.x > bay.left + 34 && car.x < bay.right + 500 && car.y > bay.top - 50 && car.y < bay.bottom + 100) {
			const desired = originalTargetHeading(car, { x: (bay.left + bay.right) / 2, y: (bay.top + bay.bottom) / 2 });
			const turn = (desired - car.heading + 540) % 360 - 180;
			input.left = turn > 2;
			input.right = turn < -2;
			input.throttle = car.speed < 2;
			input.handbrake = false;
			if (car.x > bay.left + 34 && car.x < bay.right - 34 && car.y > bay.top + 16 && car.y < bay.bottom - 16) {
				input.throttle = false;
				input.brake = car.speed > 0;
			}
		}
		if (car.speed > 3 && car.x > bay.left && car.x < bay.right + 1250 && car.y > bay.top && car.y < bay.bottom + 300) input.throttle = false;
	}
	if (input.handbrake && car.turnDistance > 2000 / parameters.spin - 10) input.handbrake = false;
	return input;
}