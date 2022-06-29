<script>
    import {GroupElement, makegroup} from "./groupmath.js";
    import GroupElementDisplay from "./GroupElementDisplay.svelte";

    let r = new GroupElement("r", "(123)");
    let f = new GroupElement("f", "(23)");
    let d6group = makegroup([r,f], {"rfr":"f", "rrr":"", "ff":""});

    export let elements = [];
    export let visibleElements = [];

    let generators = ["r", "f"];
    let relations = ["rrr=e", "rfr=f"];
    
</script>

<style>
.groupdisplay{
    display:grid;
    grid: 1fr 1fr / 1fr 1fr;
}

</style>

<div class="groupdisplay">
    {#each d6group as element}
        <GroupElementDisplay element={element} />
    {/each}
</div>
