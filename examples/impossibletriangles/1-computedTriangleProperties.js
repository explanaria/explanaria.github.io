
function computeTriangleArea(){
    //thanks stackoverflow poster Piquito
    let x1 = trianglePoints[0][0];
    let y1 = trianglePoints[0][1];
    let x2 = trianglePoints[1][0];
    let y2 = trianglePoints[1][1];
    let x3 = trianglePoints[2][0];
    let y3 = trianglePoints[2][1];
    return 1/2 * Math.abs((x2-x1)*(y3-y1) - (x3-x1)*(y2-y1));
}

function isDistanceInteger(point1, point2){
        let distanceSquared = (point1[0]-point2[0])(point1[0]-point2[0]) + (point1[0]-point2[0])*(point1[0]-point2[0])
        if(distanceSquared % 1 == 0){ //if distance squared is an integer
            return true;
        }
        return false;
}

function areAllSideLengthsIntegers(){
    pairs = [
        [ trianglePoints[0], trianglePoints[1]],
        [ trianglePoints[1], trianglePoints[2]]
        [ trianglePoints[0], trianglePoints[2]]
    ]
    let allSidesIntegers = true;
    for(var pair in pairs){
        let point1 = pair[0];
        let point2 = pair[1];
        if (!isDistanceInteger(point1, point2)){
            allSidesIntegers = false;
        }
    }
    return allSidesIntegers;
}

export {areAllSideLengthsIntegers, computeTriangleArea};
