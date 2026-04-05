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
				const y = -view.getInt16(offset, true); offset += 2;
				const z = view.getInt16(offset, true); offset += 2;
				offset += 4;

				vertices.push({ x: x, y: y, z: z });
			}

			const faceTex = [
				view.getUint8(offset++), // Top (Index 0)
				view.getUint8(offset++), // Front (Index 1)
				view.getUint8(offset++), // Back (Index 2)
				view.getUint8(offset++), // Left (Index 3)
				view.getUint8(offset++)  // Right (Index 4)
			];

			const faces = [
				{ name: "Top", indices: [4, 5, 7, 6], texId: faceTex[2] },
				{ name: "Left", indices: [2, 0, 4, 6], texId: faceTex[1] },
				{ name: "Right", indices: [1, 3, 7, 5], texId: faceTex[1] },
				{ name: "Front", indices: [0, 1, 5, 4], texId: faceTex[3] },
				{ name: "Back", indices: [3, 2, 6, 7], texId: faceTex[4] },
				{ name: "Bottom", indices: [0, 2, 3, 1], texId: 0 }
			];

			faces.forEach((face) => {
				if (face.texId === 0) return;

				if (!meshes[face.texId]) {
					meshes[face.texId] = { positions: [], uvs: [] };
				}

				const target = meshes[face.texId];
				const v0 = vertices[face.indices[0]];
				const v1 = vertices[face.indices[1]];
				const v2 = vertices[face.indices[2]];
				const v3 = vertices[face.indices[3]];

				const addTriangle = (p0, p1, p2, u0x, u0y, u1x, u1y, u2x, u2y) => {
					// Front side
					target.positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
					target.uvs.push(u0x, u0y, u1x, u1y, u2x, u2y);

					// Back side (Reverse the vertex order and matching UVs)
					target.positions.push(p2.x, p2.y, p2.z, p1.x, p1.y, p1.z, p0.x, p0.y, p0.z);
					target.uvs.push(u2x, u2y, u1x, u1y, u0x, u0y);
				};

				// Triangle 1
				addTriangle(v0, v1, v2, 0, 1, 1, 1, 1, 0);

				// Triangle 2
				addTriangle(v0, v2, v3, 0, 1, 1, 0, 0, 0);
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

		pluginManager.registerGameObject("model3D", function (x, y, modelKey, texturePackage = "TEXTURY.PKG") {
			const meshData = this.scene.cache.binary.get(modelKey);
			if (!meshData) {
				console.error(`3D Model ${modelKey} not found in cache. Did you load it?`);
				return null;
			}

			const wallContainer = new Phaser.GameObjects.Container(this.scene, x, y);
			this.displayList.add(wallContainer);

			const fov = 45; // Phaser's default Mesh FOV
			const gameHeight = this.scene.scale.height;
			const perfectPanZ = ((gameHeight / 2) / Math.tan(Phaser.Math.DegToRad(fov / 2))) * 2;

			const meshes = [];
			const zScale = fov * 0.1;

			for (const [texId, data] of Object.entries(meshData)) {
				const textureKey = `${texturePackage}-${texId}`;
				// scale raw positions (x,y,z) by zScale for z component
				const raw = data.positions;
				const scaled = new Array(raw.length);
				for (let i = 0; i < raw.length; i += 3) {
					scaled[i] = raw[i];
					scaled[i + 1] = raw[i + 1];
					scaled[i + 2] = raw[i + 2] * zScale;
				}
				const uvs = data.uvs;

				const mesh = new Phaser.GameObjects.Mesh(this.scene, 0, 0, textureKey);
				mesh.addVertices(scaled, uvs, undefined, true);
				mesh.panZ(perfectPanZ);
				wallContainer.add(mesh);
				meshes.push(mesh);
			}

			const updatePerspective = () => {
				if (!wallContainer.scene) return;

				const camera = wallContainer.scene.cameras.main;

				const dx = wallContainer.x - camera.midPoint.x;
				const dy = (wallContainer.y - camera.midPoint.y);

				for (const mesh of meshes) {
					mesh.x = -dx;
					mesh.y = -dy;
					mesh.modelPosition.x = dx;
					mesh.modelPosition.y = -dy;
				}
			};

			updatePerspective();

			this.scene.events.on("preupdate", updatePerspective);

			wallContainer.on("destroy", () => {
				this.scene.events.off("preupdate", updatePerspective);
			});

			return wallContainer;
		});
	}

	fileCallback(key, url, xhrSettings) {
		this.addFile(new ThreeDFile(this, key, url, xhrSettings));
		return this;
	}
}