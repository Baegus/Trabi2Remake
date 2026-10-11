import {
	b2Body_Disable, b2Body_Enable, b2Body_GetLinearVelocity, b2Body_GetTransform,
	b2Body_SetAngularVelocity, b2Body_SetLinearVelocity, b2Body_SetTransform,
	b2Rot, b2Vec2, GetWorldScale, pxm
} from "phaser-box2d/dist/PhaserBox2D.js";
import {
	createOriginalParameters, createOriginalState, ORIGINAL_SPEED_TO_KPH,
	ORIGINAL_TICK_RATE, getOriginalCarCorners, getOriginalSurfaceType, getOriginalWheelPositions, stepOriginalPhysics
} from "./originalPhysics.js";
import { stepOriginalPitService } from "./originalAi.js";

export function createOriginalCarController(car, parData, settings) {
	const parameters = createOriginalParameters(parData, settings);
	let state = createOriginalState();
	const effects = car.scene.carEffects.register(car);
	const boxEffectsState = createOriginalState();
	let randomSeed = 1;
	const speedScale = GetWorldScale() / ORIGINAL_TICK_RATE;
	const sampleSurfaces = (wheels) => wheels.map((point) => {
		const tilemap = car.scene.tilemap;
		const tile = tilemap.getTileAt(Math.floor(point.x / tilemap.tileWidth), Math.floor(point.y / tilemap.tileHeight));
		const offroad = window.SYNQuery?.isOffroad("POZ.SYN", tilemap, point.x, point.y) ?? false;
		return getOriginalSurfaceType(tile?.index ?? -1, offroad);
	});
	const effectEnvironment = (snapshot) => {
		const wheels = getOriginalWheelPositions(snapshot);
		const exhaust = getOriginalCarCorners(snapshot)[2];
		const surfaces = sampleSurfaces(wheels);
		return {
			surfaces,
			onEffects: (signals) => effects.step({ ...signals, exhaust, wheels, surfaces })
		};
	};
	const velocityFromState = () => {
		const radians = state.travelAngle * Math.PI / 180;
		return new b2Vec2(-Math.sin(radians) * state.speed / speedScale, Math.cos(radians) * state.speed / speedScale);
	};
	const syncTransform = () => {
		const radians = state.heading * Math.PI / 180;
		b2Body_SetTransform(car.body.bodyId, new b2Vec2(pxm(state.x), pxm(-state.y)),
			new b2Rot(Math.cos(radians), Math.sin(radians)));
	};
	return {
		parameters,
		effects,
		syncTransform,
		get state() { return state; },
		stepPitService(depot) {
			if (car.scene.physicsBackend === "box2d") Object.assign(state, this.snapshot());
			const held = stepOriginalPitService(state, depot, car.team);
			if (held && car.scene.physicsBackend === "box2d") {
				b2Body_SetLinearVelocity(car.body.bodyId, new b2Vec2(0, 0));
				b2Body_SetAngularVelocity(car.body.bodyId, 0);
				car.lastVelocity = null;
			}
			if (held) this.afterStep();
			return held;
		},
		snapshot() {
			if (car.scene.physicsBackend === "original") return state;
			const transform = b2Body_GetTransform(car.body.bodyId);
			const velocity = b2Body_GetLinearVelocity(car.body.bodyId);
			return {
				x: transform.p.x * GetWorldScale(), y: -transform.p.y * GetWorldScale(),
				heading: (Math.atan2(transform.q.s, transform.q.c) * 180 / Math.PI + 360) % 360,
				speed: (-transform.q.s * velocity.x + transform.q.c * velocity.y) * speedScale,
				damage: car.damage.map((damage) => Math.fround(damage * 3 / 100)), turnDistance: 0,
				pitTicks: state.pitTicks, pitServiced: state.pitServiced
			};
		},
		enter() {
			const transform = b2Body_GetTransform(car.body.bodyId);
			const velocity = b2Body_GetLinearVelocity(car.body.bodyId);
			const heading = Math.atan2(transform.q.s, transform.q.c) * 180 / Math.PI;
			const projection = -transform.q.s * velocity.x + transform.q.c * velocity.y;
			const { pitTicks, pitServiced } = state;
			state = createOriginalState({
				x: transform.p.x * GetWorldScale(), y: -transform.p.y * GetWorldScale(), heading,
				speed: Math.hypot(velocity.x, velocity.y) * speedScale * (projection < 0 ? -1 : 1)
			});
			state.pitTicks = pitTicks;
			state.pitServiced = pitServiced;
			if (state.speed !== 0) {
				state.travelAngle = (Math.atan2(-velocity.x, velocity.y) * 180 / Math.PI +
					(state.speed < 0 ? 180 : 0) + 360) % 360;
			}
			state.damage = car.damage.map((damage) => Math.fround(damage * 3 / 100));
			b2Body_Disable(car.body.bodyId);
			b2Body_SetAngularVelocity(car.body.bodyId, 0);
		},
		leave() {
			b2Body_Enable(car.body.bodyId);
			b2Body_SetLinearVelocity(car.body.bodyId, velocityFromState());
			b2Body_SetAngularVelocity(car.body.bodyId, 0);
			car.lastVelocity = null;
		},
		beforeStep(input) {
			const nearbyWalls = (car.scene.originalWalls ?? []).filter((wall) =>
				wall.left <= state.x + 80 && wall.right >= state.x - 80 &&
				wall.top <= state.y + 80 && wall.bottom >= state.y - 80);
			stepOriginalPhysics(state, parameters, input, {
				...effectEnvironment(state),
				wallAt(x, y) {
					return nearbyWalls.some((wall) => x >= wall.left && x <= wall.right && y >= wall.top && y <= wall.bottom);
				},
				randomInt(maximum) {
					randomSeed = (Math.imul(randomSeed, 134775813) + 1) >>> 0;
					return Math.floor(randomSeed * maximum / 0x100000000);
				}
			});
			syncTransform();
		},
		stepBoxEffects(input) {
			const transform = b2Body_GetTransform(car.body.bodyId);
			const velocity = b2Body_GetLinearVelocity(car.body.bodyId);
			boxEffectsState.x = transform.p.x * GetWorldScale();
			boxEffectsState.y = -transform.p.y * GetWorldScale();
			boxEffectsState.heading = (Math.atan2(transform.q.s, transform.q.c) * 180 / Math.PI + 360) % 360;
			boxEffectsState.travelAngle = boxEffectsState.heading;
			boxEffectsState.speed = (-transform.q.s * velocity.x + transform.q.c * velocity.y) * speedScale;
			boxEffectsState.damage = car.damage.map((damage) => Math.fround(damage * 3 / 100));
			stepOriginalPhysics(boxEffectsState, parameters, input, effectEnvironment(boxEffectsState));
		},
		afterStep() {
			const damage = state.damage.map((value) => value * 100 / 3);
			if (damage.some((value, index) => value !== car.damage[index])) {
				car.damage = damage;
				car.updateDamage();
			}
			return Math.abs(state.speed) * ORIGINAL_SPEED_TO_KPH;
		}
	};
}