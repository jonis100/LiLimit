/**
 * Extract the hostname from a URL or plain hostname input
 * @param input - Full URL or plain hostname
 * @returns Extracted hostname without www prefix
 */
export function extractHostname(input: string): string {
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
 * @param hosts - Array of hostnames
 * @param timeLimits - Object mapping hostnames to time limits
 * @param visitLimits - Object mapping hostnames to visit limits
 * @returns Human-readable string of limits
 */
export function limits_to_string(
  hosts: string[],
  timeLimits: { [hostname: string]: number | undefined },
  visitLimits: { [hostname: string]: number | undefined }
): string {
  let res = '';
  for (const host of hosts) {
    const time_string = timeLimits[host] ? `${timeLimits[host]} minutes` : 'No limit';
    const visits_string = visitLimits[host] ? `${visitLimits[host]} times` : 'No limit';
    res += `\n${host} Limited to:\n\tTime limit per visit: ${time_string}\n\tVisits per day: ${visits_string}\n`;
  }
  return res;
}
