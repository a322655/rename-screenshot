import dotenv from "dotenv";
import { yellow } from "kleur/colors";

/**
 * Resolves the OpenAI API key from environment variables or .env file
 * Prioritizes environment variables over .env file
 * @returns The OpenAI API key
 * @throws Error if no API key is found
 */
export function resolveApiKey(): string {
	// First check if API key is already in environment (e.g., from shell config)
	if (process.env.OPENAI_API_KEY) {
		console.log("Using OpenAI API key from environment variables");
		return process.env.OPENAI_API_KEY;
	}

	// If not found in environment, try to load from .env file
	dotenv.config();

	// Check again after loading .env
	if (process.env.OPENAI_API_KEY) {
		console.log("Using OpenAI API key from .env file");
		return process.env.OPENAI_API_KEY;
	}

	// If we get here, no API key was found
	console.error(
		yellow("Error: OPENAI_API_KEY not found in environment or .env file"),
	);
	console.error(
		"Please set OPENAI_API_KEY in your shell or create a .env file with OPENAI_API_KEY=your_key",
	);
	throw new Error("OPENAI_API_KEY not found");
}
