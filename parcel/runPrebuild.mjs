import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

async function normalizeFilenames(directory) {
	const entries = await fs.readdir(directory, { withFileTypes: true });
	const uppercaseNames = new Set();
	for (const entry of entries) {
		const uppercaseName = entry.name.toUpperCase();
		if (uppercaseNames.has(uppercaseName)) {
			throw new Error(`Uppercase filename collision in ${directory}: ${uppercaseName}`);
		}
		uppercaseNames.add(uppercaseName);
	}
	for (const entry of entries) {
		const filename = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			await normalizeFilenames(filename);
		} else if (entry.isFile() && entry.name !== entry.name.toUpperCase()) {
			const temporaryFilename = path.join(directory, `.uppercase-${randomUUID()}`);
			await fs.rename(filename, temporaryFilename);
			try {
				await fs.rename(temporaryFilename, path.join(directory, entry.name.toUpperCase()));
			} catch (error) {
				await fs.rename(temporaryFilename, filename);
				throw error;
			}
		}
	}
}

async function runPrebuild() {
	try {
		await normalizeFilenames('./static/trabi2data');
		console.log('trabi2data filenames normalized to uppercase.');
		try {
			await fs.access('./dist');
			console.log('Removing existing dist folder...');
			await fs.rm('./dist', { recursive: true, force: true });
			console.log('dist folder removed successfully.');
		} catch (error) {
			console.log('No existing dist folder found.');
		}
	} catch (error) {
		console.error('Error during prebuild:', error);
		process.exit(1);
	}
}

runPrebuild();