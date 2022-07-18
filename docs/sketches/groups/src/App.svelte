<script>
	import InteractiveD6Creator from "./InteractiveD6Creator.svelte";
    import MoleculeCanvas from "./components/MoleculeCanvas.svelte";
</script>

<style>
    .main{
        font-family: Lora,serif;
    }
</style>


<MoleculeCanvas />

<div class="main">
    <InteractiveD6Creator />
</div>
