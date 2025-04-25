import { yellow } from "kleur/colors";
import { Ollama } from "ollama";
import type { JsonResponse, ProviderOptions } from "../types";
import { ScreenshotRenamer } from "./ScreenshotRenamer";
import { renameFnSchema } from "./schema";

/**
 * Provider implementation for Ollama models using ollama npm package
 * with Function Calling support
 */
export class OllamaProvider extends ScreenshotRenamer {
	private client: Ollama;
	protected opts: ProviderOptions;
	protected prompt: string;
	protected categories: Record<string, string>;

	/**
	 * Create a new OllamaProvider
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
		// Validate required options
		if (!opts.baseURL) {
			throw new Error("Missing baseURL in Ollama provider options");
		}
		if (!opts.model) {
			throw new Error("Missing model in Ollama provider options");
		}
		if (!opts.maxTokens) {
			opts.maxTokens = 30; // Default if not specified
		}

		this.opts = opts;
		this.prompt = prompt;
		this.categories = categories;
		this.client = new Ollama({ host: opts.baseURL });
		console.log(
			`Initialized Ollama provider with model ${yellow(this.opts.model)}`,
		);
	}

	/**
	 * Rename a screenshot using Ollama with npm package
	 * @param base64 - Base64 encoded image data
	 * @param detail - Image detail level for AI analysis
	 * @returns Promise with category and suggested filename
	 */
	async rename(base64: string, detail: "low" | "high"): Promise<JsonResponse> {
		try {
			console.log(`Using Function Calling with ${yellow(this.opts.model)}`);

			// Create system message with text and image content
			const systemMessage = {
				role: "system" as const,
				content:
					"Please analyze this image and suggest a filename. You MUST use the rename_screenshot function to return your answer.",
			};

			// Basic user message
			const userMessage = {
				role: "user" as const,
				content: this.prompt,
			};

			// Create a separate image message
			const imageMessage = {
				role: "user" as const,
				content: "", // empty content, image provided separately
				images: [base64],
			};

			// Send request using standard format of ollama package
			try {
				const response = await this.client.chat({
					model: this.opts.model,
					messages: [systemMessage, userMessage, imageMessage],
					tools: [
						{
							type: "function",
							function: {
								name: renameFnSchema.name,
								description: renameFnSchema.description,
								parameters: {
									type: renameFnSchema.parameters.type,
									properties: renameFnSchema.parameters.properties,
									required: Array.from(renameFnSchema.parameters.required),
								},
							},
						},
					],
					options: {
						num_predict: this.opts.maxTokens,
					},
				});

				// Check if tool calls exist
				const toolCalls = response.message?.tool_calls;
				if (toolCalls && toolCalls.length > 0) {
					// Function call response exists
					const fnCall = toolCalls[0];
					if (fnCall.function?.name !== "rename_screenshot") {
						console.error(
							"Function call has wrong name:",
							fnCall.function?.name,
						);
						console.log("Function Calling failed, trying fallback method...");
						return this.fallbackRename(base64, detail);
					}

					// Parse function arguments (should be valid JSON)
					try {
						if (typeof fnCall.function.arguments !== "string") {
							console.error("Function arguments is not a string");
							return this.fallbackRename(base64, detail);
						}

						const result = JSON.parse(
							fnCall.function.arguments,
						) as JsonResponse;

						// Validate JSON using shared method
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
				} else if (response.message?.content) {
					// No function call but content exists - try to extract JSON
					console.log(
						"No function call detected, trying to extract JSON from content",
					);
					const content = response.message.content;

					console.log(
						`Received response from Ollama: ${content.substring(0, 100)}${
							content.length > 100 ? "..." : ""
						}`,
					);

					// Extract JSON using shared method
					const extractedJson = super.extractJsonFromText(content);

					if (!extractedJson) {
						console.error("Failed to extract valid JSON from model response");
						return this.fallbackRename(base64, detail);
					}

					// Validate JSON using shared method
					if (!super.validateJsonResponse(extractedJson)) {
						console.error("Extracted JSON is invalid");
						return this.fallbackRename(base64, detail);
					}

					return extractedJson;
				} else {
					console.error("Unexpected response structure from Ollama API");
					return ScreenshotRenamer.handleProviderError(
						"Unexpected response",
						"Ollama API",
					);
				}
			} catch (e) {
				console.error(`Ollama API function calling error: ${e}`);
				console.log("Function Calling failed, trying fallback method...");
				return this.fallbackRename(base64, detail);
			}
		} catch (e) {
			console.error(`Ollama API error: ${e}`);
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
				`Using fallback method for Ollama model ${yellow(this.opts.model)}`,
			);

			// Create messages with prompt and image
			const systemMessage = {
				role: "system" as const,
				content:
					"Please analyze this image and respond with JSON containing 'filename' and optionally 'category'.",
			};

			const userMessage = {
				role: "user" as const,
				content: `${this.prompt}\nRespond ONLY with JSON in the format: {"filename": "suggested-name", "category": "optional-category"}`,
			};

			const imageMessage = {
				role: "user" as const,
				content: "", // empty content, image provided separately
				images: [base64],
			};

			// Use standard chat completion (without function calling)
			const response = await this.client.chat({
				model: this.opts.model,
				messages: [systemMessage, userMessage, imageMessage],
				options: {
					num_predict: this.opts.maxTokens,
				},
			});

			if (!response.message || !response.message.content) {
				console.error("Unexpected response structure: no content");
				return ScreenshotRenamer.handleProviderError(
					"No content in response",
					"Ollama Fallback",
				);
			}

			const modelResponse = response.message.content;

			console.log(
				`Received response from Ollama fallback: ${modelResponse.substring(0, 100)}${
					modelResponse.length > 100 ? "..." : ""
				}`,
			);

			// Extract JSON using shared method
			const extractedJson = super.extractJsonFromText(modelResponse);

			if (!extractedJson) {
				console.error("Failed to extract valid JSON from model response");
				return ScreenshotRenamer.handleProviderError(
					"Failed to extract JSON",
					"Ollama Fallback Parsing",
					"parsing-error",
				);
			}

			// Validate JSON using shared method
			if (!super.validateJsonResponse(extractedJson)) {
				console.error("Extracted JSON is invalid");
				return ScreenshotRenamer.handleProviderError(
					"Invalid JSON structure",
					"Ollama Fallback Validation",
					"invalid-format",
				);
			}

			return extractedJson;
		} catch (e) {
			return ScreenshotRenamer.handleProviderError(e, "Ollama API Fallback");
		}
	}
}
