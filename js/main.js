var three = new Threeasy_setup();

/*
points = [];

for(var x=-10;x<10;x++){
	for(var y=-10;y<10;y++){
		let pt = new Point({x:x, y:y, width:0.3})

		if(x == 0 || y == 0)pt.color = 0xff0000;

		points.push(pt);
	}
} 
*/
console.log("Loaded.");


var x = new Area({bounds: [[-5,5],[-5,5]]});
var square = new Transformation({'expr': (i,t,x,y) => [Math.cos((t+i))+5*Math.sin((t+i)/20),Math.sin(t+i)*Math.cos(2*(t+i))]});
var square2 = new Transformation({'expr': (i,t,x,y) => [x+Math.cos(2*t),y+Math.sin(2*t)]});
var output = new PointOutput({width:0.2});

x.add(new PointOutput({width: 0.2, color:0xcccccc})); // grid

x.add(square); //transformation -> output
square.add(square2); //transformation -> output
square2.add(output);

three.on("update",function(time){
	x.activate(time.t);
});
