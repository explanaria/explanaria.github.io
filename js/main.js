var three = new Threeasy_Setup(true, 60,15);

console.log("Loaded.");

var x = new Area({bounds: [[-5,5],[-5,5]]});
var id = new Transformation({'expr': (i,t,x,y) => [x,y,x*x+4*y*y*y]});
var output = new PointOutput({width:0.2});

x.add(new PointOutput({width: 0.2, color:0xcccccc})); // grid

x.add(id); //transformation -> output
id.add(output);

three.on("update",function(time){
	x.activate(time.t);
});

