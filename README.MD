# Trabi 2 Phaser Remake

This project aims to re-implement the 2001 freeware game ["Trabi II: Pohár míru a přátelství"](https://visiongame.cz/hra/trabi-ii-pohar-miru-a-pratelstvi/) (made by [PupWorx](https://visiongame.cz/studio/pupworx/)) in the [Phaser](https://phaser.io) game engine.

The goal of this project is **NOT a full decompilation** or a 1:1 replication of the original game. However, it does load the original game files in their original formats and attempts to closely mimic the original game's look and feel.


## Progress

### File formats 
 - [x] **FGF** *(full-screen 640x480 graphics for intros, backgrounds etc.)*
 - [x] **FSF** *(sprite/atlas graphics)*
 - [x] **MNU** *(definitions of menu screens)*
 - [x] **PKG** *(textures for 3D models, pretty much identical to FGF files)*
 - [x] **MAP** *(level/track tilesets)*
 - [x] **3D** *(3D objects)*
 - [x] **3DM** *(positions of 3D models within each track)*
 - [x] **GHO** *(lap times for the Ghost Race mode)*
 - [x] **IL1, IL2** *(AI node positions)*
 - [x] **TRR** *(replay data - fully parsed, but not yet implemented)*
 - [x] **SND** *(sounds and music)*
 - [ ] **SAV** *(save files); ~50% progress - not necessary for this project, saving is handled via localStorage*
 - [ ] **SB** *(probably just a list of all assets - not necessary for this project)*
 - [x] **LAP** *(coordinates of track checkpoints - finish line, a mid-track checkpoint and the repair depo)*
 - [x] **PAR** *(car parameters; ~95 progress)*
 - [x] **SP1, SP2** *(positions of additional sprites from ONIKY.FSF and DIVACI.FSF)*
 - [x] **SYN** *(bitmask tiles for defining track turns)*
