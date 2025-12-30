/**
 * Extract the hostname from a URL or plain hostname input
 * @param {string} input - Full URL or plain hostname
 * @returns {string} - Extracted hostname without www prefix
 */
export function extractHostname(input) {
  try {
    const url = /^\w+:\/\//.test(input) ? input : `https://${input}`;
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
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
  let res = '';
  for (const host of hosts) {
    const time_string = timeLimits[host] ? `${timeLimits[host]} minutes` : 'No limit';
    const visits_string = visitLimits[host] ? `${visitLimits[host]} times` : 'No limit';
    res += `\n${host} Limited to:\n\tTime limit per visit: ${time_string}\n\tVisits per day: ${visits_string}\n`;
  }
  return res;
}
