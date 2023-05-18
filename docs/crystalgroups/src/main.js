import App from './App.svelte';

import "presentationmode.js";

const app = new App({
	target: document.body,
	props: {
		onlyThree: false
	}
});

export default app;
