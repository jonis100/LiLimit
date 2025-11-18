// In-memory objects. timeLimits and visitLimits are persisted to  
const visitCounts = {};
const timeLimits = {};
const visitLimits = {}; 
const timers = {};
const lastHandle = {};

// Load persisted limits from storage on startup
chrome.storage && chrome.storage.local && chrome.storage.local.get(['timeLimits', 'visitLimits'], (result) => {
	try {
		if (result && result.timeLimits) Object.assign(timeLimits, result.timeLimits);
		if (result && result.visitLimits) Object.assign(visitLimits, result.visitLimits);
		console.log('Loaded persisted limits from storage:', {timeLimits, visitLimits});
	} catch (e) { console.error('Error loading limits from storage', e); }
});

// Save current limits to chrome.storage.local
function saveLimitsToStorage(){
	try {
		chrome.storage.local.set({ timeLimits: timeLimits, visitLimits: visitLimits }, () => {
			if (chrome.runtime.lastError) {
				console.error('Error saving limits to storage:', chrome.runtime.lastError);
			} else {
				console.log('Saved limits to storage');
			}
		});
	} catch (e) {
		console.error('saveLimitsToStorage failed', e);
	}
}


// Extaract the hostname from URL
function extractHostname(input){
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

// Set up a listener for when the new tab is opened
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

	try {
		var hostname = extractHostname(changeInfo.url);
		 console.log(`Tab with id: ${tabId} was updated. New url: ${changeInfo.url}`);
		if (timers[tabId] && lastHandle[tabId] != hostname){ 
			clearTimeout(timers[tabId])
			delete timers[tabId];
			console.log(`clear timout on tabId: ${tabId}`);
			}
		handleHostname(hostname, tabId);
		} catch (error) {console.log("Can't handle in onUpdated:", error);
		console.log("The problematic URL: ",changeInfo);}

	});


// Set up a listener for when the active tab in the browser changes
chrome.tabs.onActivated.addListener((activeInfo) => {
  // Get the URL of the active tab
  chrome.tabs.get(activeInfo.tabId, (tab) => {
  	// check if pendingUrl is undefined - when it is NOT new tab
		if (typeof tab.pendingUrl == 'undefined'){
			try {
			var hostname = extractHostname(tab.url);
			console.log("tab switched hostname extractHostname: ",hostname, "call handleHostname..")
			handleHostname(hostname, tab.id)
			
			} catch (error) {console.log("Can't handle in onActivated:", error);}
		}
		else{
		// It is a new tab. can escape
		console.log("new tab from onActivated");
		console.log("tab.url.pendingUrl !== 'undefined', but url:", tab.url);
		return;}

		

  });
});


// Get array of hostnames with limits and return string with limitations
function limits_to_string(hosts){
	res = ""
	for (host of hosts){
		time_limitation = (timeLimits[host] ? timeLimits[host] : "No limit");
		visits_limitation = (visitLimits[host] ? visitLimits[host] : "No limit");
		res += `\n${host} Limited to:\n\tTime per limits: ${time_limitation} \n\tVisits per day: ${visits_limitation}\n`
		}
	return res;		
}


// Handle the hostname apply limitations and count the visit
function handleHostname(hostname, tabID){
	console.log("Handling: ", hostname);
    // Check if there is a visit count set for this website
		if (visitCounts[hostname] && lastHandle[tabID] != hostname) {
			// If there is a visit count set, increment the count
			visitCounts[hostname]++;
			// Check if the visit count has reached the limit
			if (visitLimits[hostname] !== undefined && visitCounts[hostname] > visitLimits[hostname])  {
				// If the visit count has reached the limit, navigate the tab to a new URL
				chrome.tabs.update(tabID, {url: "https://github.com/jonis100/LiLimit#visits-per-day-exceeded"});
			}
		} else {
			if (visitLimits[hostname] && lastHandle[tabID] != hostname){
				// If there is no visit count set for this website, but in visit limits list - set the count to 1
				visitCounts[hostname] = 1;
			}
		}
    // Check if there is a time limit set for this website
		if (timeLimits[hostname] !== undefined) {
      // If there is a time limit set, start a timer for the specified time
      const timeLimit = timeLimits[hostname];
      // When the timer finishes, navigate the tab to a new URL
      const timer = setTimeout(() => {
        chrome.tabs.update(tabID, {url: "https://github.com/jonis100/LiLimit#time-exceeded"});
      }, timeLimit * 60000);
      timers[tabID] = timer;
      console.log(`timers[tabID]: set on tabId: ${tabID} timer: ${timer}`);
     }
     lastHandle[tabID] = hostname;
}    
    

// Set up a listener for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.hostname && extractHostname(request.hostname) === "github.com"){
		console.log("You can't limit github.com. \n " +
		"\t1. It will cause an infinite loop. \n" +
		"\t2. There isn't worried you will waste youre time there..");
		return;
	};
	// Check if the message is a request to set a visits count limit
	if (request.type === "setVisitLimit") {
		var hostname = extractHostname(request.hostname);
		var visitLimit = request.visitLimit;
		// coerce to number when possible
		const v = Number(visitLimit);
		visitLimits[hostname] = Number.isFinite(v) ? v : visitLimit;
		// persist
		saveLimitsToStorage();
	}
 	// Check if the message is a request to set a time limit
	if (request.type === "setTimeLimit") {
		var hostname = extractHostname(request.hostname);  
		var timeLimit = request.timeLimit;
		// coerce to number when possible
		const t = Number(timeLimit);
		timeLimits[hostname] = Number.isFinite(t) ? t : timeLimit;
		// persist
		saveLimitsToStorage();
   }
 	// DEBUG console.log("from background", visitCounts, timeLimits, visitLimits)	//DEBUG
 	// Check if the message is a request to delete hostname limits
    if (request.type === "deLimit") {
		// DEBUG console.log(" from background deLimit clicked");
		let hostname = extractHostname(request.hostname);
		// Set the visit limit for the specified website
		delete visitLimits[hostname];
		delete timeLimits[hostname];
		delete visitCounts[hostname];
		// persist changes
		saveLimitsToStorage();
		// DEBUG console.log("visitLimits:", visitLimits)
		// DEBUG console.log("timeLimits: ", timeLimits)
   }
	// Check if the message is a request to show limits   
	if (request.type === "showLimits") {
		console.log(" from background ShowLimits clicked");
		var timeLimitsSet  = new Set(Object.keys(timeLimits));
		var visitLimitsSet  = new Set(Object.keys(visitLimits)); 
		var allLimitsUnion = new Set([...timeLimitsSet, ...visitLimitsSet]);
		// DEBUG console.log(`Limits:\n ${Array.from(allLimitsUnion)}`)
		var limitation_respond  = ((allLimitsUnion.size > 0) ? limits_to_string(Array.from(allLimitsUnion)) : "No Limits Yet");
		sendResponse({limits: limitation_respond});
   }
});


// This function will run the func daily at hour:minutes
function runAtSpecificTimeOfDay(hour, minutes, func)
{
  const twentyFourHours = 86400000;
  const now = new Date();
  let eta_ms = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minutes, 0, 0).getTime() - now;
  if (eta_ms < 0)
  {
    eta_ms += twentyFourHours;
  }
  setTimeout(function() {
    //run once
    func();
    // run every 24 hours from now on
    setInterval(func, twentyFourHours);
  }, eta_ms);
}


// run everyday at midnight
runAtSpecificTimeOfDay(0,0,() => { 
	// Clean visitCounts of the day
	for (var member in visitCounts) delete visitCounts[member];
	//Clean timers of the day. Needed when closed the tab before switched (manualy or by LiLimit). 
	for (var member in timers) delete timers[member];
	
				});

// Reset the visit counts once a day 
//setInterval(() => {
//  visitCounts = {};
//}, 86400000);



