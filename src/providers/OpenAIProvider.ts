import { yellow } from "kleur/colors";
import OpenAI from "openai";
import type { JsonResponse, ProviderOptions } from "../types";
import { resolveApiKey } from "../utils/resolveApiKey";
import { ScreenshotRenamer } from "./ScreenshotRenamer";
import { renameFnSchema } from "./schema";

/**
 * Provider implementation using OpenAI's Function Calling feature
 */
export class OpenAIProvider extends ScreenshotRenamer {
	private client: OpenAI;
	protected opts: ProviderOptions;
	protected prompt: string;
	protected categories: Record<string, string>;

	/**
	 * Create a new OpenAIProvider
	 * @param opts - Provider options (model, baseURL, maxTokens)
	 * @param prompt - The prompt to send to the API
	 * @param categories - Available categories object
	 */
	constructor(
		opts: ProviderOptions,
		prompt: string,
		categories: Record<string, string>,
	) {
		super();
		this.opts = opts;
		this.prompt = prompt;
		this.categories = categories;
		const apiKey = resolveApiKey();
		this.client = new OpenAI({ baseURL: opts.baseURL, apiKey });
		console.log(
			`Initialized OpenAI provider with model ${yellow(this.opts.model)}`,
		);
	}

	/**
	 * Rename a screenshot using OpenAI Function Calling
	 * @param base64 - Base64 encoded image data
	 * @param detail - Image detail level for AI analysis
	 * @returns Promise with category and suggested filename
	 */
	async rename(base64: string, detail: "low" | "high"): Promise<JsonResponse> {
		try {
			console.log(`Using Function Calling with ${yellow(this.opts.model)}`);

			const response = await this.client.chat.completions.create({
				model: this.opts.model,
				messages: [
					{
						role: "user",
						content: [
							{ type: "text", text: this.prompt },
							{
								type: "image_url",
								image_url: {
									url: base64,
									detail,
								},
							},
						],
					},
				],
				functions: [renameFnSchema],
				function_call: { name: "rename_screenshot" },
				max_tokens: this.opts.maxTokens,
			});

			const choice = response.choices[0];

			// Check finish reason
			if (
				choice.finish_reason !== "stop" &&
				choice.finish_reason !== "function_call"
			) {
				console.error(`Model stopped generating: ${choice.finish_reason}`);
				console.log("Function Calling failed, trying fallback method...");
				return this.fallbackRename(base64, detail);
			}

			// Get function call data
			const fnCall = choice.message.function_call;
			if (!fnCall || fnCall.name !== "rename_screenshot") {
				console.error("Function call not triggered or has wrong name");
				console.log("Function Calling failed, trying fallback method...");
				return this.fallbackRename(base64, detail);
			}

			// Parse function arguments (should be valid JSON)
			try {
				const result = JSON.parse(fnCall.arguments || "{}") as JsonResponse;

				// Validate the JSON using the shared method
				if (!super.validateJsonResponse(result)) {
					console.error("Invalid JSON response from function call");
					console.log("Invalid function result, trying fallback method...");
					return this.fallbackRename(base64, detail);
				}

				return {
					category: result.category,
					filename: result.filename || "unknown",
				};
			} catch (e) {
				console.error(`Error parsing function arguments: ${e}`);
				console.log("Function parsing failed, trying fallback method...");
				return this.fallbackRename(base64, detail);
			}
		} catch (e) {
			console.error(`OpenAI API error: ${e}`);
			console.log("API call failed, trying fallback method...");
			return this.fallbackRename(base64, detail);
		}
	}

	/**
	 * Fallback method that doesn't use Function Calling
	 * @param base64 - Base64 encoded image data
	 * @param detail - Image detail level for AI analysis
	 * @returns Promise with category and suggested filename
	 */
	private async fallbackRename(
		base64: string,
		detail: "low" | "high",
	): Promise<JsonResponse> {
		try {
			console.log(
				`Using fallback method for OpenAI model ${yellow(this.opts.model)}`,
			);

			// Use standard completion without function calling
			const response = await this.client.chat.completions.create({
				model: this.opts.model,
				messages: [
					{
						role: "user",
						content: [
							{ type: "text", text: this.prompt },
							{
								type: "image_url",
								image_url: {
									url: base64,
									detail,
								},
							},
						],
					},
				],
				max_tokens: this.opts.maxTokens,
			});

			const choice = response.choices[0];
			if (!choice || !choice.message || !choice.message.content) {
				console.error("Unexpected response structure: no content");
				return ScreenshotRenamer.handleProviderError(
					"No content in response",
					"OpenAI Fallback",
				);
			}

			const modelResponse = choice.message.content;

			console.log(
				`Received response from OpenAI fallback: ${modelResponse.substring(0, 100)}${
					modelResponse.length > 100 ? "..." : ""
				}`,
			);

			// Use the shared method to extract JSON
			const extractedJson = super.extractJsonFromText(modelResponse);

			if (!extractedJson) {
				console.error("Failed to extract valid JSON from model response");
				return ScreenshotRenamer.handleProviderError(
					"Failed to extract JSON",
					"OpenAI Fallback Parsing",
					"parsing-error",
				);
			}

			// Use the shared method to validate JSON
			if (!super.validateJsonResponse(extractedJson)) {
				console.error("Extracted JSON is invalid");
				return ScreenshotRenamer.handleProviderError(
					"Invalid JSON structure",
					"OpenAI Fallback Validation",
					"invalid-format",
				);
			}

			return extractedJson;
		} catch (e) {
			return ScreenshotRenamer.handleProviderError(e, "OpenAI API Fallback");
		}
	}
}
