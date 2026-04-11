const debugging = process.env.DEBUG == "true";

export default class Preloader extends Phaser.Scene {
	constructor() {
		super({
			key: "preloader"
		});

	}

	preload() {
		const scene = this;
		scene.loadingStartTime = performance.now();

		// Load maps:
		const mapCount = 10;
		for (let i = 1; i <= mapCount; i++) {
			const filename = `Trat${i.toString().padStart(2, "0")}.map`;
			const filenameUpper = filename.toUpperCase();
			// 3DM files (model placements):
			const modelPlacementFilename = filenameUpper.replace(".MAP", ".3DM");
			scene.load.binary(filename, `trabi2data/${filename}`, Uint8Array);
			scene.load.binary(modelPlacementFilename, `trabi2data/${modelPlacementFilename}`, Uint8Array);
			// IL1/IL2 files (AI node definitions):
			const il1Filename = filename.replace(".map", ".il1");
			const il2Filename = filename.replace(".map", ".il2");
			scene.load.binary(il1Filename, `trabi2data/${il1Filename}`, Uint8Array);
			scene.load.binary(il2Filename, `trabi2data/${il2Filename}`, Uint8Array);
			// SP1/SP2 files (additional sprite positions, from ONIKY.FSF and DIVACI.FSF):
			const sp1Filename = filename.replace(".map", ".sp1");
			const sp2Filename = filename.replace(".map", ".sp2");
			scene.load.binary(sp1Filename, `trabi2data/${sp1Filename}`, Uint8Array);
			scene.load.binary(sp2Filename, `trabi2data/${sp2Filename}`, Uint8Array);
		}

		// Load FGFs and FSFs:
		const originalGraphicsFiles = [
			// MOUSE CURSOR:
			"KURZOR.FSF",



			// MAIN MENU:
			"MAIN.FGF",    // background image
			"POPISKY.FSF", // mouse cursor text tooltips (titles)
			"SINGLE.FSF",  // singleplayer button
			"MULTI.FSF",   // multiplayer button
			"OPTIONS.FSF", // options button
			"CREDITS.FSF", // credits button
			"EXIT.FSF",    // exit button

			// SINGLEPLAYER RACE MODE MENU:
			"SINGLE.FGF",   // background image
			"CHAMPION.FSF", // championship button
			"FREE.FSF",     // free race button
			"GHOST.FSF",    // ghost race button
			"BACK.FSF",     // return back button

			// RACE MENU:
			"NEW.FGF",     // background image
			"SIPKA1.FSF",  // prev arrow button (team selector)
			"SIPKA2.FSF",  // next arrow button (team selector)
			"SIPKA3.FSF",  // prev arrow button (map selector)
			"SIPKA4.FSF",  // next arrow button (map selector)
			"NASVOZ.FSF",  // car settings button
			"SAVE.FSF",    // save button
			"KLASIF.FSF",  // current standings button
			"BACK2.FSF",   // return back button
			"GAME.FSF",    // start race button
			"HVEZDA1.FSF", // star icon - prev (laps selector)
			"HVEZDA2.FSF", // star icon - next (laps selector)
			"HVEZDA3.FSF", // star icon - prev (opponents selector)
			"HVEZDA4.FSF", // star icon - next (opponents selector)
			"SW1.FSF",     // switch - radio button (easy difficulty selector)
			"SW2.FSF",     // switch - radio button (medium difficulty selector)
			"SW3.FSF",     // switch - radio button (hard difficulty selector)
			"TRATE.FSF",   // map selector thumbnails
			"TYMY.FSF",    // team selector thumbnails

			// CAR SETTINGS MENU:
			"CAROPT.FGF",  // background image
			"SIPKA5.FSF",  // prev arrow button (tires selector)
			"SIPKA6.FSF",  // next arrow button (tires selector)
			"POSUV1.FSF",  // slider thumb (transmission slider)
			"POSUV2.FSF",  // slider thumb (brakes slider)
			"PNEU.FSF",    // tire selector thumbnails
			"OK.FSF",      // OK/back button






			// "SW4.FSF",     // switch - on/off


			// CREDITS MENU:
			"CREDITS.FGF",     // background image
			"OK5.FSF",         // OK/back button

			// MAP TILES:
			"POZ.FSF", // default map tiles
			"POZ2.FSF", // winter map tiles

			// ADDITIONAL OVERLAY MAP TILES:
			"ONIKY.FSF",   // sprites with positions defined in SP1 files
			"ONIKY2.FSF",   // winter sprites with positions defined in SP1 files
			"DIVACI.FSF",  // spectator sprites with positions defined in SP2 files

			// CAR SPRITES:
			"TRABANT.FSF", // all Trabant sprites

			// HUD:
			"FONT.FSF",   // number font (red + gray)
			"TACHO.FSF", // speedometer
			"OBRYSY.FSF", // car damage indicators


		];
		originalGraphicsFiles.forEach((filename) => {
			scene.load.fsf(filename,`trabi2data/${filename}`);
		});

		// Load texture PKGs:
		const texturePackages = [
			"TEXTURY.PKG",  // default textures
			"TEXTURY2.PKG", // winter textures
		];
		texturePackages.forEach((filename) => {
			scene.load.pkg(filename,`trabi2data/${filename}`);
		});

		// Load 3D models:
		const modelFiles = [
			"BOARD1H.3D",
			"BOARD1V.3D",
			"BOARD2H.3D",
			"BOARD2V.3D",
			"BOARD3H.3D",
			"BOARD3V.3D",
			"DEPO8.3D",
			"MAN1H.3D",
			"MAN1V.3D",
			"MAN2H.3D",
			"MAN2V.3D",
			"SLOUPEK.3D",
			"VEZ.3D",
		];
		modelFiles.forEach((filename) => {
			scene.load.threeD(filename,`trabi2data/${filename}`);
		});

		// Load road curbs bitmask:
		const roadMaskFile = scene.load.syn("POZ.SYN", `trabi2data/POZ.SYN`);

		// Load sounds and music from SNDs:
		const soundFiles = [
			// "INTRO.SND",  // intro sounds
			// "MENU.SND", // menu sounds
			"HUDBA.SND",  // music tracks
			// "TRABANT.SND", // engine sounds
		];
		soundFiles.forEach((filename) => {
			scene.load.snd(filename,`trabi2data/${filename}`);
		});


		// Cheeky addition to the credits menu page:
		scene.load.image("remakeCredits","img/remakeCredits.png");

		// System font for player names and messages:
		scene.load.image("systemFont", "img/systemFont.png");
		
	}

	async create() {
		const scene = this;
		const endTime = performance.now();
		console.log(`All files loaded in ${(endTime - scene.loadingStartTime).toFixed(2)} ms`);
		scene.registry.set("currentMap",3); // DEBUG
		scene.registry.set("totalTeams",6);
		scene.registry.set("totalTires",3)
		scene.registry.set("totalMaps",10);
		 // For whatever reason, tracks are out of order:
		scene.registry.set("mapOrder",[7,8,1,5,6,9,4,3,10,2]);
		const numbers = "0123456789";
		const systemFontConfig = {
			image: "systemFont",
			width: 8,
			height: 8,
			charsPerRow: 67,
			chars: `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz${numbers} -_:.`,
		};
		scene.cache.bitmapFont.add("systemFont", Phaser.GameObjects.RetroFont.Parse(scene, systemFontConfig));
		// Create two HUD bitmap fonts (red and gray) from a single image that has
		// one character per row: red characters first, then gray ones.
		const charsRed = `${numbers}:.`;
		const charsGray = `${numbers}/`;
		const charW = 9;
		const charH = 16;
		const redCount = charsRed.length;
		const grayCount = charsGray.length;

		const srcTexture = scene.textures.get("FONT.FSF");
		const srcImage = srcTexture.getSourceImage();

		// Helper to create a texture from a slice of the source image
		const makeFontFromSlice = async (key, srcY, count, chars) => {
			const canvas = document.createElement("canvas");
			canvas.width = charW;
			canvas.height = charH * count;
			const ctx = canvas.getContext("2d");
			// sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight
			ctx.drawImage(srcImage, 0, srcY, charW, charH * count, 0, 0, charW, charH * count);

			// Special-case: for the red HUD font, shift ':' and '.' 1px to the left
			if (key === "HUDFontRed") {
				const shiftChars = [":", "."];
				// find indices within the provided chars string
				const indices = shiftChars
					.map(c => chars.indexOf(c))
					.filter(i => i >= 0);

				indices.forEach((index) => {
					const rowY = index * charH;
					// copy source row (except the last column) to a temp canvas
					const tmp = document.createElement("canvas");
					tmp.width = Math.max(0, charW - 1);
					tmp.height = charH;
					const tctx = tmp.getContext("2d");
					// copy left (charW - 1) pixels of the row
					if (tmp.width > 0) tctx.drawImage(canvas, 0, rowY, tmp.width, charH, 0, 0, tmp.width, charH);
					// clear original row
					ctx.clearRect(0, rowY, charW, charH);
					if (tmp.width > 0) ctx.drawImage(tmp, 0, 0, tmp.width, charH, -1, rowY, tmp.width, charH);
				});
			}

			// add the canvas as a texture key and parse as RetroFont
			const textureKey = `fontSlice_${key}`;
			scene.textures.addImage(textureKey, canvas);
			const cfg = {
				image: textureKey,
				width: charW,
				height: charH,
				charsPerRow: 1,
				chars: chars
			};
			scene.cache.bitmapFont.add(key, Phaser.GameObjects.RetroFont.Parse(scene, cfg));
		};

		makeFontFromSlice("HUDFontRed", 0, redCount, charsRed);
		makeFontFromSlice("HUDFontGray", charH * redCount, grayCount, charsGray);

		// scene.scene.start("mainMenu"); // DEBUG MAIN MENU
		// scene.scene.start("singlePlayer"); // DEBUG SINGLEPLAYER MENU
		// scene.scene.start("raceMenu"); // DEBUG RACE MENU
		scene.scene.start("race"); // DEBUG RACE
	}
}