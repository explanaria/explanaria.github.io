"use strict";

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

	//an aspect ratio of 3.5 or above will show things that shouldn't be shown
	this.camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1,200);

	//these two values were chosen by hand to give the turned effect
	//this.camera.position.set(-1.216,1.46,-2.69); 
	//this.camera.rotation.set(-0.2,-1.7781575891219626, -0.2403978208986089)
	this.camera.position.set(-1.216592150694993,1.5282160696265034,-2.63726972605486)
	this.camera.rotation.set(0.010216663322211847,-0.700083444068137,-0.41575476313921605)

	this.scene.add(this.camera);

	//add some light
	this.light =  new THREE.DirectionalLight( 0xffffff, this.startingLightIntensity) 
	this.light.position.set(0,0,3);
	this.scene.add( this.light );

	//add the background gradient
	var geometry = new THREE.CubeGeometry(100,100,100)

	//right face
	
	geometry.faces[1].vertexColors = [new THREE.Color(0xafcdd0), new THREE.Color(0xd6f0ff), new THREE.Color(0xe1c1b0)]

	//top left face
	geometry.faces[10].vertexColors = [new THREE.Color(0xe1c1b0), new THREE.Color(0xd6f0ff), new THREE.Color(0x7a8f91)]

	//bottom triangle face
	geometry.faces[11].vertexColors = [new THREE.Color(0xd6f0ff), new THREE.Color(0xd6f0ff), new THREE.Color(0x7a8f91)]

	this.colorfulbox =  new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({shading: THREE.FlatShading, side: THREE.BackSide, vertexColors: THREE.VertexColors}));
	this.scene.add( this.colorfulbox );

                                                                               
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

	var radius = 0.25;
	var spacing = 0.1;

	for(var i=0;i<Math.PI*2; i += 0.15){

		for(var z = -2; z < 6; z++){
			//generate random url for testing
			var randIndex = parseInt(Math.random()*3);
			var url = [this.asset_folder+"red.png",this.asset_folder+"gray.png",this.asset_folder+"blue.png"][randIndex];

			//push new circle
			this.circles.push(new BettingCircle(url,this.scene, z * (radius*2 + spacing), i));

		}
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

	this.radius = 5;

	var loader = new THREE.TextureLoader();
	loader.load(image_url,function(tex){
		this.mesh = new THREE.Mesh(this.geometry, new THREE.MeshPhongMaterial({color:0xffffff,map: tex}));
		scene.add(this.mesh);
		this.update(0);
		this.imageLoaded = true;

	}.bind(this));
}

BettingCircle.prototype.geometry = new THREE.CircleGeometry(0.25,30);

BettingCircle.prototype.update = function(delta){
	if(this.imageLoaded){
		this.mesh.position.set(this.radius*Math.cos(this.t - Math.PI/2),this.z,this.radius*Math.sin(this.t - Math.PI/2));
		this.mesh.rotation.set(0,-this.t,0);
		this.t += delta * Math.PI/ this.fullRotationTime;
	}
}
