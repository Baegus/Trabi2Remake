import { ORIGINAL_TICK_MS, roundOriginal } from "./originalPhysics.js";

export const GHOST_LAPS = 4;
export const ORIGINAL_GHOST_SETTINGS = Object.freeze({ transmission: 10, brakes: 10, tires: 1 });
const MAX_FRAMES = 500000;

export function parseGhostTime(data) {
	if (data.byteLength !== 26 || data[4] > 20 || data[25] > 5) throw new RangeError("Invalid GHO record");
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	return { time: view.getUint32(0, true) * ORIGINAL_TICK_MS,
		name: new TextDecoder("windows-1250").decode(data.subarray(5, 5 + data[4])), team: data[25] };
}

export function parseReplay(data) {
	if (!data.byteLength || data.byteLength % 7 || data.byteLength / 7 > MAX_FRAMES) throw new RangeError("Invalid TRR records");
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	return Array.from({ length: data.byteLength / 7 }, (_, frame) => {
		const offset = frame * 7;
		const heading = view.getUint16(offset + 4, true);
		const input = view.getUint8(offset + 6);
		if (heading > 360 || input > 31) throw new RangeError("Invalid TRR command");
		return { x: view.getInt16(offset, true), y: view.getInt16(offset + 2, true), heading, input };
	});
}

export function encodeReplay(frames) {
	const bytes = new Uint8Array(frames.length * 7);
	const view = new DataView(bytes.buffer);
	frames.forEach((frame, index) => {
		view.setInt16(index * 7, roundOriginal(frame.x), true);
		view.setInt16(index * 7 + 2, roundOriginal(frame.y), true);
		view.setUint16(index * 7 + 4, roundOriginal(frame.heading), true);
		view.setUint8(index * 7 + 6, frame.input);
	});
	return bytes;
}

export function replayInput(mask) {
	return { left: Boolean(mask & 1), right: Boolean(mask & 2), throttle: Boolean(mask & 4),
		brake: Boolean(mask & 8), handbrake: Boolean(mask & 16) };
}

export function recordReplayFrame(state, input) {
	return { x: roundOriginal(state.x), y: roundOriginal(state.y), heading: roundOriginal(state.heading),
		input: Number(!!input.left) + Number(!!input.right) * 2 + Number(!!input.throttle && !input.handbrake) * 4 +
			Number(!!input.brake) * 8 + Number(!!input.handbrake) * 16 };
}

export function getGhostFrame(ghost, tick) {
	const frame = ghost.frames[Math.min(tick, ghost.frames.length - 1)] ?? null;
	return frame && ghost.native ? { ...frame, x: frame.x + 320, y: frame.y + 240 } : frame;
}

export function updateGhostSprite(sprite, frame) {
	if (frame) sprite.setPosition(frame.x, frame.y).setRotation(-frame.heading * Math.PI / 180);
}

export function loadGhost(storage, map, originalTime, originalReplay) {
	const original = { ...parseGhostTime(originalTime), frames: parseReplay(originalReplay), native: true };
	try {
		const saved = JSON.parse(storage?.getItem(`trabi2.ghost.${map}`) ?? "null");
		if (saved?.version !== 1 || !Number.isFinite(saved.time) || saved.time <= 0 ||
			saved.time >= original.time || typeof saved.name !== "string" || saved.name.length > 20 ||
			!Number.isInteger(saved.team) || saved.team < 0 || saved.team > 5 || typeof saved.replay !== "string") return original;
		const bytes = Uint8Array.from(atob(saved.replay), (character) => character.charCodeAt(0));
		return { time: saved.time, name: saved.name, team: saved.team, frames: parseReplay(bytes), native: false };
	} catch {
		return original;
	}
}

export function saveGhost(storage, map, ghost, time, name, team, frames) {
	if (!Number.isFinite(time) || time <= 0 || time >= ghost.time || frames.length > MAX_FRAMES) return false;
	const bytes = encodeReplay(frames);
	const chunks = [];
	for (let offset = 0; offset < bytes.length; offset += 8192) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
	storage.setItem(`trabi2.ghost.${map}`, JSON.stringify({ version: 1, time, name: name.slice(0, 20), team,
		replay: btoa(chunks.join("")), tickMs: ORIGINAL_TICK_MS }));
	return true;
}