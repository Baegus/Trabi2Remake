export default class Preloader extends Phaser.Scene {
	constructor() {
		super({
			key: "preloader"
		});

	}

	preload() {

		// Load maps:
		const mapCount = 10;
		for (let i = 1; i <= mapCount; i++) {
			const filename = `Trat${i.toString().padStart(2, "0")}.map`;
			this.load.binary(filename, `trabi2data/${filename}`, Uint8Array);
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
			"POZ.FSF",
			"POZ2.FSF",

		];
		originalGraphicsFiles.forEach((filename) => {
			this.load.fsf(filename,`trabi2data/${filename}`);
		});

		// Load texture PKGs:
		const texturePackages = [
			"TEXTURY.PKG",  // default textures
			"TEXTURY2.PKG", // winter textures
		];
		texturePackages.forEach((filename) => {
			this.load.pkg(filename,`trabi2data/${filename}`);
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
			this.load.threeD(filename,`trabi2data/${filename}`);
		});

		// Load sounds and music from SNDs:
		const soundFiles = [
			// "INTRO.SND",  // intro sounds
			// "MENU.SND", // menu sounds
			"HUDBA.SND",  // music tracks
			// "TRABANT.SND", // engine sounds
		];
		soundFiles.forEach((filename) => {
			this.load.snd(filename,`trabi2data/${filename}`);
		});


		// Cheeky addition to the credits menu page:
		this.load.image("remakeCredits","img/remakeCredits.png");
	}

	create() {
		this.registry.set("currentMap",1); // DEBUG
		this.registry.set("totalTeams",6);
		this.registry.set("totalTires",3)
		this.registry.set("totalMaps",10);
		 // For whatever reason, tracks are out of order:
		this.registry.set("mapOrder",[7,8,1,5,6,9,4,3,10,2]);

		this.scene.start("mainMenu"); // DEBUG MAIN MENU
		// this.scene.start("singlePlayer"); // DEBUG SINGLEPLAYER MENU
		// this.scene.start("raceMenu"); // DEBUG RACE MENU
		// this.scene.start("race"); // DEBUG RACE
	}
}