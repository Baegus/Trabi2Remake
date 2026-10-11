export const SAVE_SLOT_COUNT = 12;
const SAVE_KEY = "trabi2.save.";
const STATE_KEYS = ["currentRaceType", "playerName", "playerTeam", "currentMap", "difficulty",
	"transmissionVal", "brakesVal", "tiresVal", "raceLaps", "raceOpponents", "championship", "lastRaceResults"];

export function captureGameState(registry) {
	return Object.fromEntries(STATE_KEYS.map((key) => [key, registry.get(key) ?? null]));
}

export function validGameState(state) {
	const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
	if (!state || !["championship", "freeRace", "ghostRace"].includes(state.currentRaceType)) return false;
	if (typeof state.playerName !== "string" || state.playerName.length > 16) return false;
	if (!integer(state.playerTeam, 0, 5) || !integer(state.currentMap, 0, 9) || !integer(state.difficulty, 0, 2)) return false;
	if (!["transmissionVal", "brakesVal"].every((key) => integer(state[key], 0, 21)) || !integer(state.tiresVal, 0, 2)) return false;
	if (!integer(state.raceLaps, 1, 99) || !integer(state.raceOpponents, 0, 5)) return false;
	const validResults = (results) => Array.isArray(results) && results.length <= 6 && results.every((result) =>
		integer(result.team, 0, 5) && (result.finishTime === null || Number.isFinite(result.finishTime) && result.finishTime >= 0));
	if (!validResults(state.lastRaceResults)) return false;
	if (state.currentRaceType !== "championship") return state.championship === null;
	const championship = state.championship;
	return Boolean(championship && integer(championship.track, 0, 9) && championship.team === state.playerTeam &&
		["training", "race"].includes(championship.phase) && championship.complete === false &&
		Array.isArray(championship.results) && championship.results.length === championship.track &&
		championship.results.every((race, index) => race.track === index && validResults(race.results)));
}

export function readSaveSlot(storage, slot) {
	try {
		const save = JSON.parse(storage.getItem(SAVE_KEY + slot));
		return save?.version === 1 && typeof save.name === "string" && save.name.length > 0 && save.name.length <= 8 &&
			Number.isFinite(save.savedAt) && validGameState(save.state) ? save : null;
	} catch {
		return null;
	}
}

export function writeSaveSlot(storage, slot, name, registry, now = Date.now()) {
	if (!Number.isInteger(slot) || slot < 0 || slot >= SAVE_SLOT_COUNT) throw new RangeError("Invalid save slot");
	const state = JSON.parse(JSON.stringify(captureGameState(registry)));
	if (!validGameState(state)) throw new Error("Cannot save invalid race settings");
	const save = { version: 1, name: name.trim().slice(0, 8), savedAt: now, state };
	if (!save.name) throw new Error("Enter a save name");
	storage.setItem(SAVE_KEY + slot, JSON.stringify(save));
	return save;
}

export function restoreGameState(registry, save) {
	if (!validGameState(save?.state)) throw new Error("Invalid saved game");
	const state = JSON.parse(JSON.stringify(save.state));
	for (const key of STATE_KEYS) registry.set(key, state[key]);
	registry.set("sessionResults", []);
	registry.set("sessionTitle", "");
}

export function formatSaveDate(savedAt) {
	const date = new Date(savedAt);
	const pad = (value) => String(value).padStart(2, "0");
	return { time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
		date: `${pad(date.getDate())}.${pad(date.getMonth() + 1)}` };
}