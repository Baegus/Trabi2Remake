import { textToWholePixels } from "../../modules/utils";
import { playSound } from "../../modules/audio";
import { createCursor } from "../../modules/cursor";
import { createMenuButton } from "../../modules/menu";

export default class RaceMenu extends Phaser.Scene {
	constructor () {
		super({
			key: "raceMenu",
			maxLights: 30,
			physics: {
				arcade: {
					// debug: true
				},
				matter: {
					// debug: true,
					// gravity: { y: 0.5 }
				}
			}
		});
		this.spr = {};

	}

	preload() {
		
	}

	create() {
		this.events.off();

		const currentRaceType = this.registry.get("currentRaceType");
		const bg = this.add.image(0,0,"NEW.FGF").setOrigin(0,0);
		const cursor = createCursor(this);

		const defaultPlayerName = "Novy hrac";
		const defaultTeam = 0;
		const defaultMap = 0;

		// TODO: If game is loaded/in progress, load actual values from registry here:
		let playerName = defaultPlayerName;
		let team = defaultTeam;
		let map = defaultMap;



		// LEFT COLUMN:

		const teamThumbnails = this.add.image(148,46,"TYMY.FSF").setOrigin(0,0);
		const totalTeams = this.registry.get("totalTeams");
		const lastTeam = totalTeams-1;
		const teamsLocked = false; // TODO: set according to current cirmustances
		const setTeam = (offset=1,forceValue=false) => {
			if (teamsLocked && !forceValue) return;
			let selectedTeam = team+offset;
			if (forceValue) selectedTeam = offset
			if (selectedTeam > lastTeam) return;
			if (selectedTeam < 0) return;
			team = selectedTeam;
			const frame = teamsLocked ? selectedTeam+totalTeams : selectedTeam;
			teamThumbnails.setFrame(frame);
		};
		setTeam(team,true);
		const prevTeamButton = createMenuButton(this,{
			x: 111,
			y: 83,
			texture: "SIPKA1.FSF",
			clickCallback: () => {
				setTeam(-1);
			}
		});
		const nextTeamButton = createMenuButton(this,{
			x: 321,
			y: 84,
			texture: "SIPKA2.FSF",
			clickCallback: () => {
				setTeam(1);
			}
		});

		const carSettingsButton = createMenuButton(this,{
			x: 63,
			y: 184,
			texture: "NASVOZ.FSF",
			clickCallback: () => {
				this.scene.start("carSettingsMenu");
			}
		});

		// TODO player name input

		const easyDiffButton = createMenuButton(this,{
			x: 118,
			y: 304,
			texture: "SW1.FSF",
			clickCallback: () => {
				// easyDiffButton.setFrame(1);
			}
		});
		const mediumDiffButton = createMenuButton(this,{
			x: 191,
			y: 303,
			texture: "SW2.FSF",
			clickCallback: () => {
				// mediumDiffButton.setFrame(1);
			}
		});
		const hardDiffButton = createMenuButton(this,{
			x: 262,
			y: 303,
			texture: "SW3.FSF",
			clickCallback: () => {
				// hardDiffButton.setFrame(1);
			}
		});

		// RIGHT COLUMN:

		const mapThumbnails = this.add.image(404,91,"TRATE.FSF").setOrigin(0,0);
		const totalMaps = this.registry.get("totalMaps");
		const lastMap = totalMaps-1;
		const mapsLocked = false; // TODO: set according to current cirmustances
		const setMap = (offset=1,forceValue=false) => {
			if (mapsLocked && !forceValue) return;
			let selectedMap = map+offset;
			if (forceValue) selectedMap = offset
			if (selectedMap > lastMap) return;
			if (selectedMap < 0) return;
			map = selectedMap;
			this.registry.set("currentMap",map);
			const frame = mapsLocked ? selectedMap+totalMaps : selectedMap;
			mapThumbnails.setFrame(frame);
		};
		setMap(map,true);

		const prevMapButton = createMenuButton(this,{
			x: 371,
			y: 123,
			texture: "SIPKA3.FSF",
			clickCallback: () => {
				setMap(-1);
			}
		});
		const nextMapButton = createMenuButton(this,{
			x: 571,
			y: 126,
			texture: "SIPKA4.FSF",
			clickCallback: () => {
				setMap(1);
			}
		});

		const lessLapsButton = createMenuButton(this,{
			x: 532,
			y: 221,
			texture: "HVEZDA1.FSF",
			clickCallback: () => {
			}
		});
		const moreLapsButton = createMenuButton(this,{
			x: 570,
			y: 221,
			texture: "HVEZDA2.FSF",
			clickCallback: () => {
			}
		});
		// TODO: Display and set text values

		const lessOpponentsButton = createMenuButton(this,{
			x: 532,
			y: 250,
			texture: "HVEZDA3.FSF",
			clickCallback: () => {
			}
		});
		const moreOpponentsButton = createMenuButton(this,{
			x: 570,
			y: 250,
			texture: "HVEZDA4.FSF",
			clickCallback: () => {
			}
		});
		// TODO: Display and set text values
		

		const saveButton = createMenuButton(this,{
			x: 407,
			y: 299,
			texture: "SAVE.FSF",
			clickCallback: () => {
			}
		});


		// BOTTOM ROW:

		const backButton = createMenuButton(this,{
			x: 53,
			y: 369,
			texture: "BACK2.FSF",
			clickCallback: () => {
				this.scene.start("singlePlayerMenu");
			}
		});

		const standingsButton = createMenuButton(this,{
			x: 202,
			y: 396,
			texture: "KLASIF.FSF",
			clickCallback: () => {
			}
		});

		const startRaceButton = createMenuButton(this,{
			x: 469,
			y: 367,
			texture: "GAME.FSF",
			clickCallback: () => {
				this.scene.start("race");
			}
		});


	}
		
}