/**
 * OpenAI Function Calling schema for screenshot rename operation
 */
export const renameFnSchema = {
	name: "rename_screenshot",
	description: "Return new file name and category for a screenshot",
	parameters: {
		type: "object",
		properties: {
			category: {
				type: "string",
				description: "Image category, must match predefined categories",
			},
			filename: {
				type: "string",
				description:
					"Suggested filename without extension, dash-separated words (1-3 words)",
			},
		},
		required: ["filename"],
	},
} as const;
