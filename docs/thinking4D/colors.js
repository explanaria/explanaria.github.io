import "./presentationmode.js";

/* colors*/
export let blue = "#0070f0";
export let green = 0x50d050;

export let fadedRed = 0xf07000;
export let fadedPurple = 0xf070f0;

export let gray = 0x555555;


export let pointColor = 0xff8C00;
export let pointColorCanvas = '#ff8C00';
export let pointColorDragging =  '#f07000';

export let airplanePointColor = "hsl(0,100%,50%)";

export let coordinateLine1Color = 'hsl(260,81%,69%)';
export let coordinateLine1ColorDarker = 'hsl(260,71%,50%)';

export let coordinateLine2Color = 'hsl(140,81%,69%)';
export let coordinateLine2ColorLighter = 'hsl(160,81%,85%)';
export let coordinateLine2ColorDarker = 'hsl(160,71%,50%)';

export let coordinateLine3Color = 'hsl(40,81%,69%)';
export let coordinateLine3ColorDarker = 'hsl(40,71%,50%)';

export let coordinateLine4Color = 'hsl(305,99%,74%)'; //matches thing in 7 visualizing 4d.js
export let coordinateLine4ZeroColor = 'hsl(205,99%,74%)'; //color for w=0. identical to hypercube
//export let coordinateLine4ZeroColor = 'hsl(160, 0%,30%)'; //color for w=0.
export let coordinateLine4NegativeColor = 'hsl(305,50%,30%)'; //color for w=-1.


export let lightgray = 0xbbbbbb;
export let verylightgray = 0xdddddd;
export let kindalightgray = 0x999999;

//GENDERHYPERCUBE

coordinateLine4Color = 'hsl(205, 99%, 74%)'; //blue
coordinateLine4ZeroColor = 'hsl('+(205+100)+', 85%, 74%)' //pink
coordinateLine4NegativeColor = 'hsl('+(205+100)+', 85%, 50%)'


coordinateLine4Color = 'hsl('+(205+110)+', 99%, 50%)'; //pink
//coordinateLine4ZeroColor = 'hsl('+(205+0)+', 70%, 50%)' // a nice deep blue
//coordinateLine4ZeroColor = 'hsl('+(205+80)+', 20%, 50%)' // grayish purple
coordinateLine4ZeroColor = 'hsl('+(205+80)+', 40%, 40%)' // deep purple
coordinateLine4NegativeColor = 'hsl('+(205+100)+', 85%, 40%)'

export let orthographic4VecColor = 'hsl('+(205+160)+', 99%, 50%)'; //red

export let planeOfRotationColor = '#AF6E8A'

/*
// green -> red
coordinateLine4Color = 'hsl(140, 70%, 60%)';
coordinateLine4ZeroColor = 'hsl('+(0)+', 85%, 74%)'
coordinateLine4NegativeColor = 'hsl('+(360-140)+', 85%, 74%)'
*/

/*
//blue->red
coordinateLine4Color = 'hsl(0, 86%, 50%)';
coordinateLine4ZeroColor = 'hsl(200, 85%, 60%)'
coordinateLine4NegativeColor = 'hsl(280,  85%, 60%)'
*/

export let disabledGray = "#f0f0f0";

//choose what color to color a point based on its position in the 4th dimension.
//takes in a coordinate w, and returns a blended between 3 colors for w=-1, w=0, w=1.
const zeroWColor = new THREE.Color(coordinateLine4ZeroColor);
const oneWColor = new THREE.Color(coordinateLine4Color);
const negativeWColor = new THREE.Color(coordinateLine4NegativeColor);
export function fourDColorMap(wCoordinate){
 let fourDRampAmt = Math.min(1, wCoordinate) //ramp from 0-1 then hold steady at 1
 let fourDAbsRampAmt = Math.min(1, Math.abs(wCoordinate)) //ramp from 0-1 then hold steady at 1

 if(wCoordinate > 0){
   //This should be coordinateline4color. w=+1
   return zeroWColor.clone().lerp(oneWColor.clone(), fourDAbsRampAmt); 
 }else{
    //this is coordinateLine4NegativeColor. w=-1
   return zeroWColor.clone().lerp(negativeWColor.clone(), fourDAbsRampAmt); 
 }
}
