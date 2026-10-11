export const ORIGINAL_MAP_ORDER = [7, 8, 1, 5, 6, 9, 4, 3, 10, 2];
export const ORIGINAL_CHAMPIONSHIP_LAPS = [12, 8, 8, 10, 8, 6, 16, 10, 12, 10];
export const ORIGINAL_TRACK_NAMES = [
	"Karl-Marx Stadt", "Pohar osvobozeni", "Sturuv pohar", "Cena Transilvanie", "Mosonmagiarovar",
	"Leninuv okruh", "Okruh v Zabrzi", "Velka cena Lipska", "Zitomirsky okruh", "Pohar SNP"
];

export const ORIGINAL_RACERS = [
	{ number: 21, name: "Z.Havrda" },
	{ number: 47, name: "O.Dorffeldt" },
	{ number: 5, name: "E.Hilbk" },
	{ number: 8, name: "J.Vlaszaty" },
	{ number: 32, name: "V.Wozowicz" },
	{ number: 11, name: "V.Bogatyrev" }
];

export function getOriginalStartLights(ticks) {
	const released = ticks > 240;
	return { released, visible: ticks < 367, y: released ? -(ticks - 241) : 0,
		top: [61, 121, 181].map((threshold) => !released && ticks >= threshold ? 1 : 0),
		bottom: released ? 2 : 0 };
}

export function createOriginalChampionship(team = 0) {
	return { track: 0, phase: "training", team, results: [], complete: false };
}

export function getOriginalRaceSettings({ mode = "freeRace", championship, laps = 12, opponents = 5 } = {}) {
	if (mode === "championship" && championship) {
		const training = championship.phase === "training";
		return { training, laps: training ? 10 : ORIGINAL_CHAMPIONSHIP_LAPS[championship.track], opponents: training ? 0 : 5 };
	}
	return { training: false, laps: Math.max(1, Math.min(99, Math.trunc(laps))),
		opponents: mode === "ghostRace" ? 0 : Math.max(0, Math.min(5, Math.trunc(opponents))) };
}

export function advanceOriginalChampionship(championship, results = []) {
	if (championship.complete) return championship;
	if (championship.phase === "training") championship.phase = "race";
	else {
		championship.results.push({ track: championship.track, results });
		championship.track++;
		championship.complete = championship.track === ORIGINAL_MAP_ORDER.length;
		championship.phase = "training";
	}
	return championship;
}

export function getOriginalGridSlots(teams, playerTeam, previousResults = [], championship = false) {
	const ranked = previousResults.map((result) => result.team).filter((team) => teams.includes(team));
	const remaining = teams.filter((team) => !ranked.includes(team));
	if (!ranked.length && championship) return [...remaining.filter((team) => team !== playerTeam), playerTeam];
	return [...ranked, ...remaining];
}

export function getOriginalStartingGrid(start, teams, playerTeam = 0, slots = teams) {
	return teams.map((team) => {
		const slot = slots.indexOf(team);
		if (slot < 0) throw new Error(`Missing starting slot for team ${team}`);
		return { team, isPlayer: team === playerTeam, x: start.x + 56 + slot * 200,
			y: start.y + (slot % 2 === 0 ? 53 : 150), heading: 90 };
	});
}

export function createOriginalRacerProgress(position) {
	return { laps: 0, checkpoint: false, finished: false, finishTime: null, lapStart: 0,
		bestLap: Infinity, node: 0, distance: Infinity, previous: { x: position.x, y: position.y }, startInside: false, checkpointInside: false };
}

export function crossesOriginalGate(previous, position, gate) {
	const left = gate.x;
	const right = gate.x + 15;
	const inside = position.x >= left && position.x <= right && position.y >= gate.y && position.y <= gate.y + gate.h;
	if (inside) return true;
	if (previous.x === position.x) return false;
	const fraction = (gate.x + 7.5 - previous.x) / (position.x - previous.x);
	const crossingY = previous.y + (position.y - previous.y) * fraction;
	return fraction >= 0 && fraction <= 1 && crossingY >= gate.y && crossingY <= gate.y + gate.h;
}

export function stepOriginalRacerProgress(progress, position, points, elapsed, lapLimit) {
	if (progress.finished) return null;
	const checkpoint = crossesOriginalGate(progress.previous, position, points.checkpoint);
	const start = crossesOriginalGate(progress.previous, position, points.start);
	if (checkpoint && !progress.checkpointInside) progress.checkpoint = true;
	let event = null;
	if (start && !progress.startInside && progress.checkpoint && position.x < progress.previous.x) {
		const lapTime = elapsed - progress.lapStart;
		progress.laps++;
		progress.checkpoint = false;
		progress.bestLap = Math.min(progress.bestLap, lapTime);
		progress.lapStart = elapsed;
		progress.finished = progress.laps >= lapLimit;
		if (progress.finished) progress.finishTime = elapsed;
		event = { lap: progress.laps, lapTime, finished: progress.finished };
	}
	progress.previous = { x: position.x, y: position.y };
	progress.startInside = start;
	progress.checkpointInside = checkpoint;
	return event;
}

export function rankOriginalRacers(racers) {
	return [...racers].sort((first, second) => {
		if (first.progress.finished || second.progress.finished) {
			return (first.progress.finishTime ?? Infinity) - (second.progress.finishTime ?? Infinity) || first.team - second.team;
		}
		return second.progress.laps - first.progress.laps || second.progress.node - first.progress.node ||
			first.progress.distance - second.progress.distance || first.team - second.team;
	});
}