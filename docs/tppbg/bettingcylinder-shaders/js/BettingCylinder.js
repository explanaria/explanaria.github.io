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

	//add the background gradient
	var geometry = new THREE.SphereGeometry(100,20,20)

	//color the gradient manually
	//right face

	//colors: 0xafcdd0, 0xd6f0ff, 0xe1c1b0, 0x7a8f91


	// A quick note on the for loop below: a normal SphereGeometry's faces look like this:
 	//     |/|/|
	// ... |/|/| ...

	// the face manipulation is to creae this pattern:  |/|\|
	//                                                  |\|/|

	
	for(var rowindex = 20*9; rowindex < 20*29; rowindex += 40){
		for(var i=0;i<40;i+=4){
			var index = rowindex + i;

			//without this if-statement, the pattern would be
			//  |/|\|
			//  |/|\|/|\|
			// so every other row, shift the vertices one to the right to make:
			//  |/|\|     ==  |/|\|
			//|/|\|/|\|       |\|/|
			//Technically this leaves an alternating gap because when index+3 is taken below, it's not modded by 40 along the row, so indices 0 and 1 are never reached because of this +2 shift. However, it's not even showing, so I think it's safe.
			if(rowindex % 80 == 20){
				index = rowindex + (i+2)%40
			}
			//rearrange faces 0,1 mod 4 to form a triangle pattern
			geometry.faces[index].c = geometry.faces[index+1].b
			geometry.faces[index+1].a = geometry.faces[index].a
			
			geometry.faces[index].vertexColors = [new THREE.Color(0x0000ff), new THREE.Color(0xffffff), new THREE.Color(0x0000ff)];
			geometry.faces[index+1].vertexColors = [new THREE.Color(0x0000ff), new THREE.Color(0x0000ff), new THREE.Color(0xffffff)];
			geometry.faces[index+2].vertexColors = [new THREE.Color(0xffffff), new THREE.Color(0x0000ff), new THREE.Color(0x0000ff)];
			geometry.faces[index+3].vertexColors = [new THREE.Color(0x0000ff), new THREE.Color(0xffffff), new THREE.Color(0x0000ff)];
			
		}
	}

	//experiment: shaders to get the triangle pulsating!
	var vShader = [
	"varying vec3 vNormal;",
	"varying vec3 vPosition;",
	"varying vec2 vuv;",
	"varying vec3 vcolor;",
	"uniform float time;",
	"vec3 getcolor(float time){",
		"float lerpfrac = clamp(sin(time),0.0,1.0);",
		"return vec3(0.68,0.80,0.81) * lerpfrac + vec3(0.88,0.75,0.69) * (1.0-lerpfrac);",
	"}",

	"void main() {",
                "vcolor = getcolor(time + color.r);",
		"//vcolor = color;",
		"vPosition = position.xyz;",
		"vNormal = normal.xyz;",
  		"gl_Position = projectionMatrix *",
                "modelViewMatrix *",
                "vec4(position,1.0);",
	"}"].join("\n")

	var fShader = [
	"varying vec3 vNormal;",
	"varying vec3 vPosition;",
	"varying vec2 vuv;",
	"varying vec3 vcolor;",
	"uniform float time;",
	"void main(){",
	"  //gl_FragColor = vec4(clamp(sin(vPosition.x),0.0,1.0), clamp(sin(vPosition.z),0.0,1.0), 1.0, 1.0);", //A
	"  //gl_FragColor = vec4(vNormal.x,vNormal.y, vNormal.z, 1.0);",
	"  gl_FragColor = vec4(vcolor.rgb, 1.0);", 
	"}"].join("\n")

	var uniforms = {
		time: {
			type: 'f',
			value: 0,
		}
	};

	this.colorfulbox =  new THREE.Mesh(
		geometry,
		new THREE.ShaderMaterial({
			side: THREE.BackSide,
			vertexShader: vShader, 
			fragmentShader: fShader,
			vertexColors: THREE.VertexColors,
			uniforms: uniforms,
			})
		);

	this.colorfulbox.uniforms = uniforms;
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

	*/


}
BettingCylinder.prototype.update = function(delta){
	var delta = this.clock.getDelta();

	//update any in-progress hex animations
	this.animtimer += delta;
	var allcomplete = true;

	//update BG
	this.colorfulbox.uniforms.time.value = this.animtimer;

	//if any circles are dead

		//create a new circle with a random user's image

	this.renderer.render( this.scene, this.camera);
}
