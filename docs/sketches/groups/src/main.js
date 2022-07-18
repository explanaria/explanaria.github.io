import App from './App.svelte';

import "./polymorphdata.js";

const app = new App({
	target: document.body,
	props: {
		name: 'world'
	}
});

export default app;
