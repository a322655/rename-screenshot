// src/fileProcessor.ts
import fs from "node:fs";
import path from "node:path";
import { yellow } from "kleur/colors";
import { OllamaProvider } from "./providers/OllamaProvider";
import { OpenAIProvider } from "./providers/OpenAIProvider";
import type { ScreenshotRenamer } from "./providers/ScreenshotRenamer";
import type { Config, Options, ProviderOptions } from "./types";
import {
	compileRegexStringOrFail,
	getDateFromScreenshot,
	renameFile,
} from "./utils";

let renamer: ScreenshotRenamer;

export function initializeProvider(
	config: Config,
	options: Options,
): ScreenshotRenamer {
	const providerOpt = options.provider.toLowerCase();
	const providerConfig = config[
		providerOpt as keyof Config // Type assertion
	] as ProviderOptions;

	if (providerOpt === "openai") {
		try {
			renamer = new OpenAIProvider(
				providerConfig,
				config.finalPrompt || "", // Use the final prompt from config
				config.categories || {},
			);
			return renamer;
		} catch (error) {
			if (error instanceof Error) {
				console.error(`Error initializing OpenAI provider: ${error.message}`);
			} else {
				console.error("Unknown error initializing OpenAI provider");
			}
			process.exit(1);
		}
	} else if (providerOpt === "ollama") {
		try {
			renamer = new OllamaProvider(
				providerConfig,
				config.finalPrompt || "", // Use the same final prompt
				config.categories || {},
			);
			return renamer;
		} catch (error) {
			if (error instanceof Error) {
				console.error(`Error initializing Ollama provider: ${error.message}`);
			} else {
				console.error("Unknown error initializing Ollama provider");
			}
			process.exit(1);
		}
	} else {
		// This part should technically be unreachable due to CLI checks
		// but is kept for robustness or future expansion.
		console.error(
			`Provider ${providerOpt} is not supported or implemented yet.`,
		);
		process.exit(1);
	}
}

/**
 * Generate a new filename, backup original, rename and move file to new path
 * @param filePath - Path to the screenshot file
 * @param options - CLI options
 * @param config - Application configuration
 * @param outputDir - The base output directory
 * @param originalDir - The directory to back up original files
 */
export async function processFile(
	filePath: string,
	options: Options,
	config: Config,
	outputDir: string,
	originalDir: string,
): Promise<void> {
	const origFilename = path.basename(filePath);

	// Determine the final regex string (CLI option takes precedence)
	const finalRegexString = options.fileNameRegex || config.fileNameRegex;

	// Compile the regex, exiting on failure
	const fileNameRegex = compileRegexStringOrFail(finalRegexString);

	// Check if it matches the configured pattern
	if (!fileNameRegex.test(origFilename)) {
		console.log(`Skipping non-matching file: ${yellow(origFilename)}`);
		return;
	}

	// Ensure the renamer is initialized (should be done once at startup)
	if (!renamer) {
		console.error("Renamer provider not initialized. Exiting.");
		process.exit(1); // Or handle initialization here if preferred
	}

	console.log(`Processing ${yellow(origFilename)}...`);

	try {
		// Read the image file as base64
		const imageData = await fs.promises.readFile(filePath, {
			encoding: "base64",
		});
		const base64string = `data:image/png;base64,${imageData}`;

		// Get rename suggestion from the AI provider
		const { category, filename } = await renamer.rename(
			base64string,
			options.detail as "low" | "high",
		);

		if (!filename) {
			console.warn(
				`Could not generate a filename for ${origFilename}. Skipping rename.`,
			);
			// Optionally move to an 'unprocessed' or similar directory
			return;
		}

		// Construct the new filename with date prefix
		const date = getDateFromScreenshot(origFilename);
		const newFilename = `${date}-${filename}${path.extname(filePath)}`;

		// Determine the final output path including the category subdirectory
		const categoryKeys = Object.keys(config.categories || {});
		const targetDir =
			category && categoryKeys.includes(category)
				? path.join(outputDir, category)
				: outputDir; // Default to base output dir if category invalid/missing

		const newPath = path.join(targetDir, newFilename);

		// Backup the original file before renaming/moving
		const backupPath = path.join(originalDir, origFilename);
		try {
			await fs.promises.copyFile(filePath, backupPath);
		} catch (copyError) {
			console.error(
				`Failed to backup original file ${origFilename} to ${backupPath}:`,
				copyError,
			);
			// Decide whether to proceed without backup or halt
			// For now, we'll log the error and attempt to continue renaming
		}

		// Rename and move the file
		await renameFile(filePath, newPath, false); // false = do not overwrite

		// Future enhancement idea: OCR transcription?
		// if (category === 'text') { /* OCR logic here */ }
	} catch (e) {
		console.error(`Error processing file ${origFilename}:`, e);
		// Optionally move failed files to a specific error directory
	}
}
