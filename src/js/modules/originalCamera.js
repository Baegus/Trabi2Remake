import { roundOriginal } from "./originalPhysics.js";

export function createOriginalCameraState() {
	return { x: 0, y: 0 };
}

export function stepOriginalCamera(offset, car, maxSpeed, width, height, enabled) {
	if (!enabled) {
		offset.x = 0;
		offset.y = 0;
		return offset;
	}
	const radians = Math.fround(car.heading * Math.PI / 180);
	const targetX = roundOriginal(Math.sin(radians) * car.speed * width / (maxSpeed * 3));
	const targetY = roundOriginal(Math.cos(radians) * car.speed * height / (maxSpeed * 3));
	const approach = (current, target) => Math.max(current - 2, Math.min(current + 2, target));
	offset.x = approach(offset.x, targetX);
	offset.y = approach(offset.y, targetY);
	return offset;
}

export function getOriginalCameraCenter(offset, car) {
	return { x: roundOriginal(car.x) - offset.x, y: roundOriginal(car.y) - offset.y };
}