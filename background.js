// Set up a objects to store the visit counts for each website
const visitCounts = {};
const timeLimits = {};
const visitLimits = {}; 
/*
console.log("Hi from background");
console.log(visitLimits, timeLimits, visitCounts);
chrome.tabs.onActivated.addListener((activeInfo) => {
  // Get the URL of the active tab
  chrome.tabs.get(activeInfo.tabId, (tab) => {
  console.log("tab: ", tab, "tab.url after man: ", getMainUrl(tab.url));
  
  });
});
*/
function extractHostname(url){
	var url = new URL(url);
	var hostname = url.hostname;
	if (hostname.startsWith('www.'))
			{return hostname.substring(4)}
		return hostname
}

function deletewww(url) {
		if (url.startsWith('www.'))
			{return url.substring(4)}
		return url
}


// Set up a listener for when the new tab is opened
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

  // The `changeInfo` object contains information about the changes to the tab.
    	// Check if pendingUrl is undefined - when it is NOT new tab
	if (typeof changeInfo.url !== 'undefined')
		{
		//var url = new URL(changeInfo.url);
		//var hostname = url.hostname;
		var hostname = extractHostname(changeInfo.url);
		//console.log(`tab: ${tab} changeInfo.url: ${changeInfo.url} hostname ${hostname}` )
		//console.log(`Tab with id: ${tabId} was updated. New url: ${changeInfo.url}`);
		console.log("tab changed hostname extractHostname: ",hostname, "call handleHostname..")
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
			//var url = new URL(tab.url);
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


// Handle the hostname
function handleHostname(hostname, tabID){
    // Check if there is a visit count set for this website
    if (visitCounts[hostname]) {
      // If there is a visit count set, increment the count
      visitCounts[hostname]++;
      // Check if the visit count has reached the limit
      if (visitCounts[hostname] > visitLimits[hostname])  {
        // If the visit count has reached the limit, navigate the tab to a new URL
        chrome.tabs.update(tabID, {url: "https://www.rica.nsw.edu.au/resources/do-you-control-your-social-media/"});
      }
    } else {
      // If there is no visit count set for this website, set the count to 1
      visitCounts[hostname] = 1;
    }
    // Check if there is a time limit set for this website
    if (timeLimits[hostname]) {
      // If there is a time limit set, start a timer for the specified time
      const timeLimit = timeLimits[hostname];
      setTimeout(() => {
        // When the timer finishes, navigate the tab to a new URL
        chrome.tabs.update(tabID, {url: "https://www.rica.nsw.edu.au/resources/do-you-control-your-social-media/"});
      }, timeLimit * 1000);
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
		console.log(hostname, "Limited: ", visitLimit, "visits")
		//console.log(new URL(request.hostname).hostname)
	}
 	// Check if the message is a request to set a time limit
	if (request.type === "setTimeLimit") {
		var hostname = extractHostname(request.hostname);  
		var timeLimit = request.timeLimit;
		// Set the time limit for the specified website
		timeLimits[hostname] = timeLimit;
		console.log(hostname, "Limited: ", timeLimit, "seconds")
   }
 	//console.log("from background", visitCounts, timeLimits, visitLimits)	//DEBUG
 	// Check if the message is a request to delete hostname limits
	if (request.type === "deLimit") {
		console.log(" from background deLimit clicked");
		let hostname = extractHostname(request.hostname);
		// Set the visit limit for the specified website
		delete visitLimits[hostname];
		delete timeLimits[hostname];
		console.log("visitLimits:", visitLimits)
		console.log("timeLimits: ", timeLimits)

   }
	// Check if the message is a request to show limits   
	if (request.type === "showLimits") {
		console.log(" from background ShowLimits clicked");
		var timeLimitsSet  = new Set(Object.keys(timeLimits));
		var visitLimitsSet  = new Set(Object.keys(visitLimits)); 
		var allLimitsUnion = new Set([...timeLimitsSet, ...visitLimitsSet]);
		console.log(`Limits:\n ${Array.from(allLimitsUnion)}`)
		sendResponse({farewell: "goodbye from background"});
   }
});


// Reset the visit counts every day at midnight
setInterval(() => {
  visitCounts = {};
}, 86400000);


