var three = new Threeasy_Setup(true, 60,15);

console.log("Loaded.");

var x = new Area({bounds: [[-5,5],[-5,5]]});
var id = new Transformation({'expr': (i,t,x,y) => [x,y]});
var output = new PointOutput({width:0.2});

x.add(new PointOutput({width: 0.2, color:0xcccccc})); // grid

x.add(id); //transformation -> output
id.add(output);

three.on("update",function(time){
	x.activate(time.t);
});

//WANT:

id.setExpr({
expr: (i,t,x,y) => [x /(x*x+y*y), (-y) /(x*x+y*y)]
});

//this should smoothly animate into existence, lerping between the old function and the new one. The expr should shift x = oldfunc(...coordinates)[0] * t + newfunc(...coordinates)[0]*(1-t) for the duration of the thing.

//this would require making the Transformation aware of time and have some kind of timeElapsed variable.
//Alternately, make this an Animation class, so
new BlendAnimation({
	from: {(i,t,x,y) => [x,y]}
	to: {expr:  (i,t,x,y) => [x /(x*x+y*y), (-y) /(x*x+y*y)] }
	});

and then have this register somewhere, and then three.on('update'), advance all animations.
