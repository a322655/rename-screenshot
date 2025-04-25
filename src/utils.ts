import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { red, yellow } from "kleur/colors";

// Helper function: Resolve tilde (~) in paths
export function resolvePath(p: string | null): string | null {
	if (!p) return null;
	return p.replace(/^~/, os.homedir());
}

// Helper function: Deep merge two objects
export function deepMerge<
	T extends Record<string, unknown>,
	U extends Record<string, unknown>,
>(target: T, source: U): T & U {
	const output = { ...target } as T & U;
	if (isObject(target) && isObject(source)) {
		for (const key of Object.keys(source)) {
			const sourceValue = source[key];
			if (isObject(sourceValue)) {
				if (!(key in target)) {
					Object.assign(output, { [key]: sourceValue });
				} else {
					const targetValue = target[key];
					if (isObject(targetValue)) {
						(output as Record<string, unknown>)[key] = deepMerge(
							targetValue,
							sourceValue,
						);
					} else {
						(output as Record<string, unknown>)[key] = sourceValue;
					}
				}
			} else {
				Object.assign(output, { [key]: sourceValue });
			}
		}
	}
	return output;
}

// Helper function: Check if an item is an object
export function isObject(item: unknown): item is Record<string, unknown> {
	return Boolean(item && typeof item === "object" && !Array.isArray(item));
}

/**
 * Parses a regex string in the format "/pattern/flags" and compiles it.
 * Exits the process with an error message if parsing or compilation fails.
 * @param regexString The regex string to parse and compile (e.g., "/^file-\\d+\\.txt$/i").
 * @returns The compiled RegExp object.
 */
export function compileRegexStringOrFail(regexString: string): RegExp {
	const regexParts = regexString.match(/^\/(.+)\/([gimyus]*)$/);

	if (!regexParts) {
		console.error(
			red(
				`Error: Invalid fileNameRegex format: "${regexString}". Expected '/pattern/flags'.`,
			),
		);
		process.exit(1);
	}

	const [, pattern, flags] = regexParts;

	try {
		return new RegExp(pattern, flags);
	} catch (error) {
		let message = "Unknown error";
		if (error instanceof Error) {
			message = error.message;
		}
		console.error(
			red(
				`Error: Failed to compile regex pattern '${pattern}' with flags '${flags}' from string "${regexString}". Reason: ${message}`,
			),
		);
		process.exit(1);
	}
}

/**
 * Rename file (and move if path is different). It doesn't overwrite by default and add number suffix at the end.
 * @param oldPath -
 * @param newFilePath -
 * @param overwrite - Whether to overwrite if file exists at new file path. default: `false`
 */
export const renameFile = async (
	oldPath: string,
	newFilePath: string,
	overwrite = false,
) => {
	const newFolderPath = path.dirname(newFilePath);
	const ext = path.extname(newFilePath);
	const baseWithoutExt = path.basename(newFilePath, ext);

	let count = 0;
	let finalPath = newFilePath;
	// number up if existing file found and not overwriting
	while (fs.existsSync(finalPath) && !overwrite) {
		count++;
		finalPath = path.join(newFolderPath, `${baseWithoutExt}-${count}${ext}`);
	}

	try {
		await fs.promises.rename(oldPath, finalPath);
		console.log(`File renamed to ${yellow(finalPath)}`);
	} catch (e) {
		console.error(`Error renaming the file: ${e}`);
	}
};

/**
 * Gets the date from a file in YYYY-MM-DD format using file creation date
 * @param filePath - Full path to the file
 * @returns Date string in YYYY-MM-DD format
 */
export const getDateFromScreenshot = (filePath: string) => {
	try {
		const stats = fs.statSync(filePath);
		const creationDate = new Date(stats.birthtime);

		const year = creationDate.getFullYear().toString(); // Get full year
		const month = String(creationDate.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
		const day = String(creationDate.getDate()).padStart(2, "0");

		return `${year}-${month}-${day}`;
	} catch (error) {
		console.error(`Error getting file creation date: ${error}`);
		return "";
	}
};
