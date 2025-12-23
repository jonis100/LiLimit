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
		showMessage(`This submmit will limit the hostname ${hostname}:\n ${timeLimit} sec \n ${visitLimit} visits`)
  		limitTime(hostname, timeLimit)
  		limitVisit(hostname, visitLimit)
  	}
  	else if(timeLimit){
		showMessage(`This submmit will limit the hostname ${hostname}:\n ${timeLimit} sec \n No limit visits`)
  		limitTime(hostname, timeLimit)
  	}
  	else if (visitLimit){
		showMessage(`This submmit will limit the hostname ${hostname}:\n No limit time \n ${visitLimit} visits`)
  		limitVisit(hostname, visitLimit)
  	}
  	else{
		showMessage(`No limits applied on ${hostname}`)
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
  	showMessage(response.limits || 'No limits')
  	})();
});


// Set up a listener for when the DeleteLimits is clicked
const DeleteLimitsBtn = document.getElementById("DeleteLimits");
DeleteLimitsBtn.addEventListener("click", (event) => {
	event.preventDefault();
	const hostname = document.getElementById("hostname").value;
		// showMessage(`Deleted all the limits on the hostname :\n ${hostname}`)
		alert(`Deleted all the limits on the hostname :\n ${hostname}`)
// Send a message to the background script to delete the time and visit limits
  chrome.runtime.sendMessage({
    type: "deLimit",
    hostname: hostname
  });
});

// showMessage: non-blocking status inside the popup
function showMessage(text, duration = 5000, isError = false){
	const el = document.getElementById('message');
	if(!el){
		// fallback to console if message element not present
		console.log(text);
		return;
	}
	el.hidden = false;
	el.textContent = text || '';
	el.style.color = isError ? 'var(--danger)' : '';
	// clear after duration
	clearTimeout(showMessage._timer);
	showMessage._timer = setTimeout(()=>{
		el.hidden = true;
		el.textContent = '';
	}, duration);
}
