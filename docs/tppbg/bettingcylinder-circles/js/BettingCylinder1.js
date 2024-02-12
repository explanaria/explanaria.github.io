function BettingCylinder(canvas_elem, clear_color, asset_folder){
	//Class to control the result hexagon-tile animation
	//canvas_elem: a <canvas> element to draw the animation to
	//asset_folder: the folder where red.png, blue.png, gray.png, hex.obj, and hex.mtl are stored. Must end with "/"! By default: "static/bettingcylinderanim/"

	this.circles = [];


	this.asset_folder = asset_folder || "static/bettingcylinderanim/"

	//Clock to get deltas for each frame
	this.clock = new THREE.Clock();

	//threejs constructs
	this.scene = new THREE.Scene();
	this.scene.add( new THREE.AmbientLight( 0xaaaaaa) );

	this.camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1,200);
	this.camera.position.set(0,0,0.);
	//this.camera.rotation.set(0,-Math.PI/2,0);
	this.scene.add(this.camera);

	//add some light
	this.light =  new THREE.DirectionalLight( 0xffffff, this.startingLightIntensity) 
	this.light.position.set(0,0,3);
	this.scene.add( this.light );
                                                                               
	// Renderer
	var clear_color = clear_color || 0x000000;

	this.renderer = new THREE.WebGLRenderer({ antialias : true, canvas: canvas_elem, alpha: true});
	this.renderer.setSize( window.innerWidth, window.innerHeight);
	this.renderer.setClearColor( clear_color, 0);

	//queue async texture loads

	/*
	this.textures = {};
	new THREE.OBJLoader().load(this.asset_folder+"beveledhex.obj",function(mesh){
		this.hex_geometry = mesh.children[0].geometry;
	}.bind(this));



	loader.load(this.asset_folder+"red.png",function(tex){
		this.textures[this.asset_folder+"red.png"] = tex;
	}.bind(this));
	loader.load(this.asset_folder+"blue.png",function(tex){
		this.textures[this.asset_folder+"blue.png"] = tex;
	}.bind(this));

	*/

	for(var i=0;i<2*Math.PI; i += 0.25){

		this.circles.push(new BettingCircle(this.asset_folder+"gray.png",this.scene,0, i));
		this.circles.push(new BettingCircle(this.asset_folder+"red.png",this.scene,0.5, i));
		this.circles.push(new BettingCircle(this.asset_folder+"blue.png",this.scene,1, i));

	}

}
BettingCylinder.prototype.update = function(delta){
	var delta = this.clock.getDelta();

	//update any in-progress hex animations
	this.animtimer += delta;
	var allcomplete = true;
	for(var i=0;i<this.circles.length;i++){
		this.circles[i].update(delta);
		//update circles
	}

	//if any circles are dead

		//create a new circle with a random user's image

	this.renderer.render( this.scene, this.camera);
}






function BettingCircle(image_url, scene, z, initialRotation){
	this.t = initialRotation || 0; //from 0 to ???
				//0 should be about to be shown to the camera,
				///and ??? should be offscreen, fully scrolled
	this.z = z;

	this.isDead = false;
	this.imageLoaded = false; //todo: make image loading the responsibility of something else
	this.fullRotationTime = 20; //amount of time in s to make a full 360 degree rotation

	console.log(this.t);

	this.radius = 3//5;

	var loader = new THREE.TextureLoader();
	loader.load(image_url,function(tex){
		console.log(this);


		this.mesh = new THREE.Mesh(this.geometry, new THREE.MeshPhongMaterial({color:0xffffff,map: tex}));
		scene.add(this.mesh);
		this.imageLoaded = true;
		console.log("Loaded!");
		console.log(this);

	}.bind(this));
}

BettingCircle.prototype.geometry = new THREE.CircleGeometry(0.25,30);

BettingCircle.prototype.update = function(delta){
	if(this.imageLoaded){
		this.mesh.position.set(this.radius*Math.cos(this.t),this.z,this.radius*Math.sin(this.t));
		this.mesh.rotation.set(0,-Math.PI/2-this.t,0);
		//this.t += delta*Math.PI/this.fullRotationTime;
		//this.t += delta;
	}
}
