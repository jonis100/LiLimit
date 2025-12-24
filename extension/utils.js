

/**
 * Extract the hostname from a URL or plain hostname input
 * @param {string} input - Full URL or plain hostname
 * @returns {string} - Extracted hostname without www prefix
 */
export function extractHostname(input) {

	try {
		let url = input;

		if (!/^\w+:\/\//.test(input)) url = 'https://' + input;
		const parsed = new URL(url);
		let hostname = parsed.hostname || input;
		if (hostname.startsWith('www.')) hostname = hostname.substring(4);
		return hostname;
	} catch (e) {

		return input;
	}
}

/**
 * Convert limits object to human-readable string
 * @param {string[]} hosts - Array of hostnames
 * @param {Object} timeLimits - Object mapping hostnames to time limits
 * @param {Object} visitLimits - Object mapping hostnames to visit limits
 * @returns {string} - Human-readable string of limits
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
