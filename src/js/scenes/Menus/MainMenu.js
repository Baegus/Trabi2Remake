import { textToWholePixels } from "../../modules/utils";
import { playSound, playMusicTrack } from "../../modules/audio";
import { createCursor } from "../../modules/cursor";
import { createMenuButton } from "../../modules/menu";

export default class MainMenu extends Phaser.Scene {
	constructor () {
		super({
			key: "mainMenu",
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
		const bg = this.add.image(0,0,"MAIN.FGF").setOrigin(0,0);

		
		const cursor = createCursor(this);

		const cursorTooltip = this.add.image(cursor.x,cursor.y,"POPISKY.FSF",0);
		cursorTooltip.setAlpha(0).setDepth(cursor.depth);

		this.input.on("pointermove",(p) => {
			cursorTooltip.x = p.x+53;
			cursorTooltip.y = p.y+12;
		});
		
		const singlePlayerButton = createMenuButton(this,{
			x: 259,
			y: 154,
			texture: "SINGLE.FSF",
			tooltipObject: cursorTooltip,
			tooltipFrame: 0,
			clickCallback: () => {
				this.scene.start("singlePlayerMenu");
			}
		});
		const multiPlayerButton = createMenuButton(this,{
			x:371,
			y:149,
			texture: "MULTI.FSF",
			tooltipObject: cursorTooltip,
			tooltipFrame:1
		});
		const optionsButton = createMenuButton(this,{
			x:487,
			y:147,
			texture: "OPTIONS.FSF",
			tooltipObject: cursorTooltip,
			tooltipFrame:2
		});
		const creditsButton = createMenuButton(this,{
			x:302,
			y:253,
			texture: "CREDITS.FSF",
			tooltipObject: cursorTooltip,
			tooltipFrame:3,
			clickCallback: () => {
				this.scene.start("creditsMenu");
			}
		});
		const exitButton = createMenuButton(this,{
			x:420,
			y:256,
			texture: "EXIT.FSF",
			tooltipObject: cursorTooltip,
			tooltipFrame:4,
			clickCallback: () => {
				alert("Just close the tab. :)");
			}
		});

		playMusicTrack(this,2);
	}
		
}