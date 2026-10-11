export const createTextInput = (scene, customConfig) => {
	const config = {
		x: 0,
		y: 0,
		zoneWidth: 120,
		text: "",
		allowedChars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789- ",
		maxLength: 16,
		changeCallback: (value) => { console.log("Text input value:", value); },
	}
	Object.assign(config, customConfig);

	const textInput = scene.add.bitmapText(config.x, config.y, "systemFont", config.text).setOrigin(0, 0);
	const inputZone = scene.add.zone(textInput.x, textInput.y, config.zoneWidth, 17).setOrigin(0, 0);

	let inputActive = false;
	let inputWasActive = false;
	const processedKeys = new WeakSet();
	const commit = () => {
		inputActive = false;
		inputWasActive = false;
		textInput.setText(config.text);
		config.changeCallback(config.text);
	};
	const pointerdown = (pointer) => {
		if (!inputZone.getBounds().contains(pointer.x, pointer.y)) {
			if (inputWasActive) commit();
			return;
		}
		if (inputActive) return;
		config.text = "";
		textInput.setText("_");
		inputActive = true;
		inputWasActive = true;
	};
	const keydown = (event) => {
		if (!inputActive) return;
		if (processedKeys.has(event)) return;
		processedKeys.add(event);
		if (event.key === "Enter") {
			commit();
			return;
		} else if (event.key === "Backspace") {
			config.text = config.text.slice(0, -1);
		} else if (event.key.length === 1 && config.allowedChars.includes(event.key) && config.text.length < config.maxLength) {
			config.text += event.key;
		}
		textInput.setText(config.text + "_");
	};
	scene.input.on("pointerdown", pointerdown);
	scene.input.keyboard.on("keydown", keydown);
	scene.events.once("shutdown", () => {
		scene.input.off("pointerdown", pointerdown);
		scene.input.keyboard.off("keydown", keydown);
	});

	return textInput;
}
