// Set up a objects to store the visit counts for each website
const visitCounts = {};
const timeLimits = {};
const visitLimits = {}; 
const timers = {};


// Extaract the hostname from URL
function extractHostname(url){
	var url = new URL(url);
	var hostname = url.hostname;
	if (hostname.startsWith('www.'))
			{return hostname.substring(4)}
		return hostname
}

// Set up a listener for when the new tab is opened
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

  // The `changeInfo` object contains information about the changes to the tab.
    	// Check if pendingUrl is undefined - when it is NOT new tab
	if (typeof changeInfo.url !== 'undefined'){
		var hostname = extractHostname(changeInfo.url);
		console.log(`tab: ${tab} changeInfo.url: ${changeInfo.url} hostname ${hostname}` )
		// DEBUG console.log(`Tab with id: ${tabId} was updated. New url: ${changeInfo.url}`);
		// DEBUG console.log("tab changed hostname extractHostname: ",hostname, "call handleHostname..")
		// Delete timer on this tab if exist
		if (timers[tabId]){
			clearTimeout(timers[tabId])
			delete timers[tabId];
			console.log(`clear timout on tabId: ${tabId}`);
			}
		handleHostname(hostname, tabId)
		}
	else
	// It is a new tab. can escape
	{return;}

	});


// Set up a listener for when the active tab in the browser changes
chrome.tabs.onActivated.addListener((activeInfo) => {
  // Get the URL of the active tab
  chrome.tabs.get(activeInfo.tabId, (tab) => {
  	// check if pendingUrl is undefined - when it is NOT new tab
		if (typeof tab.pendingUrl == 'undefined'){
			//console.log("tab.url.pendingUrl == 'undefined'")
			//console.log("tab: ",tab)
			var hostname = extractHostname(tab.url);
			//console.log("tab: ", tab, "tab.url:", tab.url, "hostname: ",hostname);
			console.log("tab switched hostname extractHostname: ",hostname, "call handleHostname..")
			handleHostname(hostname, tab.id)
			}
		else
		// It is a new tab. can escape
		//console.log("tab.url.pendingUrl !== 'undefined'")
		{return;}

		

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
    // Check if there is a visit count set for this website
    if (visitCounts[hostname]) {
      // If there is a visit count set, increment the count
      visitCounts[hostname]++;
      // Check if the visit count has reached the limit
      if (visitCounts[hostname] > visitLimits[hostname])  {
        // If the visit count has reached the limit, navigate the tab to a new URL
        chrome.tabs.update(tabID, {url: "https://github.com/jonis100/LiLimit#visits-per-day-exceeded"});
      }
    } else {
      // If there is no visit count set for this website, set the count to 1
      visitCounts[hostname] = 1;
    }
    // Check if there is a time limit set for this website
    if (timeLimits[hostname]) {
      // If there is a time limit set, start a timer for the specified time
      const timeLimit = timeLimits[hostname];
      // When the timer finishes, navigate the tab to a new URL
      const timer = setTimeout(() => {
        chrome.tabs.update(tabID, {url: "https://github.com/jonis100/LiLimit#time-exceeded"});
      }, timeLimit * 1000);
      timers[tabID] = timer;
      console.log(`timers[tabID]: set on tabId: ${tabID} timer: ${timer}`);
     }
}    
    

// Set up a listener for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	// Check if the message is a request to set a visits count limit
	if (request.type === "setVisitLimit") {
		var hostname = extractHostname(request.hostname);
		var visitLimit = request.visitLimit;
		// Set the visit limit for the specified website
		visitLimits[hostname] = visitLimit
		// DEBUG console.log(hostname, "Limited: ", visitLimit, "visits")
		// DEBUG console.log(new URL(request.hostname).hostname)
	}
 	// Check if the message is a request to set a time limit
	if (request.type === "setTimeLimit") {
		var hostname = extractHostname(request.hostname);  
		var timeLimit = request.timeLimit;
		// Set the time limit for the specified website
		timeLimits[hostname] = timeLimit;
		// DEBUG console.log(hostname, "Limited: ", timeLimit, "seconds")
   }
 	// DEBUG console.log("from background", visitCounts, timeLimits, visitLimits)	//DEBUG
 	// Check if the message is a request to delete hostname limits
	if (request.type === "deLimit") {
		// DEBUG console.log(" from background deLimit clicked");
		let hostname = extractHostname(request.hostname);
		// Set the visit limit for the specified website
		delete visitLimits[hostname];
		delete timeLimits[hostname];
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


