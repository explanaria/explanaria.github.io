var three = new Threeasy_Setup(true, 60,15);
var controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);

console.log("Loaded.");

var area = new Area({bounds: [[-5,5],[-5,5]]});
var id = new Transformation({'expr': (i,t,x,y) => [x,y,0]});
var output = new PointOutput({width:0.2});

area.add(new PointOutput({width: 0.2, color:0xcccccc})); // grid

area.add(id); //transformation -> output
id.add(output);

three.on("update",function(time){
	area.activate(time.t);
	controls.update();
});

async function animate(){

	await delay(1000);
	TransitionTo(id, {'expr': (i,t,x,y) => [x,y+Math.sin(t),x*x+y*y*y]});

	//var anim = new Animation(output, {'color': 0xffffff}); // works (albeit not on THREE.Color()s)

	await delay(4000);
	TransitionTo(id, {'expr': (i,t,x,y) => [x,Math.sin(x+t),0]})

	await delay(4000);
	TransitionTo(id, {'expr': (i,t,x,y) => [x,Math.sin(x+t),Math.cos(x+t)]})

}
animate();
