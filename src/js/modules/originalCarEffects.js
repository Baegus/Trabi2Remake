export function createOriginalTrackMarks() {
	return { skidCursor: 0, surfaceCursor: 0, skids: [Array(1024).fill(null), Array(1024).fill(null)], surfaces: Array(256).fill(null) };
}

export function createOriginalEffectsState(marks = createOriginalTrackMarks()) {
	return {
		smoke: [Array(15).fill(null), Array(15).fill(null)],
		smokeCursor: [0, 0], smokeCounter: [0, 0], activeSmoke: 0,
		surfaceCounter: 0, marks
	};
}

export function stepOriginalCarEffects(effects, {
	exhaust, wheels, surfaces = [0, 0, 0, 0], smokeInterval = 5,
	heavySmoke = false, skidPairs = [], snow = false
}) {
	const writes = [];
	for (let wheel = 0; wheel < 4; wheel++) {
		if (surfaces[wheel] !== (snow ? 1 : 3)) continue;
		if (effects.surfaceCounter === 3) {
			const mark = { ...wheels[wheel], frame: snow ? 2 : 1 };
			const slot = effects.marks.surfaceCursor;
			effects.marks.surfaces[slot] = mark;
			writes.push({ type: "surface", slot, mark });
			effects.marks.surfaceCursor = (slot + 1) % 256;
			effects.surfaceCounter = 0;
		}
		effects.surfaceCounter++;
	}
	for (const pair of skidPairs) {
		const slot = effects.marks.skidCursor;
		pair.forEach((wheel, side) => {
			if (wheel === null) return;
			const mark = { ...wheels[wheel], frame: 0 };
			effects.marks.skids[side][slot] = mark;
			writes.push({ type: "skid", side, slot, mark });
		});
		effects.marks.skidCursor = (slot + 1) % 1024;
	}
	effects.activeSmoke = heavySmoke ? 1 : 0;
	if (!heavySmoke) effects.smokeCounter[1] = 0;
	const type = effects.activeSmoke;
	effects.smokeCounter[type]++;
	if (effects.smokeCounter[type] >= (heavySmoke ? 2 : smokeInterval)) {
		const slot = effects.smokeCursor[type];
		effects.smoke[type][slot] = { ...exhaust, frame: 0 };
		effects.smokeCursor[type] = (slot + 1) % 15;
		effects.smokeCounter[type] = 0;
	}
	effects.smoke[type].forEach((particle, slot) => {
		if (!particle) return;
		particle.frame++;
		if (particle.frame > 14) effects.smoke[type][slot] = null;
	});
	return writes;
}

export function createOriginalCarEffects(scene) {
	const marks = createOriginalTrackMarks();
	const skidImages = [Array(1024), Array(1024)];
	const surfaceImages = Array(256);
	const drawStamp = (images, slot, mark) => {
		if (!images[slot]) images[slot] = scene.add.image(mark.x, mark.y, "STOPY.FSF", mark.frame).setDepth(1);
		else images[slot].setPosition(mark.x, mark.y).setFrame(mark.frame);
	};
	return {
		marks,
		register(car) {
			const state = createOriginalEffectsState(marks);
			const smokeImages = [Array(15), Array(15)];
			const controller = {
				state,
				step(signals) {
					const writes = stepOriginalCarEffects(state, signals);
					for (const write of writes) {
						drawStamp(write.type === "skid" ? skidImages[write.side] : surfaceImages, write.slot, write.mark);
					}
					smokeImages.forEach((images, type) => {
						state.smoke[type].forEach((particle, slot) => {
							const visible = type === state.activeSmoke && particle !== null;
							if (visible) {
								if (!images[slot]) images[slot] = scene.add.image(0, 0, type === 0 ? "DYM1.FSF" : "DYM2.FSF", 0).setDepth(11);
								images[slot].setPosition(particle.x, particle.y).setFrame(particle.frame);
							}
							images[slot]?.setVisible(visible);
						});
					});
				},
				destroy() {
					smokeImages.flat().forEach((image) => image?.destroy());
				}
			};
			car.once("destroy", controller.destroy);
			return controller;
		}
	};
}