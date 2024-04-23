const toggleMute = (scene) => {
	const muted = scene.sound.mute;
	const newState = !muted;
	scene.sound.setMute(newState);
	return newState;
}

const playSound = (scene, name, config=false) => {
	if (scene.sound.mute) return;
	const {rng,sound} = scene;
	const sample = sound.add(name,{
		loop: config.loop || false
	});
	let targetVolume = 1;
	let targetRate = 1;
	if (config) {
		if (config.pitch?.length === 2) {
			targetRate = rng.realInRange(config.pitch[0],config.pitch[1]);
		}
		if (config.pitch?.length === 1) {
			targetRate = config.pitch[0];
		}
		if (config.volume?.length === 2) {
			targetVolume = rng.realInRange(config.volume[0],config.volume[1]);
		}
		if (config.volume?.length === 1) {
			targetVolume = config.volume[0];
		}
	}
	if (scene.sound.mute) {
		targetVolume = 0;
	}
	sample.setRate(targetRate);
	sample.fadeIn = (duration=500) => {
		if (scene.sound.mute) return;
		const helper = {
			value: 0
		};
		const fadeTween = scene.tweens.add({
			targets: helper,
			value: targetVolume,
			duration: duration,
			ease: "Sine.easeIn",
			onUpdate: () => {
				sample.setVolume(helper.value);
			}
		});
	}
	sample.fadeOut = (duration=500) => {
		if (scene.sound.mute) return;
		const helper = {
			value: sample.volumeNode.gain.value || 1
		};
		const fadeTween = scene.tweens.add({
			targets: helper,
			value: 0,
			duration: duration,
			ease: "Sine.easeOut",
			onUpdate: () => {
				sample.setVolume(helper.value);
			},
			onComplete: () => {
				sample.setVolume(0);
				sample.destroy();
			}
		});
	}
	if (config.fadeIn) {
		sample.setVolume(0);
		sample.fadeIn(config.fadeInTime);
	} else {
		sample.setVolume(targetVolume);
	}
	sample.play();
	return sample;
}

export { toggleMute, playSound }