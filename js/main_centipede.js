var three = new Threeasy_Setup(true, 60,15);

console.log("Loaded.");

var x = new Area({bounds: [[-5,5],[-5,5]]});
var square = new Transformation({'expr': (i,t,x,y) => [Math.cos((t+i))+5*Math.sin((t+i)/20),Math.sin(t+i)*Math.cos(2*(t+i))]});
var square2 = new Transformation({'expr': (i,t,x,y) => [(y+5)*Math.cos(x/5+(t+i/302)/4*Math.PI),(y+5)*Math.sin(x/5+(t+i/302)/3*Math.PI)]});
var output = new PointOutput({width:0.2});

x.add(new PointOutput({width: 0.2, color:0xcccccc})); // grid

x.add(square); //transformation -> output
square.add(square2); //transformation -> output
square2.add(output);

three.on("update",function(time){
	x.activate(time.t);
});

//todo: make a new GraphedFunction class that lets you do
// area.then({expr: (i,t,x)=>[x,x*x]}).then({expr: (i,t,x,y)=>[x*Math.cos(y)],[x*Math.sin(y)]}).pointOutput({width:0.2});
// or something like that. I think that might be a bit simpler.
