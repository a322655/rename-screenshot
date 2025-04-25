import { yellow } from "kleur/colors";
import OpenAI from "openai";
import type { JsonResponse } from "../types";
import { resolveApiKey } from "../utils/resolveApiKey";
import type { ScreenshotRenamer } from "./ScreenshotRenamer";
import { renameFnSchema } from "./schema";

/**
 * Provider implementation using OpenAI's Function Calling feature
 */
export class OpenAIProvider implements ScreenshotRenamer {
	private client: OpenAI;

	/**
	 * Create a new OpenAIProvider
	 * @param opts - Provider options (model, baseURL, maxTokens)
	 * @param prompt - The prompt to send to the API
	 * @param categories - Available categories object
	 */
	constructor(
		private opts: { baseURL: string; model: string; maxTokens: number },
		private prompt: string,
		private categories: Record<string, string>,
	) {
		const apiKey = resolveApiKey();
		this.client = new OpenAI({ baseURL: opts.baseURL, apiKey });
		console.log(`Initialized OpenAI provider with model ${yellow(opts.model)}`);
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
				return { filename: "unknown" };
			}

			// Get function call data
			const fnCall = choice.message.function_call;
			if (!fnCall || fnCall.name !== "rename_screenshot") {
				console.error("Function call not triggered or has wrong name");
				return { filename: "unknown" };
			}

			// Parse function arguments (should be valid JSON)
			try {
				const result = JSON.parse(fnCall.arguments || "{}") as JsonResponse;
				return {
					category: result.category,
					filename: result.filename || "unknown",
				};
			} catch (e) {
				console.error(`Error parsing function arguments: ${e}`);
				return { filename: "unknown" };
			}
		} catch (e) {
			console.error(`OpenAI API error: ${e}`);
			return { filename: "unknown" };
		}
	}
}
