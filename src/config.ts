// src/config.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Config, ProviderOptions } from "./types";
import { deepMerge, isObject, resolvePath } from "./utils"; // Import helpers

// Application default configuration
const appDefaults = {
	detail: "low",
	provider: "ollama",
	watchdir: path.join(os.homedir(), "Desktop"),
	outdir: null, // This will be calculated based on watchdir
	prompt: `Suggest a short and concise file name in 1-3 words.
If you can identify the software or website being used, add that as part of the new name.
For example, terminal, youtube, photoshop, etc.
Do not include file extension such as .png, .jpg or .txt. Use dash to connect words.`,
	fileNameRegex: "/^Screenshot.*\\.png$/i", // macOS default screenshot pattern with case-insensitive flag
	categories: {
		code: "the majority of the text is computer code",
		reference: "the image is a photograph",
		text: "the image is text-heavy paragraph(s)",
		web: "the image shows a webpage",
		youtube: "the image has youtube interface",
		other: "the image doesn't belong to other categories",
	},
	ollama: {
		baseURL: "http://localhost:11434/v1/",
		model: "llava",
		maxTokens: 30,
	},
	openai: {
		baseURL: "https://api.openai.com/v1",
		model: "gpt-4o-mini",
		maxTokens: 30,
	},
};

// Helper function: Calculate default outdir from watchdir
function getDefaultOutdir(watchdir: string): string {
	return path.join(watchdir, "Screenshots");
}

// Load and create configuration file
async function loadAndCreateUserConfig(): Promise<Record<string, unknown>> {
	// Adjusted to use import.meta.url robustly
	let __dirname: string;
	try {
		const __filename = fileURLToPath(import.meta.url);
		__dirname = path.dirname(__filename);
	} catch (e) {
		// Fallback for environments where import.meta.url might not be available directly
		// This might need adjustment based on the specific runtime environment if not Node ESM
		console.warn(
			"Could not determine __dirname using import.meta.url, using process.cwd() as fallback.",
		);
		__dirname = process.cwd(); // Adjust fallback as needed
	}

	const configPath = path.resolve(__dirname, "../user.config.json");
	const exampleConfigPath = path.resolve(
		__dirname,
		"../user.config.json.example",
	);

	try {
		// Check if config file exists
		await fs.promises.access(configPath);
	} catch (accessError) {
		// Config file does not exist, try to create from example or defaults
		try {
			let configContent: string;

			try {
				// Check if example config file exists
				await fs.promises.access(exampleConfigPath);
				// Create config file from example
				configContent = fs.readFileSync(exampleConfigPath, "utf-8");
				console.log("Creating user.config.json from example file...");
			} catch (exampleError) {
				// Example file also does not exist, create from defaults
				configContent = JSON.stringify(appDefaults, null, 2);
				console.log("Creating user.config.json from default values...");

				// Also create example file
				try {
					fs.writeFileSync(exampleConfigPath, configContent, "utf-8");
					console.log("Created user.config.json.example file.");
				} catch (writeExampleError) {
					console.warn(
						"Failed to create user.config.json.example:",
						writeExampleError,
					);
				}
			}

			// Write config file
			fs.writeFileSync(configPath, configContent, "utf-8");
			console.log("Created user.config.json successfully.");
		} catch (createError) {
			console.warn("Failed to create user.config.json:", createError);
			return {}; // Return empty object to allow program to continue with defaults
		}
	}

	// Read config file
	try {
		const fileContent = fs.readFileSync(configPath, "utf-8");
		const userConfig = JSON.parse(fileContent);
		return userConfig;
	} catch (error) {
		if (error instanceof Error) {
			if ("code" in error && error.code === "ENOENT") {
				console.log(
					"User configuration file not found. Using default configuration.",
				);
			} else {
				console.warn("Error loading user configuration:", error.message);
			}
		} else {
			// Non-Error object thrown
			console.warn("An unexpected error occurred:", error);
		}
		return {}; // Return empty object to allow program to continue with defaults
	}
}

// Function to load and process configuration
export async function loadConfig(): Promise<Config> {
	const userConfig = await loadAndCreateUserConfig();
	const mergedConfig = deepMerge(
		appDefaults,
		userConfig as Record<string, unknown>,
	);

	// Calculate effective paths after merging
	const effectiveWatchDir =
		resolvePath(mergedConfig.watchdir) || appDefaults.watchdir;
	const effectiveOutDir =
		resolvePath(mergedConfig.outdir) || getDefaultOutdir(effectiveWatchDir);

	// Ensure ollama and openai properties exist even if not in user config
	const finalConfig = {
		...mergedConfig,
		watchdir: effectiveWatchDir,
		outdir: effectiveOutDir,
		// Ensure provider-specific configs are objects
		ollama: isObject(mergedConfig.ollama) ? mergedConfig.ollama : {},
		openai: isObject(mergedConfig.openai) ? mergedConfig.openai : {},
		// Ensure fileNameRegex is present if not in merged config
		fileNameRegex:
			(mergedConfig.fileNameRegex as string) || appDefaults.fileNameRegex,
	} as Config; // Type assertion might be needed depending on deepMerge's return type specifics

	// Construct the final prompt
	const categories = finalConfig.categories as Record<string, string>;
	const categoryPrompt = `Identify the image's category from the following rule:\n${Object.keys(
		categories,
	)
		.map((cat) => `If ${categories[cat]}, set it to "${cat}"`)
		.join("\n")}`;
	const filenameSuggestionPrompt = finalConfig.prompt || appDefaults.prompt;
	const jsonInstructionPrompt =
		"Return as structured json in the format { category, filename } and nothing else.";
	finalConfig.finalPrompt = `${filenameSuggestionPrompt}\n${categoryPrompt}\n${jsonInstructionPrompt}`;

	return finalConfig;
}

// Example of how to potentially export specific derived values if needed elsewhere directly
// export const categories = (await loadConfig()).categories; // Or manage state differently
