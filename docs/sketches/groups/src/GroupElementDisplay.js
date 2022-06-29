<script>
    
</script>


<div class="position: relative">
    {#each d6group as element}
        <div class="groupelement" style="top: 0; left: 5">
            <MainDisplay>
        <RotateButton>
        <FlipButton>
        {#each element.visibleArrows as arrow}
            <Arrow onclick={arrow.handler()}>
        {/each}
    {/each}
</div>
