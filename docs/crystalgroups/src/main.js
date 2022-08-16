import App from './App.svelte';

const app = new App({
	target: document.body,
	props: {
		onlyTwo: false
	}
});

export default app;
