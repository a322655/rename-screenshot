// src/watcher.ts
import fs from "node:fs";
import path from "node:path";
import async from "async";
import chokidar from "chokidar";
import { yellow } from "kleur/colors";
import { processFile } from "./fileProcessor";
import type { Config, Options } from "./types";
import { compileRegexStringOrFail } from "./utils";

export async function startWatcher(
	options: Options,
	config: Config,
	outputDir: string,
	originalDir: string,
) {
	// Determine the final regex string (CLI option takes precedence)
	const finalRegexString = options.fileNameRegex || config.fileNameRegex;

	// Compile the regex, exiting on failure
	const fileNameRegex = compileRegexStringOrFail(finalRegexString);
	console.log(`Using file matching pattern: ${fileNameRegex}`);

	const watchPath = options.watchdir;

	// Ensure watch directory exists and is a directory
	try {
		const stats = await fs.promises.lstat(watchPath);
		if (!stats.isDirectory()) {
			console.error(`Watch path ${watchPath} is not a directory.`);
			process.exit(1);
		}
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			console.error(`Watch directory ${watchPath} doesn't exist.`);
		} else {
			console.error(`Error accessing watch directory ${watchPath}:`, error);
		}
		process.exit(1);
	}

	// Set up the processing queue
	const queue = async.queue<string>((filePath, callback) => {
		processFile(filePath, options, config, outputDir, originalDir)
			.then(() => callback()) // Signal completion
			.catch((err) => callback(err)); // Signal error
	}, 1); // Process one file at a time

	queue.drain(() => {
		console.log("All currently queued screenshots have been processed.");
		// Exit only if not in watch mode after processing retroactive files
		if (!options.watch && queue.idle()) {
			console.log("Exiting as --watch mode is not enabled and queue is empty.");
			process.exit(0);
		}
	});

	// Handle retroactive processing
	if (options.retroactive) {
		console.log(
			`Checking for existing files matching ${fileNameRegex} in ${yellow(watchPath)}...`,
		);
		try {
			const files = await fs.promises.readdir(watchPath);
			let filesToProcessCount = 0;
			for (const file of files) {
				const filePath = path.join(watchPath, file);
				try {
					const fileStats = await fs.promises.lstat(filePath);
					if (fileStats.isFile() && fileNameRegex.test(file)) {
						// Add to queue only if it's a file and matches the regex pattern
						queue.push(filePath);
						filesToProcessCount++;
					}
				} catch (statError) {
					console.warn(
						`Could not stat file ${filePath}, skipping. Error: ${statError}`,
					);
				}
			}

			if (filesToProcessCount > 0) {
				console.log(
					`Added ${filesToProcessCount} existing file(s) to the processing queue.`,
				);
			} else {
				console.log(
					"No existing files matching the pattern found to process retroactively.",
				);
				// If no files found and not watching, exit after queue drains (which should be immediate)
				if (!options.watch && queue.idle()) {
					console.log(
						"Exiting as no retroactive files found and --watch is not enabled.",
					);
					process.exit(0);
				}
			}
		} catch (readDirError) {
			console.error(
				`Error reading directory ${watchPath} for retroactive processing:`,
				readDirError,
			);
			// Decide if this is fatal or if watching can still proceed
			if (!options.watch) {
				process.exit(1); // Exit if not watching and cannot process retroactively
			}
		}
	} else if (!options.watch) {
		// This case should be caught by CLI validation, but added for safety
		console.log("Neither --retroactive nor --watch specified. Nothing to do.");
		process.exit(0);
	}

	// Start watching if requested
	if (options.watch) {
		console.log(
			`Watching for new files matching ${fileNameRegex} in ${yellow(watchPath)}...`,
		);
		const watcher = chokidar.watch(watchPath, {
			persistent: true,
			ignoreInitial: true, // Don't process files already there unless --retroactive is used
			depth: 0, // Don't watch subdirectories
			awaitWriteFinish: {
				stabilityThreshold: 2000, // Wait for file write to complete
				pollInterval: 500,
			},
		});

		watcher
			.on("add", (filePath) => {
				const filename = path.basename(filePath);
				// Check if it matches the pattern before adding to queue
				if (fileNameRegex.test(filename)) {
					console.log(
						`New matching file detected: ${yellow(filename)}. Adding to queue.`,
					);
					queue.push(filePath);
				} else {
					// console.log(`Ignoring non-matching file: ${filename}`);
				}
			})
			.on("error", (error) => {
				console.error(`Watcher error for ${watchPath}: ${error}`);
				// Consider if the watcher should attempt to restart or exit
			});

		// Keep the process running while watching
		// No explicit process.exit(0) needed here as the watcher keeps it alive.
	}
}
