 //charts for RP2
let twoPi = 2*Math.PI;
let pi = Math.PI;
let map = (x, min1,max1,min2,max2) => min2 + (max2 - min2) * ((x - min1) / (max1 - min1));

let normalizedCoords = () => RP2Clamp([map(userPointParams.x2, 0, twoPi, -1, 1),map(userPointParams.x1, 0, pi, -1, 1)])  //[0-pi] to [-1 - 1]
let denormalize = (x2,x1) => [map(x2, -1, 1,0, twoPi), map(x1, -1, 1, 0, pi)]

function setUserPointParams(arr){
    userPointParams.x2 = arr[0], 
    userPointParams.x1 = arr[1]
}
let vecAdd = EXP.Math.vectorAdd;

function sign(x){
    if(x == 0)return 1;
    return Math.sign(x);
}
function wrapToInterval(x,size){
    //move number into [-1, +1]
    //x%1 would work, but -1%1 == 0 in JS
    if(Math.abs(x) == size)return x;
    return x%size; //javascript % is absolute-valued: -1 % 3 == -1, not 2. this is normally terrible but used here
}

function RP2Clamp(pt){
    if(Math.abs(pt[0]) > 1){
        pt[0] -= 2 * sign(pt[0]); //the width of this coordinate system
       // pt[1] *= -1; //uncomment for a klein bottle
    }
    if(Math.abs(pt[1]) > 1){
        //pt[0] *= -1;
        pt[0] += 2* sign(pt[0]);
        pt[1] -= 2 * sign(pt[1]); //the width of this coordinate system
    }
    pt[0] = wrapToInterval(pt[0],1);
    pt[1] = wrapToInterval(pt[1],1);
    return pt;
}
function translateOnRP2(arr1, translation){
    let pt = EXP.Math.vectorAdd(arr1, translation);
    return RP2Clamp(pt);
}

function toChartCoords(offset){
    return translateOnRP2(normalizedCoords(), offset);
}
function fromChartCoords(x,y, offset){
    let reverseOffset = [-offset[0], -offset[1]];
    let RP2Coords = RP2Clamp(vecAdd([x,y],reverseOffset));
    setUserPointParams(denormalize(...RP2Coords));
}


function threeDPos(x,y, manifoldParametrization){
    return manifoldParametrization.expr(0,0, x,y);
}

function setupRP2Atlas(objects, manifoldParametrization){
    
    let chart1 = new PlaneSliderWithANewCanvas('blue', 'chartCanvases', 
        ()=>normalizedCoords(), 
        (x,y) => setUserPointParams(denormalize(x,y))
    );

    //right
    let chart2 = new PlaneSliderWithANewCanvas('green', 'chartCanvases', 
        ()=>toChartCoords([1,0]), 
        (x,y) => fromChartCoords(x, y, [1,0]),
    );

    let chart3 = new PlaneSliderWithANewCanvas('red', 'chartCanvases', 
        ()=>toChartCoords([0,1]), 
        (x,y) => fromChartCoords(x,y, [0,1])
    );


    [chart1, chart2, chart3].forEach((x) => objects.push(x));
}
