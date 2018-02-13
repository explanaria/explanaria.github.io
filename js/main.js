var three = new Threeasy_Setup(true, 60,15);

console.log("Loaded.");

var area = new Area({bounds: [[-5,5],[-5,5]]});
var id = new Transformation({'expr': (i,t,x,y) => [x,y,0]});
var output = new PointOutput({width:0.2});

area.add(new PointOutput({width: 0.2, color:0xcccccc})); // grid

area.add(id); //transformation -> output
id.add(output);

three.on("update",function(time){
	area.activate(time.t);
});

var anim = new Animation(id, {'expr': (i,t,x,y) => [x,y+Math.sin(t),x*x+4*y*y*y]});


//var anim = new Animation(output, {'color': 0xffffff}); // works (albeit not on THREE.Color()s)

window.setTimeout(function(){

	var anim = new Animation(id, {'expr': (i,t,x,y) => [x,Math.sin(x),0]})

},2000);

window.setTimeout(function(){

	var anim = new Animation(id, {'expr': (i,t,x,y) => [x,Math.sin(x+t),Math.cos(x+t)]})

},4000);
