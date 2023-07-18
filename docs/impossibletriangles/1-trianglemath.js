import * as EXP from "../resources/build/explanaria-bundle.js";

export function vecScale(vec1, scaleFactor){
    //move to EXP.Utils soon
    let addedVec = [];
    EXP.Utils.assert(EXP.Utils.is1DNumericArray(vec1));
    for(let i=0;i<vec1.length;i++){
        addedVec.push(vec1[i]*scaleFactor)
    }
    return addedVec;
}

export function vecAdd(vec1, vec2){
    //move to EXP.Utils soon
    let addedVec = [];
    EXP.Utils.assert(EXP.Utils.is1DNumericArray(vec1));
    EXP.Utils.assert(EXP.Utils.is1DNumericArray(vec2));
    for(let i=0;i<vec1.length;i++){
        addedVec.push(vec1[i]+vec2[i])
    }
    return addedVec;
}

export function isInteger(num){
    return Math.abs(Math.round(num)-num) < 0.001;
}


export function distSquared(vec1, vec2){
    //move to EXP.Utils soon
    let sum = 0;
    EXP.Utils.assert(EXP.Utils.is1DNumericArray(vec1));
    EXP.Utils.assert(EXP.Utils.is1DNumericArray(vec2));
    for(let i=0;i<vec1.length;i++){
        sum += (vec1[i]-vec2[i])*(vec1[i]-vec2[i])
    }
    return sum;
}
export function dist(vec1, vec2){
    return Math.sqrt(distSquared(vec1, vec2))
}



export function roundToIntegerIfClose(n){
    let closestInteger = Math.round(n)
    let distanceToInteger = Math.abs(n - closestInteger);
    if(distanceToInteger < 0.2){
        return closestInteger
    }
    return n;
}

export function roundPointIfCloseToInteger(x,y){
    //return [x,y] but snap to an integer grid point if it's close
    let roundedX = Math.round(x);
    let roundedY = Math.round(y);
    let distToGridSquared = distSquared([x,y], [roundedX, roundedY]);
    if(distToGridSquared < 0.15){
        x = roundedX;
        y = roundedY;
    }
    return [x,y]
}

export let roundDenominator = 2; //the maximum denominator
export function setRoundDenominator(val){
    roundDenominator = val;
}

export function roundCoord(n){
    return Math.round(n*roundDenominator)/roundDenominator;
}

export function roundPoint(x,y){
    //return [x,y] but snap to an integer grid point if it's close
    let roundedX = Math.round(x*roundDenominator)/roundDenominator;
    let roundedY = Math.round(y*roundDenominator)/roundDenominator;
    let distToGridSquared = distSquared([x,y], [roundedX, roundedY]);
    if(distToGridSquared < 0.15){
        x = roundedX;
        y = roundedY;
    }
    return [x,y]
}

export function gcd(a,b){
    if (b < 0.0001) {
        return a;
    }
    return gcd(b, a % b);
}




