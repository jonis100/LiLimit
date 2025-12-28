
function limitTime(hostname, timeLimit){
	chrome.runtime.sendMessage({
	type: "setTimeLimit",
	hostname: hostname,
	timeLimit: timeLimit
  })
  };


function limitVisit(hostname, visitLimit){
	chrome.runtime.sendMessage({
	type: "setVisitLimit",
	hostname: hostname,
	visitLimit: visitLimit
  })
  };
  

const form = document.querySelector("form");
form.addEventListener("submit", (event) => {
  event.preventDefault();

  const hostname = document.getElementById("hostname").value;
  const timeLimit = document.getElementById("timeLimit").value;
  const visitLimit = document.getElementById("visitLimit").value;

  	if (timeLimit && visitLimit){
showMessage(`This submit will limit the hostname ${hostname}:\n ${timeLimit} minutes \n ${visitLimit} visits`)
  		limitTime(hostname, timeLimit)
  		limitVisit(hostname, visitLimit)
  	}
  	else if(timeLimit){
showMessage(`This submit will limit the hostname ${hostname}:\n ${timeLimit} minutes \n No limit visits`)
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



const ShowLimitsBtn = document.getElementById("ShowLimits");
ShowLimitsBtn.addEventListener("click", (event) => {
	event.preventDefault();

	(async () => {
		let response = await chrome.runtime.sendMessage({
		type: "showLimits"
  	});
  	showMessage(response.limits || 'No limits')
  	})();
});



const DeleteLimitsBtn = document.getElementById("DeleteLimits");
DeleteLimitsBtn.addEventListener("click", (event) => {
	event.preventDefault();
	const hostname = document.getElementById("hostname").value;

		alert(`Deleted all the limits on the hostname :\n ${hostname}`)

  chrome.runtime.sendMessage({
    type: "deLimit",
    hostname: hostname
  });
});


function showMessage(text, duration = 5000, isError = false){
	const el = document.getElementById('message');
	if(!el){

		console.log(text);
		return;
	}
	el.hidden = false;
	el.textContent = text || '';
	el.style.color = isError ? 'var(--danger)' : '';

	clearTimeout(showMessage._timer);
	showMessage._timer = setTimeout(()=>{
		el.hidden = true;
		el.textContent = '';
	}, duration);
}
