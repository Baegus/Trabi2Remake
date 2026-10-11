export const nextMusicTrack = (track, offset = 1) => ((track - 1 + offset) % 5 + 5) % 5 + 1;

export function toggleMute(scene) {
	scene.sound.setMute(!scene.sound.mute);
	return scene.sound.mute;
}

export function playSound(scene, name, config = {}) {
	if (scene.sound.mute || scene.registry.get("soundEnabled") === false || !scene.cache.audio.exists(name)) return null;
	const sample = scene.sound.add(name, { loop: Boolean(config.loop) });
	const choose = (values, fallback) => Array.isArray(values) ? values[0] + Math.random() * ((values[1] ?? values[0]) - values[0]) : values ?? fallback;
	sample.setVolume(choose(config.volume, 1));
	sample.setRate(choose(config.pitch, 1));
	const stop = () => sample.destroy();
	if (!config.global) scene.events.once("shutdown", stop);
	sample.once("complete", () => {
		scene.events.off("shutdown", stop);
		config.onComplete?.();
		sample.destroy();
	});
	sample.play();
	return sample;
}

export function playMusicTrack(scene, track) {
	if (!scene.cache.audio.exists(`HUDBA.SND-SND${track}`)) return null;
	scene.registry.get("musicSample")?.destroy();
	const sample = scene.sound.add(`HUDBA.SND-SND${track}`, {
		volume: (scene.registry.get("musicVolume") ?? 3) / 15 * 0.2,
		loop: scene.registry.get("musicContext") !== "race"
	});
	scene.registry.set("musicTrack", track);
	scene.registry.set("musicSample", sample);
	sample.once("complete", () => {
		if (scene.registry.get("musicSample") !== sample) return;
		playMusicTrack(scene, nextMusicTrack(track));
	});
	sample.play();
	return sample;
}

export function setMenuMusic(scene) {
	if (scene.registry.get("musicContext") === "menu" && scene.registry.get("musicSample")) return;
	scene.registry.set("musicContext", "menu");
	playMusicTrack(scene, 2);
}

export function setRaceMusic(scene) {
	scene.registry.set("musicContext", "race");
	playMusicTrack(scene, 1);
}

export function stopMusic(scene) {
	scene.registry.get("musicSample")?.destroy();
	scene.registry.set("musicSample", null);
	scene.registry.set("musicContext", null);
}

export function setMusicVolume(scene, steps) {
	if (!Number.isFinite(steps)) return;
	steps = Math.max(0, Math.min(15, Math.round(steps)));
	scene.registry.set("musicVolume", steps);
	scene.registry.get("musicSample")?.setVolume(steps / 15 * 0.2);
}

export function getEngineCue(state, input, maxSpeed) {
	if (state.pitTicks > 0) return null;
	if (state.gearShiftTicks > 0) return { sample: 4, loop: false };
	if (input.throttle && !input.handbrake || input.brake && state.speed < -0.2) {
		const secondGear = state.speed >= maxSpeed * 0.2 && state.speed < maxSpeed * 0.4;
		return { sample: secondGear || state.speed < -0.2 ? 3 : 5, loop: false };
	}
	return { sample: Math.abs(state.speed) < 0.2 ? 1 : 2, loop: true };
}

export function createRaceAudio(scene) {
	let engine = null;
	let engineCue = null;
	let queuedEngine = null;
	let shiftTicks = 0;
	let shiftFinished = false;
	let latestCue = null;
	let skid = null;
	let previous = null;
	let impactTick = -Infinity;
	let ticks = 0;
	const destroy = () => {
		engine?.destroy();
		queuedEngine?.destroy();
		skid?.destroy();
		engine = null;
		queuedEngine = null;
		skid = null;
		engineCue = null;
	};
	const queueAfter = (sample, cue, delay) => {
		if (!cue || !scene.cache.audio.exists(`TRABANT.SND-S${cue.sample}`)) return;
		queuedEngine = scene.sound.add(`TRABANT.SND-S${cue.sample}`, { loop: cue.loop });
		queuedEngine.play({ delay });
		sample.once("complete", () => {
			if (engine !== sample) return;
			engine = queuedEngine;
			queuedEngine = null;
			if (engineCue === 4) shiftFinished = true;
			engineCue = cue.sample;
			sample.destroy();
			if (engine && !cue.loop) queueAfter(engine, { sample: 6, loop: true }, Math.max(0, engine.duration - engine.seek));
		});
	};
	const changeEngine = (cue, delay = 0) => {
		const previousEngine = engine;
		queuedEngine?.destroy();
		queuedEngine = null;
		engine = null;
		engineCue = cue?.sample ?? null;
		if (!cue) { previousEngine?.destroy(); return; }
		const key = `TRABANT.SND-S${cue.sample}`;
		if (!scene.cache.audio.exists(key)) { previousEngine?.destroy(); return; }
		const sample = scene.sound.add(key, { loop: cue.loop });
		engine = sample;
		sample.play({ delay });
		previousEngine?.destroy();
		if (!cue.loop) queueAfter(sample, cue.sample === 4 ? latestCue : { sample: 6, loop: true }, delay + sample.duration);
	};
	const cancelQueuedEngine = () => {
		queuedEngine?.destroy();
		queuedEngine = null;
	};
	const pause = () => {
		cancelQueuedEngine();
		engine?.pause();
		skid?.pause();
		scene.registry.get("musicSample")?.pause();
	};
	const resume = () => {
		engine?.resume();
		if (engine && [3, 4, 5].includes(engineCue)) {
			engine.removeAllListeners("complete");
			queueAfter(engine, engineCue === 4 ? latestCue : { sample: 6, loop: true }, Math.max(0, engine.duration - engine.seek));
		}
		skid?.resume();
		scene.registry.get("musicSample")?.resume();
	};
	scene.events.on("pause", pause);
	scene.events.on("resume", resume);
	scene.events.once("shutdown", () => {
		destroy();
		scene.events.off("pause", pause);
		scene.events.off("resume", resume);
		setMenuMusic(scene);
	});
	return {
		destroy,
		step(state, input, maxSpeed) {
			ticks++;
			if (scene.registry.get("soundEnabled") === false || scene.sound.mute) { destroy(); previous = null; return; }
			if (state.gearShiftTicks > shiftTicks || !state.gearShiftTicks) shiftFinished = false;
			shiftTicks = state.gearShiftTicks;
			latestCue = getEngineCue({ ...state, gearShiftTicks: 0 }, input, maxSpeed);
			const cue = shiftFinished ? latestCue : getEngineCue(state, input, maxSpeed);
			if (cue?.sample !== engineCue && !(engineCue === 6 && [3, 5].includes(cue?.sample))) changeEngine(cue);
			const skidding = Math.abs(state.speed) > 1 && (input.handbrake || state.turnDistance > 2000);
			if (!skidding && skid) { skid.destroy(); skid = null; }
			if (skidding && !skid && scene.cache.audio.exists("TRABANT.SND-S7")) {
				skid = scene.sound.add("TRABANT.SND-S7", { loop: true });
				skid.play();
			}
			if (previous && ticks - impactTick > 5 && state.damage.some((value, index) => value > previous.damage[index])) {
				playSound(scene, `TRABANT.SND-S${state.carContacts?.size ? 9 : 8}`);
				impactTick = ticks;
			}
			previous = { damage: [...state.damage] };
		}
	};
}