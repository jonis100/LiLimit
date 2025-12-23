/**
 * Utility functions for LiLimit Chrome Extension
 */

/**
 * Extract the hostname from a URL or plain hostname input
 * @param {string} input - Full URL or plain hostname
 * @returns {string} - Extracted hostname without www prefix
 */
export function extractHostname(input) {
	// Accept either a full URL or a plain hostname
	try {
		let url = input;
		// If input doesn't contain a scheme, prepend https:// so URL() parses hostnames
		if (!/^\w+:\/\//.test(input)) url = 'https://' + input;
		const parsed = new URL(url);
		let hostname = parsed.hostname || input;
		if (hostname.startsWith('www.')) hostname = hostname.substring(4);
		return hostname;
	} catch (e) {
		// Fallback: return the input as-is (best-effort)
		return input;
	}
}

/**
 * Convert limits object to human-readable string
 * @param {Array<string>} hosts - Array of hostnames with limits
 * @param {Object} timeLimits - Time limits object
 * @param {Object} visitLimits - Visit limits object
 * @returns {string} - Formatted string with limitations
 */
export function limits_to_string(hosts, timeLimits, visitLimits) {
	let res = "";
	for (const host of hosts) {
		const time_limitation = (timeLimits[host] ? timeLimits[host] : "No limit");
		const visits_limitation = (visitLimits[host] ? visitLimits[host] : "No limit");
		res += `\n${host} Limited to:\n\tTime per limits: ${time_limitation} \n\tVisits per day: ${visits_limitation}\n`;
	}
	return res;
}
