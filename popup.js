// Send a message to the background script to set the time limits
function limitTime(hostname, timeLimit){
	chrome.runtime.sendMessage({
	type: "setTimeLimit",
	hostname: hostname,
	timeLimit: timeLimit
  })
  };

// Send a message to the background script to set the visit limits
function limitVisit(hostname, visitLimit){
	chrome.runtime.sendMessage({
	type: "setVisitLimit",
	hostname: hostname,
	visitLimit: visitLimit
  })
  };
  
// Set up a listener for when the form is submitted
const form = document.querySelector("form");
form.addEventListener("submit", (event) => {
  event.preventDefault();
  // Get the hostname, time limit, and visit limit from the form
  const hostname = document.getElementById("hostname").value;
  const timeLimit = document.getElementById("timeLimit").value;
  const visitLimit = document.getElementById("visitLimit").value;
  	//hostnames.push(hostname)
  	if (timeLimit && visitLimit){
  		alert(`This submmit will limit the hostname ${hostname}:\n ${timeLimit} sec \n ${visitLimit} visits`)
  		limitTime(hostname, timeLimit)
  		limitVisit(hostname, visitLimit)
  	}
  	else if(timeLimit){
  		alert(`This submmit will limit the hostname ${hostname}:\n ${timeLimit} sec \n No limit visits`)
  		limitTime(hostname, timeLimit)
  	}
  	else if (visitLimit){
  		alert(`This submmit will limit the hostname ${hostname}:\n No limit time \n ${visitLimit} visits`)
  		limitVisit(hostname, visitLimit)
  	}
  	else{
  		alert(`No limits applied on ${hostname}`)
  	}
  	
});


// Set up a listener for when the ShowLimits is clicked
const ShowLimitsBtn = document.getElementById("ShowLimits");
ShowLimitsBtn.addEventListener("click", (event) => {
	event.preventDefault();
	// Send a message to the background script to show limits
	
	(async () => {
		let response = await chrome.runtime.sendMessage({
		type: "showLimits"
  	});
  	alert(response.limits)
  	})();
});


// Set up a listener for when the DeleteLimits is clicked
const DeleteLimitsBtn = document.getElementById("DeleteLimits");
DeleteLimitsBtn.addEventListener("click", (event) => {
	event.preventDefault();
	const hostname = document.getElementById("hostname").value;
  	alert(`Deleted all the limits on the hostname :\n ${hostname}`)
// Send a message to the background script to delete the time and visit limits
  chrome.runtime.sendMessage({
    type: "deLimit",
    hostname: hostname
  });
});
