import {gcd, distSquared, isInteger, roundDenominator} from "./1-trianglemath.js";
import {validIntegerColor, invalidIntegerColor} from "./colors.js";

export function computeTriangleArea(){
    //thanks stackoverflow poster Piquito
    let x1 = trianglePoints[0][0];
    let y1 = trianglePoints[0][1];
    let x2 = trianglePoints[1][0];
    let y2 = trianglePoints[1][1];
    let x3 = trianglePoints[2][0];
    let y3 = trianglePoints[2][1];
    return 1/2 * Math.abs((x2-x1)*(y3-y1) - (x3-x1)*(y2-y1));
}

export function isDistanceInteger(point1, point2){
        let distanceSquared = (point1[0]-point2[0])(point1[0]-point2[0]) + (point1[0]-point2[0])*(point1[0]-point2[0])
        if(distanceSquared % 1 == 0){ //if distance squared is an integer
            return true;
        }
        return false;
}

export function areAllSideLengthsIntegers(){
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


const prebakedLabels = { //backwards lookup table
    "\\frac{35}{12}": 35/12,
    "\\frac{24}{5}": 24/5, 
    "\\frac{337}{60}": 337/60,
    "\\frac{780}{323}": 780/323,
    "\\frac{323}{30}": 323/30,
    "\\frac{106921}{9690}": 106921/9690,
}



export function renderLengthHighlightingIrrationals(point1, point2){
    let distanceSquared = distSquared(point1, point2);
    let distance = Math.sqrt(distanceSquared);

    for(let label in prebakedLabels){
        if( Math.abs(distance-prebakedLabels[label]) < 0.0001){
            return label;
        }
    }

    if(isInteger(distanceSquared*roundDenominator*roundDenominator)){
        //sqrt(5)/2  or something

        let numerator = distanceSquared*roundDenominator*roundDenominator;
        let denominator = roundDenominator*roundDenominator;

        
        let commonFactor = gcd(numerator, denominator);

        let reducedNumeratorSquared = Math.round(numerator/commonFactor);
        let reducedDenominatorSquared = Math.round(denominator/commonFactor);
        //can now render sqrt(reducedNumerator)/sqrt(reducedDenominator)

        let sqrtNum = Math.sqrt(reducedNumeratorSquared);
        let sqrtDenom = (Math.sqrt(reducedDenominatorSquared))

        if(isInteger(sqrtDenom)){
            if(sqrtDenom == 1){
                if(isInteger(sqrtNum)){
                    return sqrtNum;
                }else{
                    return "\\sqrt{"+reducedNumeratorSquared+"}";
                }
            }else{ //denominator is an integer
                if(isInteger(sqrtNum)){
                    return "\\frac{"+sqrtNum+"}{"+sqrtDenom+"}";
                }else{
                    return "\\frac{\\sqrt{"+reducedNumeratorSquared+"}}{"+sqrtDenom+"}";
                }
            }
        }else{ //denominator is irrational
            return "\\frac{\\sqrt{"+reducedNumeratorSquared+"}}{"+reducedDenominatorSquared+"}";
        }
    }else{
        //other real
        return distance.toFixed(2);
    }
}
window.renderLengthHighlightingIrrationals = renderLengthHighlightingIrrationals;


export function colorHighlightingIrrationals(point1, point2){
    let distanceSquared = distSquared(point1, point2);
    let distance = Math.sqrt(distanceSquared);

    for(let label in prebakedLabels){
        if( Math.abs(distance-prebakedLabels[label]) < 0.0001){
            return validIntegerColor;
        }
    }


    if(isInteger(distanceSquared*roundDenominator*roundDenominator)){
        //sqrt(5)/2  or something

        let numerator = distanceSquared*roundDenominator*roundDenominator;
        let denominator = roundDenominator*roundDenominator;

        let commonFactor = gcd(numerator, denominator);

        let reducedNumeratorSquared = Math.round(numerator/commonFactor);
        let reducedDenominatorSquared = Math.round(denominator/commonFactor);
        //can now render sqrt(reducedNumerator)/sqrt(reducedDenominator)

        let sqrtNum = Math.sqrt(reducedNumeratorSquared);
        let sqrtDenom = (Math.sqrt(reducedDenominatorSquared))

        if(isInteger(sqrtDenom) && isInteger(sqrtNum)){
            //rational
            return validIntegerColor;
        }else{
            //not rational
            return invalidIntegerColor;
        }
    }else{
        //other real
        return invalidIntegerColor;
    }
}
