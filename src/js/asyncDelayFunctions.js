async function delay(waitTime){
	return new Promise(function(resolve, reject){
		window.setTimeout(resolve, waitTime);
	});

}

export {delay};
