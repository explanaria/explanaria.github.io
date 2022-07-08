<script>
    export let start = [0,0];
    export let end = [0,0];
    export let stroke="black"
    export let strokeWidth = "5";
    export let markerEnd;

    export let elementRadius = 60; //if start and end are the centers of elements, end the arrows early to give the group elements a bit of a margin

    function moveBackwardsAConstantDistance(endpoint, pointToMoveTowards, distance){

        let backwardsDirection = [pointToMoveTowards[0] - endpoint[0], pointToMoveTowards[1] - endpoint[1]];
        let norm = Math.sqrt(backwardsDirection[0]*backwardsDirection[0] + backwardsDirection[1]*backwardsDirection[1]);

        let normalizedBackwards = [backwardsDirection[0]/norm, backwardsDirection[1]/norm];

        return [endpoint[0] + normalizedBackwards[0]*distance, endpoint[1] + normalizedBackwards[1]*distance]
    }


    $: movedStartPoint = moveBackwardsAConstantDistance(start, end, elementRadius)
    $: movedEndPoint = moveBackwardsAConstantDistance(end, start, elementRadius)

</script>

<line x1={movedStartPoint[0]} y1={movedStartPoint[1]} x2={movedEndPoint[0]} y2={movedEndPoint[1]} 
    stroke={stroke} marker-end={markerEnd}
    stroke-width={strokeWidth} />


<!-- 
<path class="arrow" d="M {movedStartPoint[0]} {movedStartPoint[1]} C {} {} {} {} {} {} {} " marker-end="url(#arrowhead)"/> -->
