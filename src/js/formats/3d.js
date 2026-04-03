class ThreeDFile extends Phaser.Loader.FileTypes.BinaryFile {
	constructor(loader, key, url, xhrSettings) {
		super(loader, key, url, xhrSettings);
		this.key = key;
	}

	async processModel(data) {
		const view = new DataView(data.buffer);
		let offset = 0;

		const numBlocks = view.getUint8(offset++);
		const meshes = {}; // Group vertices and UVs by texture ID

		for (let i = 0; i < numBlocks; i++) {
			const vertices = [];
			for (let v = 0; v < 8; v++) {
				const x = view.getInt16(offset, true); offset += 2;
				const y = view.getInt16(offset, true); offset += 2;
				const z = view.getInt16(offset, true); offset += 2;
				offset += 4;
				// Following the viewer's coordinate mapping: x, z, -y
				vertices.push({ x: x, y: z, z: -y });
			}

			const faceTex = [
				view.getUint8(offset++), // Top
				view.getUint8(offset++), // Front
				view.getUint8(offset++), // Back
				view.getUint8(offset++), // Left
				view.getUint8(offset++)  // Right
			];

			const faces = [
				{ name: "Top", indices: [4, 5, 7, 6], texId: faceTex[0] },
				{ name: "Left", indices: [0, 4, 6, 2], texId: faceTex[3] },
				{ name: "Right", indices: [1, 5, 7, 3], texId: faceTex[4] },
				{ name: "Front", indices: [0, 1, 5, 4], texId: faceTex[1] },
				{ name: "Back", indices: [2, 3, 7, 6], texId: faceTex[2] },
				{ name: "Bottom", indices: [0, 1, 3, 2], texId: 0 } // Untextured
			];

			faces.forEach((face) => {
				if (face.texId === 0) return;

				if (!meshes[face.texId]) {
					meshes[face.texId] = {
						positions: [],
						uvs: []
					};
				}

				const target = meshes[face.texId];
				const v0 = vertices[face.indices[0]];
				const v1 = vertices[face.indices[1]];
				const v2 = vertices[face.indices[2]];
				const v3 = vertices[face.indices[3]];

				// First triangle of the quad
				target.positions.push(
					v0.x, v0.y, v0.z,
					v1.x, v1.y, v1.z,
					v2.x, v2.y, v2.z
				);
				target.uvs.push(0, 1, 1, 1, 1, 0);

				// Second triangle of the quad
				target.positions.push(
					v0.x, v0.y, v0.z,
					v2.x, v2.y, v2.z,
					v3.x, v3.y, v3.z
				);
				target.uvs.push(0, 1, 1, 0, 0, 0);
			});
		}
		
		return meshes;
	};


	async onProcess() {
		const data = new Uint8Array(this.xhrLoader.response);
		this.data = await this.processModel(data);
		this.onProcessComplete();
	}

}

export default class ThreeDPlugin extends Phaser.Plugins.BasePlugin {

	constructor(pluginManager) {
		super(pluginManager);
		pluginManager.registerFileType("threeD", this.fileCallback);
		
		pluginManager.registerGameObject("model3D", function(x, y, modelKey, texturePackage = "TEXTURY.PKG") {
			const meshData = this.scene.cache.binary.get(modelKey);
			if (!meshData) {
				console.error(`3D Model ${modelKey} not found in cache. Did you load it?`);
				return null;
			}

			// A container group for the mesh parts (one mesh per unique texture)
			const wallContainer = new Phaser.GameObjects.Container(this.scene, x, y);
			this.displayList.add(wallContainer);

			for (const [texId, data] of Object.entries(meshData)) {
				// Mesh requires an active texture, we construct it based on the texture package and the texture ID loaded
				const textureKey = `${texturePackage}-${texId}`;
				const mesh = new Phaser.GameObjects.Mesh(this.scene, 0, 0, textureKey);
				
				// Map geometry into the Phaser Mesh (passing true for containsZ)
				mesh.addVertices(data.positions, data.uvs, undefined, true);
				let fov = 50; // Phaser's default is often ~45-60 deg
				// Push the model into the scene. For proper perspective without base parallax,
				// the panZ should be such that 1 unit in vertex = 1 unit in pixels.
				// This usually aligns well when the model Z and camera Fov distances form a 1:1 ratio.
				mesh.panZ(500); 

				// Add to our main container
				wallContainer.add(mesh);
			}

			this.scene.events.on('update', () => {
				const cam = this.scene.cameras.main;
				const cw = cam.width / 2;
				const ch = cam.height / 2;
				const cx = cam.scrollX + cw;
				const cy = cam.scrollY + ch;

				wallContainer.list.forEach(mesh => {
					// To get 3D perspective based on screen position,
					// offset the mesh's 3D modelPosition by its distance from the camera center,
					// and counteract that offset in 2D space so it stays in the correct world position.
					const dx = wallContainer.x - cx;
					const dy = wallContainer.y - cy;
					
					mesh.modelPosition.x = dx;
					mesh.modelPosition.y = dy;
					
					mesh.x = -dx;
					mesh.y = -dy;
				});
			});

			return wallContainer;
		});
	}

	fileCallback(key, url, xhrSettings) {
		this.addFile(new ThreeDFile(this, key, url, xhrSettings));
		return this;
	}

}
