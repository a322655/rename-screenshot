import type { JsonResponse } from "../types";

/**
 * Interface for screenshot renaming services
 */
export interface ScreenshotRenamer {
	/**
	 * Rename a screenshot using AI
	 * @param base64 - Base64 encoded image data
	 * @param detail - Image detail level for AI analysis
	 * @returns Promise with category and suggested filename
	 */
	rename(base64: string, detail: "low" | "high"): Promise<JsonResponse>;
}
