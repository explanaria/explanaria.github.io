<script>
    import * as EXP from "../../../resources/build/explanaria-bundle.js";
    export let start = [0,0];
    export let end = [0,0];
    export let stroke="black"
    export let strokeWidth = "0.2";
    export let markerEnd;

    export let isCurved = true;

    export let elementAvoidRadius = 2.75; //in em. if start and end are the centers of elements, end the arrows early to give the group elements a bit of a margin

    function moveInDirection(point, direction, distance){
        
        let norm = Math.sqrt(direction[0]*direction[0] + direction[1]*direction[1]);

        let normalizedDir = [direction[0]/norm, direction[1]/norm];
        return [point[0] + normalizedDir[0]*distance, point[1] + normalizedDir[1]*distance]
    }

    function moveBackwardsAConstantDistance(endpoint, pointToMoveTowards, distance){

        let backwardsDirection = [pointToMoveTowards[0] - endpoint[0], pointToMoveTowards[1] - endpoint[1]];
        return moveInDirection(endpoint, pointToMoveTowards, distance);

    }
    function rotate(vec, degrees){
        let rad = degrees * Math.PI / 180;
        return [vec[0] * Math.cos(rad) - vec[1]* Math.sin(rad),
                vec[0] * Math.sin(rad) + vec[1]* Math.cos(rad)
        ]
    }
    function length(array){

        let lengthSquared = 0;
	    for(var i=0;i<array.length;i++){
		    lengthSquared += array[i]*array[i];
	    }
        return Math.sqrt(lengthSquared)
    }

    //don't point directly into an element, point to a point outside it to give some margin
    $: outgoingDirection = rotate(EXP.Math.vectorScale(EXP.Math.vectorSub(end, start), 1/6), -15);
    $: incomingDirection = rotate(EXP.Math.vectorScale(EXP.Math.vectorSub(start, end), 1/6), 15);

    $: movedStartPoint = isCurved ? 
            moveInDirection(start, outgoingDirection, elementAvoidRadius)
            : moveBackwardsAConstantDistance(start, end, elementAvoidRadius)
    $: movedEndPoint = isCurved ?
            moveInDirection(end, incomingDirection, elementAvoidRadius)
            : moveBackwardsAConstantDistance(end, start, elementAvoidRadius)


    //animation
    let displayedEndPoint = end;
    $: displayedEndPoint = movedEndPoint;
    /*
    let animateAppearance = true;
    if(animateAppearance){
        displayedEndPoint = movedStartPoint;
        EXP.TransitionTo(displayedEndPoint, {0: movedEndPoint[0], 1: movedEndPoint[1]}, 5000); //weird bugs
    }*/
    
    $: s = movedStartPoint;
    $: e = displayedEndPoint;

    $: outgoingArrowDirection = rotate(EXP.Math.vectorScale(EXP.Math.vectorSub(e, s), 1/3), -15);
    $: incomingArrowDirection = rotate(EXP.Math.vectorScale(EXP.Math.vectorSub(s, e), 1/3), 15);

    $: controlPoint1 = EXP.Math.vectorAdd(outgoingArrowDirection, s)
    $: controlPoint2 = EXP.Math.vectorAdd(incomingArrowDirection, e)

</script>


{#if isCurved}
<path d="M {s[0]} {s[1]} C {controlPoint1[0]} {controlPoint1[1]} {controlPoint2[0]} {controlPoint2[1]} {e[0]} {e[1]} "
    stroke={stroke} marker-end={markerEnd} fill="transparent"
    stroke-width={strokeWidth} class="fadeInImmediately"/>
{:else}
<line x1={movedStartPoint[0] + "em"} y1={movedStartPoint[1] + "em"} x2={displayedEndPoint[0] + "em"} y2={displayedEndPoint[1] + "em"} 
    stroke={stroke} marker-end={markerEnd}
    stroke-width={strokeWidth} class="fadeInImmediately"/>
{/if}
