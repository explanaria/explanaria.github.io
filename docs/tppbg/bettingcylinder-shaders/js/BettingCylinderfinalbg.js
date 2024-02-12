"use strict";

function BettingCylinder(canvas_elem, clear_color, asset_folder){
	//Class to control the result hexagon-tile animation
	//canvas_elem: a <canvas> element to draw the animation to
	//asset_folder: the folder where red.png, blue.png, gray.png, hex.obj, and hex.mtl are stored. Must end with "/"! By default: "static/bettingcylinderanim/"

	this.circles = [];

	this.asset_folder = asset_folder || "static/bettingcylinderanim/"

	//Clock to get deltas for each frame
	this.clock = new THREE.Clock();
	this.animtimer = 0;

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

	//experiment: shaders to get the triangle pulsating!
	//Vertex colors are set up in the following way:
	//All triangle centers have a green of 1.0
	//All non-triangle centers have colors of 0x000000
	//Every up-facing triangle has a blue of 1.0, while down-facing ones have a color of 0.0
	var vShader = [
	"varying vec3 vNormal;",
	"varying vec3 vPosition;",
	"varying vec3 vcolor;",
	"uniform float time;",
	"void main() {",
		"vcolor = color;",
		"vPosition = position.xyz;",
		"vNormal = normal.xyz;",
  		"gl_Position = projectionMatrix *",
                "    modelViewMatrix *",
                "    vec4(position,1.0);",
	"}"].join("\n")

	var fShader = [
	"varying vec3 vNormal;",
	"varying vec3 vPosition;",
	"varying vec3 vcolor;",
	"uniform float time;",
	"vec3 getcolor(float time){",
		"float lerpfrac = clamp(sin(time),0.0,1.0);",
		"lerpfrac = mod(floor(time + 0.5),2.0);",
		"float colorindex = mod(floor(time + 0.5),6.0);",
		"if(colorindex < 1.0){",
			"return vec3(0.65, 0.70, 0.71);",
		"}else if(colorindex < 2.0){",
			"return vec3(0.56, 0.59, 0.64);",
		"}else if(colorindex < 3.0){",
			"return vec3(0.59, 0.55, 0.64);",
		"}else if(colorindex < 4.0){",
			"return vec3(0.51, 0.63, 0.64);",
		"}else if(colorindex < 5.0){",
			"return vec3(0.52, 0.61, 0.60);", //may in fact be just a transition of surrounding two and not an actual color
		"}else if(colorindex < 6.0){",
			"return vec3(0.65, 0.71, 0.65);",
		"}else if(colorindex < 6.0){",
			"return vec3(0.67, 0.71, 0.61);",
		"}else if(colorindex < 6.0){",
			"return vec3(0.71, 0.60, 0.58);",
		"}",

	"}",

	//helper function whose graph looks like:
	//    _/
	//   /
	"float rampwaitramp(float x, float waitsize){",
		"return step(0.0,x-waitsize)*(x-waitsize) + step(0.0,-x-waitsize)*(x+waitsize);",
	"}",

	"void main(){",
	//"  gl_FragColor = vec4(vcolor.rgb, 1.0);", //pure vertex colors

	"    float isOutwardstri = (vcolor.b*2.0-1.0);", //1.0 if the triangle is going outwards, lerps to -1.0 if not, 0.0 at edges
	"    float boolisOutwardstri = sign(clamp(vcolor.b,0.0,1.0));", //guaranteed to be only 1.0 or 0.0
	"    gl_FragColor = vec4(getcolor(rampwaitramp(vcolor.r * isOutwardstri * 2.0,-0.1) + time/2.0),1.0);",
	"}"].join("\n")

	var uniforms = {
		time: {
			type: 'f',
			value: 0,
		}
	};

	new THREE.ColladaLoader().load(this.asset_folder+"bgtriangles.dae",function(mesh){
		this.colorfulbox = mesh.scene.children[0];
		this.colorfulbox.material = new THREE.ShaderMaterial({
				side: THREE.BackSide,
				vertexShader: vShader, 
				fragmentShader: fShader,
				vertexColors: THREE.VertexColors,
				uniforms: uniforms,
		})
		this.colorfulbox.uniforms = uniforms;
		this.scene.add( this.colorfulbox );
	}.bind(this));


                                         
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

	*/
}
BettingCylinder.prototype.update = function(delta){
	var delta = this.clock.getDelta();

	//update any in-progress hex animations
	this.animtimer += delta;
	var allcomplete = true;

	//update BG
	if(this.colorfulbox){
		this.colorfulbox.uniforms.time.value = this.animtimer;
		this.colorfulbox.rotation.z += delta/20;
	}

	//if any circles are dead

		//create a new circle with a random user's image

	this.renderer.render( this.scene, this.camera);
}

