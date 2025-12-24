import { extractHostname, limits_to_string } from './utils.js';


const visitCounts = {};
const timeLimits = {};
const visitLimits = {}; 
const timers = {};
const lastHandle = {};


chrome.storage && chrome.storage.local && chrome.storage.local.get(['timeLimits', 'visitLimits'], (result) => {
	try {
		if (result && result.timeLimits) Object.assign(timeLimits, result.timeLimits);
		if (result && result.visitLimits) Object.assign(visitLimits, result.visitLimits);
		console.log('Loaded persisted limits from storage:', {timeLimits, visitLimits});
	} catch (e) { console.error('Error loading limits from storage', e); }
});


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



chrome.tabs.onActivated.addListener((activeInfo) => {

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
		console.log("new tab from onActivated");
		return;}

		

  });
});


function handleHostname(hostname, tabID){
	console.log("Handling: ", hostname);

		if (visitCounts[hostname] && lastHandle[tabID] != hostname) {

			visitCounts[hostname]++;

			if (visitLimits[hostname] !== undefined && visitCounts[hostname] > visitLimits[hostname])  {

				chrome.tabs.update(tabID, {url: "https://github.com/jonis100/LiLimit#visits-per-day-exceeded"});
			}
		} else {
			if (visitLimits[hostname] && lastHandle[tabID] != hostname){

				visitCounts[hostname] = 1;
			}
		}

		if (timeLimits[hostname] !== undefined) {

      const timeLimit = timeLimits[hostname];

      const timer = setTimeout(() => {
        chrome.tabs.update(tabID, {url: "https://github.com/jonis100/LiLimit#time-exceeded"});
      }, timeLimit * 60000);
      timers[tabID] = timer;
      console.log(`timers[tabID]: set on tabId: ${tabID} timer: ${timer}`);
     }
     lastHandle[tabID] = hostname;
}    


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.hostname && extractHostname(request.hostname) === "github.com"){
		console.log("You can't limit github.com. \n " +
		"\t1. It will cause an infinite loop. \n" +
		"\t2. There isn't worried you will waste youre time there..");
		return;
	};

	if (request.type === "setVisitLimit") {
		var hostname = extractHostname(request.hostname);
		var visitLimit = request.visitLimit;

		const v = Number(visitLimit);
		visitLimits[hostname] = Number.isFinite(v) ? v : visitLimit;

		saveLimitsToStorage();
	}

	if (request.type === "setTimeLimit") {
		var hostname = extractHostname(request.hostname);  
		var timeLimit = request.timeLimit;

		const t = Number(timeLimit);
		timeLimits[hostname] = Number.isFinite(t) ? t : timeLimit;

		saveLimitsToStorage();
   }

    if (request.type === "deLimit") {
		let hostname = extractHostname(request.hostname);

		delete visitLimits[hostname];
		delete timeLimits[hostname];
		delete visitCounts[hostname];

		saveLimitsToStorage();

   }

	if (request.type === "showLimits") {
		console.log(" from background ShowLimits clicked");
		var timeLimitsSet  = new Set(Object.keys(timeLimits));
		var visitLimitsSet  = new Set(Object.keys(visitLimits)); 
		var allLimitsUnion = new Set([...timeLimitsSet, ...visitLimitsSet]);
		var limitation_respond  = ((allLimitsUnion.size > 0) ? limits_to_string(Array.from(allLimitsUnion), timeLimits, visitLimits) : "No Limits Yet");
		sendResponse({limits: limitation_respond});
   }
});



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

    func();

    setInterval(func, twentyFourHours);
  }, eta_ms);
}



runAtSpecificTimeOfDay(0,0,() => { 

	for (var member in visitCounts) delete visitCounts[member];

	for (var member in timers) delete timers[member];
				});



