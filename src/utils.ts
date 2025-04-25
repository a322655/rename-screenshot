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
 * Gets the date from a screenshot file in YYYY-MM-DD format
 * First tries to extract date from filename using various universal date patterns
 * including unix timestamps and different regional formats
 * Falls back to file creation date if no valid date found in filename
 * @param filePath - Full path to the file
 * @returns Date string in YYYY-MM-DD format
 */
export const getDateFromScreenshot = (filePath: string) => {
	// Get the filename without path
	const fileName = path.basename(filePath);
	let foundDate: Date | null = null;

	// Try to match Unix timestamp (10-digit, 13-digit, 16-digit)
	const unixTimestampPatterns = [
		// 10-digit Unix timestamp (seconds) often enclosed in brackets or followed by delimiters
		/\[?(\d{10})\]?/,
		// 13-digit Unix timestamp (milliseconds)
		/^(\d{13})/,
		// Unix timestamp with decimal part (16-digit or 19-digit)
		/(\d{10})\.(\d{3,9})/,
	];

	for (const pattern of unixTimestampPatterns) {
		const match = fileName.match(pattern);
		if (match?.[1]) {
			// Convert to number and create date
			const timestamp = Number.parseInt(match[1], 10);
			// Check if this is a reasonable Unix timestamp (between 1990 and current year + 1)
			const dateFromTimestamp = new Date(
				match[1].length === 10 ? timestamp * 1000 : timestamp,
			);
			const year = dateFromTimestamp.getFullYear();

			if (year >= 1990 && year <= new Date().getFullYear() + 1) {
				foundDate = dateFromTimestamp;
				break;
			}
		}
	}

	// Try common date patterns if Unix timestamp wasn't found
	if (!foundDate) {
		// Universal date patterns covering different regional formats
		const datePatterns = [
			// ISO format: YYYY-MM-DD
			{
				regex: /(\d{4})-(\d{2})-(\d{2})/,
				yearIndex: 1,
				monthIndex: 2,
				dayIndex: 3,
			},
			// US format: MM/DD/YYYY
			{
				regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
				yearIndex: 3,
				monthIndex: 1,
				dayIndex: 2,
			},
			// European format: DD.MM.YYYY
			{
				regex: /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
				yearIndex: 3,
				monthIndex: 2,
				dayIndex: 1,
			},
			// YY-MM-DD
			{
				regex: /(\d{2})-(\d{2})-(\d{2})/,
				yearIndex: 1,
				monthIndex: 2,
				dayIndex: 3,
				shortYear: true,
			},
			// YYYYMMDD
			{
				regex: /(\d{4})(\d{2})(\d{2})/,
				yearIndex: 1,
				monthIndex: 2,
				dayIndex: 3,
			},
			// DD-MM-YYYY
			{
				regex: /(\d{1,2})-(\d{1,2})-(\d{4})/,
				yearIndex: 3,
				monthIndex: 2,
				dayIndex: 1,
			},
			// YYYY_MM_DD
			{
				regex: /(\d{4})_(\d{2})_(\d{2})/,
				yearIndex: 1,
				monthIndex: 2,
				dayIndex: 3,
			},
			// DD_MM_YYYY
			{
				regex: /(\d{1,2})_(\d{1,2})_(\d{4})/,
				yearIndex: 3,
				monthIndex: 2,
				dayIndex: 1,
			},
			// MM-DD-YY
			{
				regex: /(\d{1,2})-(\d{1,2})-(\d{2})/,
				yearIndex: 3,
				monthIndex: 1,
				dayIndex: 2,
				shortYear: true,
			},
		];

		for (const pattern of datePatterns) {
			// Don't use global flag to avoid state preservation issues
			const regex = new RegExp(pattern.regex);
			let startPos = 0;
			const allMatches = [];

			// Manually find all matches
			while (startPos < fileName.length) {
				const remainingString = fileName.slice(startPos);
				const matchResult = remainingString.match(regex);

				if (!matchResult) break;

				allMatches.push(matchResult[0]);
				// Move to after the current match to continue searching
				startPos +=
					fileName.indexOf(matchResult[0], startPos) + matchResult[0].length;
			}

			if (allMatches.length > 0) {
				// Process each match found
				for (const match of allMatches) {
					const parts = match.match(pattern.regex);
					if (!parts) continue;

					// Extract year, month, day based on the matched pattern's indexes
					let year = Number.parseInt(parts[pattern.yearIndex], 10);
					const month = Number.parseInt(parts[pattern.monthIndex], 10);
					const day = Number.parseInt(parts[pattern.dayIndex], 10);

					// Handle 2-digit year
					if (pattern.shortYear) {
						// Assume 21st century for years < 70, 20th century for >= 70
						// (similar to how JavaScript Date object handles 2-digit years)
						year = year < 70 ? 2000 + year : 1900 + year;
					}

					// Validate the date components
					if (isValidDate(year, month, day)) {
						foundDate = new Date(year, month - 1, day);
						break;
					}
				}
				if (foundDate) break;
			}
		}
	}

	// If a valid date was found, format it as YYYY-MM-DD
	if (foundDate) {
		const year = foundDate.getFullYear();
		const month = String(foundDate.getMonth() + 1).padStart(2, "0");
		const day = String(foundDate.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	// Fall back to file creation date if no valid date found in filename
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

/**
 * Validates if a date is valid
 * @param year - Year
 * @param month - Month (1-12)
 * @param day - Day
 * @returns Whether the date is valid
 */
function isValidDate(year: number, month: number, day: number): boolean {
	// Basic range validation
	if (year < 1970 || year > new Date().getFullYear() + 1) return false;
	if (month < 1 || month > 12) return false;
	if (day < 1 || day > 31) return false;

	// Create date and check if it results in the same date
	// This handles edge cases like 2023-02-30 (February 30th doesn't exist)
	const date = new Date(year, month - 1, day);
	return (
		date.getFullYear() === year &&
		date.getMonth() === month - 1 &&
		date.getDate() === day
	);
}
