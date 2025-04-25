// src/cli.ts
import { program } from "commander";
import packageJson from "../package.json";
import type { Config, Options } from "./types";

export function parseCliOptions(config: Config): Options {
	program
		.version(packageJson.version)
		.description(
			"Rename and organize Mac screenshots by their contents with the help of AI.",
		)
		.option(
			"--detail <value>",
			"What image resolution to use for inference",
			config.detail,
		)
		.option(
			"--provider <value>",
			"Choose supported API provider - openai or ollama",
			config.provider,
		)
		.option(
			"--outdir <folder_path>",
			"Path to save renamed images to",
			config.outdir, // Use effective outdir from config
		)
		.option("--retroactive", "Process already existing screenshots")
		.option(
			"--watchdir <folder_path>",
			"Folder to watch screenshots from",
			config.watchdir, // Use effective watchdir from config
		)
		.option("--watch", "Watch for new screenshots")
		.option(
			"--fileNameRegex <regex_string>",
			"Regex for matching filenames (e.g., '/pattern/flags')",
			config.fileNameRegex, // Use regex pattern from config
		);

	program.parse();

	const opts = program.opts() as Options; // Cast to Options type

	// Validation for watch/retroactive
	if (!opts.watch && !opts.retroactive) {
		console.error("Missing options. Add --watch and/or --retroactive");
		process.exit(1);
	}

	// Validation for provider (convert to lowercase for case-insensitive check)
	const providerOpt = opts.provider.toLowerCase();
	if (providerOpt !== "openai" && providerOpt !== "ollama") {
		console.error(`Selected provider ${providerOpt} is not supported`);
		process.exit(1);
	}

	return opts;
}
