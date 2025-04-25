// src/index.ts
import fs from "node:fs";
import path from "node:path";
import { yellow } from "kleur/colors";
import { parseCliOptions } from "./cli";
import { loadConfig } from "./config";
import { initializeProvider } from "./fileProcessor";
import type { Config, Options } from "./types"; // Keep necessary type imports
import { startWatcher } from "./watcher";

// Main application function
async function main() {
	// 1. Load configuration
	const config: Config = await loadConfig();

	// 2. Parse Command Line Options (passing config for defaults)
	const options: Options = parseCliOptions(config);

	// 3. Initialize the AI provider (e.g., OpenAI)
	initializeProvider(config, options); // Stores the renamer instance internally for processFile

	// 4. Setup Output Directories
	const outputDir = options.outdir; // Already resolved path
	const originalDir = path.join(outputDir, "original"); // Backup directory

	// Ensure output directory exists
	if (!fs.existsSync(outputDir)) {
		console.log(`Creating output directory: ${yellow(outputDir)}`);
		fs.mkdirSync(outputDir, { recursive: true });
	}

	// Ensure category directories exist
	if (config.categories) {
		for (const category in config.categories) {
			const categoryDir = path.join(outputDir, category);
			if (!fs.existsSync(categoryDir)) {
				console.log(`Creating category directory: ${yellow(categoryDir)}`);
				fs.mkdirSync(categoryDir, { recursive: true });
			}
		}
	} else {
		console.warn("No categories defined in configuration.");
	}

	// Ensure 'original' backup directory exists
	if (!fs.existsSync(originalDir)) {
		console.log(`Creating backup directory: ${yellow(originalDir)}`);
		fs.mkdirSync(originalDir, { recursive: true });
	}

	// 5. Start the watcher (which also handles retroactive processing)
	await startWatcher(options, config, outputDir, originalDir);

	// The application will now run indefinitely if --watch is enabled,
	// or exit via startWatcher/queue logic if only --retroactive is used.
}

// Execute the main function and catch any top-level errors
main().catch((error) => {
	console.error("An unexpected error occurred:", error);
	process.exit(1);
});
