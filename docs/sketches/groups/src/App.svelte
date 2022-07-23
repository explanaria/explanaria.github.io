<script>
	import InteractiveD6Creator from "./InteractiveD6Creator.svelte";
    import MoleculeCanvas from "./components/MoleculeCanvas.svelte";
</script>

<style>
    .maincontainer{
        font-family: Lora,serif;
        aspect-ratio: 16 / 9;
        max-width: 100vw;
        max-height: 100vh;
        margin: auto;
    }
    body{
        margin: 0;
    }
</style>

<div class="maincontainer">
    <MoleculeCanvas />
    <InteractiveD6Creator />
</div>
