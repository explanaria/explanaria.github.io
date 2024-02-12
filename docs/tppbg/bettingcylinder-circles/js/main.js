"use strict";
var bettinganim;
var controls;
document.body.onload = function(){
	var canvas_elem = document.getElementById("bettingCanvas");
	bettinganim = new BettingCylinder(canvas_elem);
	//hexes.beginAppearAnim(true, "gray");
	update();
}
function update(){
	bettinganim.update();
	requestAnimationFrame(update);
}


