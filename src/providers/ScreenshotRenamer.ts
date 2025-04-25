import { yellow } from "kleur/colors";
import type { JsonResponse, ProviderOptions } from "../types";

/**
 * Abstract class for screenshot renaming services with shared functionality
 */
export abstract class ScreenshotRenamer {
	// Common properties that all providers might need
	protected opts?: ProviderOptions;
	protected prompt?: string;
	protected categories?: Record<string, string>;

	/**
	 * Rename a screenshot using AI
	 * @param base64 - Base64 encoded image data
	 * @param detail - Image detail level for AI analysis
	 * @returns Promise with category and suggested filename
	 */
	abstract rename(
		base64: string,
		detail: "low" | "high",
	): Promise<JsonResponse>;

	/**
	 * Extract JSON from a text response that might contain additional content
	 * @param text The text response from AI model
	 * @returns Parsed JSON object or null if parsing fails
	 */
	protected extractJsonFromText(text: string): JsonResponse | null {
		try {
			// First attempt: try parsing the entire response as JSON
			return JSON.parse(text) as JsonResponse;
		} catch (e) {
			// Second attempt: try to find JSON object using regex
			const jsonRegex = /{[\s\S]*?}/;
			const match = text.match(jsonRegex);

			if (match?.[0]) {
				try {
					return JSON.parse(match[0]) as JsonResponse;
				} catch (e) {
					console.error("Failed to parse extracted JSON:", e);
				}
			}

			// Third attempt: try to find anything between ```json and ``` (markdown code blocks)
			const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
			const codeMatch = text.match(codeBlockRegex);

			if (codeMatch?.[1]) {
				try {
					return JSON.parse(codeMatch[1]) as JsonResponse;
				} catch (e) {
					console.error("Failed to parse JSON from code block:", e);
				}
			}

			return null;
		}
	}

	/**
	 * Validate the parsed JSON response
	 * @param json The parsed JSON object
	 * @returns true if valid, false otherwise
	 */
	protected validateJsonResponse(json: unknown): json is JsonResponse {
		if (!json || typeof json !== "object") return false;

		// Need to cast to Record<string, unknown> since we've verified it's an object
		const jsonObj = json as Record<string, unknown>;

		// filename is required and must be a string
		if (
			typeof jsonObj.filename !== "string" ||
			jsonObj.filename.trim() === ""
		) {
			return false;
		}

		// category is optional but if present must be a string
		if (
			jsonObj.category !== undefined &&
			typeof jsonObj.category !== "string"
		) {
			return false;
		}

		return true;
	}

	/**
	 * Standardized error handling for all providers
	 * @param error The error that occurred
	 * @param errorType Type of error for logging
	 * @param fallbackFilename Fallback filename to use
	 * @returns Default JsonResponse
	 */
	protected static handleProviderError(
		error: unknown,
		errorType: string,
		fallbackFilename = "unknown",
	): JsonResponse {
		console.error(`${errorType} error: ${error}`);
		return { filename: fallbackFilename };
	}
}
