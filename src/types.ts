// import { categories } from ".";

export type Options = {
	/** image resolution used for inference */
	detail: "high" | "low" | "auto";
	/** directory renamed images are saved to */
	outdir: string;
	/** API provider */
	provider: "openai" | "ollama";
	/** process existing screenshots? */
	retroactive: boolean;
	/** Folder to watch screenshots from */
	watchdir: string;
	/** continue monitor new screenshots */
	watch: boolean;
	/** Regex for matching filenames (e.g., '/pattern/flags') */
	fileNameRegex?: string;
};

/** API Provider options */
export type ProviderOptions = {
	baseURL: string;
	model: string;
	maxTokens: number;
};

// export type Category = keyof typeof categories;

export type Config = {
	// Properties derived or passed through from defaults/user config/CLI
	detail: "high" | "low" | "auto";
	provider: "openai" | "ollama";
	watchdir: string;
	outdir: string;
	fileNameRegex: string;

	// Original properties
	categories: Record<string, string>;
	ollama: ProviderOptions;
	openai: ProviderOptions;
	prompt?: string;

	// Added property constructed in loadConfig
	finalPrompt?: string;
};

export type JsonResponse = {
	/** One of the predefined categories */
	category?: string;
	/** New filename created by chatGPT. doesn't include extension */
	filename: string;
};
