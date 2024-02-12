"use strict";

function BettingCylinder(canvas_elem, show_user_names, clear_color, asset_folder){
	//Class to control the result hexagon-tile animation
	//canvas_elem: a <canvas> element to draw the animation to
	//asset_folder: the folder where red.png, blue.png, gray.png, hex.obj, and hex.mtl are stored. Must end with "/"! By default: "static/bettingcylinderanim/"

	this.circles = [];

	this.asset_folder = asset_folder || "static/bettingcylinderanim/"

	this.show_user_names = show_user_names;
	if(this.show_user_names === undefined)this.show_user_names = false;

	this.fullCircleRotationTime = 20;

	//Clock to get deltas for each frame
	this.clock = new THREE.Clock();
	this.animtimer = 0;

	//threejs constructs
	this.scene = new THREE.Scene();

	//an aspect ratio of 3.5 or above will show things that shouldn't be shown
	this.camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1,200);

	//these two values were chosen by hand to give the turned effect
	//this.camera.position.set(-1.216,1.46,-2.69); 
	//this.camera.rotation.set(-0.2,-1.7781575891219626, -0.2403978208986089)
	this.camera.position.set(-1.216592150694993,1.5282160696265034,-2.63726972605486)
	this.camera.rotation.set(0.010216663322211847,-0.700083444068137,-0.41575476313921605)

	this.scene.add(this.camera);

	//add some light
	this.scene.add( new THREE.AmbientLight( 0x555555) );

	this.light =  new THREE.DirectionalLight( 0xffffff, 0.6) 
	this.light.position.set(0,0,2);
	this.light.target.position.set(-3,0,5);
	this.scene.add( this.light );

	//object to which all the circles are parented
	this.circleparent = new THREE.Object3D();
	this.scene.add(this.circleparent);

	//Add a colorful gradient
	this.gradient = new THREE.Mesh(new THREE.PlaneGeometry(2,2,2,2), new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: THREE.VertexColors, opacity: 1.0, transparent: true, blending: THREE.MultiplyBlending}));
	this.gradient2 = new THREE.Mesh(new THREE.PlaneGeometry(2,2,1,1), new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: THREE.VertexColors, opacity: 0.4, transparent: true, blending: THREE.AdditiveBlending}));

	var bottomLeftColor = 0xaaaaff;
	var topLeftColor = 0xffffaa;
	var topRightColor = 0xffffff;
	var bottomRightColor = 0xffaaaa;
	var bottomMiddleColor = 0xffcccc;
	var defaultCol = 0xaaaaaa;
	var topMiddleColor = 0x909055;

	this.gradient.geometry.faces[0].vertexColors = [new THREE.Color(topLeftColor), new THREE.Color(defaultCol), new THREE.Color(topMiddleColor)];
	this.gradient.geometry.faces[1].vertexColors = [new THREE.Color(defaultCol), new THREE.Color(defaultCol), new THREE.Color(topMiddleColor)];
	this.gradient.geometry.faces[2].vertexColors = [new THREE.Color(topMiddleColor), new THREE.Color(defaultCol), new THREE.Color(topRightColor)];
	this.gradient.geometry.faces[3].vertexColors = [new THREE.Color(defaultCol), new THREE.Color(bottomMiddleColor), new THREE.Color(topRightColor)];
	this.gradient.geometry.faces[4].vertexColors = [new THREE.Color(defaultCol), new THREE.Color(bottomLeftColor), new THREE.Color(defaultCol)];
	this.gradient.geometry.faces[5].vertexColors = [new THREE.Color(bottomLeftColor), new THREE.Color(defaultCol), new THREE.Color(defaultCol)];
	this.gradient.geometry.faces[6].vertexColors = [new THREE.Color(defaultCol), new THREE.Color(defaultCol), new THREE.Color(bottomMiddleColor)];
	this.gradient.geometry.faces[7].vertexColors = [new THREE.Color(defaultCol), new THREE.Color(bottomRightColor), new THREE.Color(bottomMiddleColor)];
	this.gradient.position.z = -1.1;

	this.gradient2.geometry.faces[0].vertexColors = [new THREE.Color(0x000000), new THREE.Color(0x000000), new THREE.Color(0xffffff)];
	this.gradient2.geometry.faces[1].vertexColors = [new THREE.Color(0x000000), new THREE.Color(0x000000), new THREE.Color(0xffffff)];
	this.gradient2.position.z = -1.05;

	//have the gradients appear directly in front of the camera
	this.camera.add(this.gradient);
	this.camera.add(this.gradient2);

	//experiment: shaders to get the triangle pulsating!
	//Vertex colors are set up in the following way:
	//All triangle centers have a red of 1.0
	//All non-triangle centers have colors of 0x000000
	//Every up-facing triangle has a blue of 1.0, while down-facing ones have a color of 0.0
	//Combined, these attributes are used to generate the scrolling effect by moving either backwards or forwards through getcolor() depending on the blue channel, the exact amount being determined by the red to get a nice triangular fade.
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
	//Function to create the color ramp
	//The vectors returned are in rgb; changing this function would change the color bands
	"vec3 getcolor(float time){",
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
		
		//return a default color to satisfy chrome
		"return vec3(0.71, 0.60, 0.58);",

	"}",

	//helper function whose graph is supposed to look like:
	//    _/
	//   /
	//Used to help smooth out the transition between outward and inward triangles
	//I have no idea why a negative value gets the effect I want; I suspect the function is wrong but it works out in the end so I guess it stays
	"float rampwaitramp(float x, float waitsize){",
		"return step(0.0,x-waitsize)*(x-waitsize) + step(0.0,-x-waitsize)*(x+waitsize);",
	"}",

	"void main(){",
	"    float isOutwardstri = (vcolor.b*2.0-1.0);", //1.0 if the triangle is going outwards, lerps to -1.0 if not, 0.0 at edges
	"    gl_FragColor = vec4(getcolor(rampwaitramp(vcolor.r * isOutwardstri * 2.0,-0.1) + time/2.0),1.0);",
	"}"].join("\n")

	var uniforms = {
		time: {
			type: 'f',
			value: 0,
		}
	};

	//load the mesh and its vertex colors
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

	window.addEventListener( 'resize', function(){
		this.renderer.setSize( window.innerWidth, window.innerHeight );

		this.camera.aspect = (window.innerWidth / window.innerHeight);

		this.renderer.domElement.width = window.innerWidth;
		this.renderer.domElement.height = window.innerHeight;

	}.bind(this), false );

	//queue async texture loads

	/*
	this.textures = {};
	new THREE.OBJLoader().load(this.asset_folder+"beveledhex.obj",function(mesh){
		this.hex_geometry = mesh.children[0].geometry;
	}.bind(this));

	*/

	this.texturecache = new TextureCache();
	this.loadedTextures = [];

	this.defaultTextureURLs = [[this.asset_folder+"red.png",""],[this.asset_folder+"gray.png",""],[this.asset_folder+"blue.png",""]];
	this.defaultTextures = [];

	//load the default textures
	//we're about to call this.texturecache.loadTexture on the same textures below; this is okay because TextureCache should ensure only one request is made per texture (and I'm lazy)
	for(let i=0;i<this.defaultTextureURLs.length;i++){
		let url_user_pair = this.defaultTextureURLs[i];
		this.texturecache.loadTexture(url_user_pair[0],function(tex){
			if(tex.instanceCount === undefined)tex.instanceCount = 0;
			tex.instanceCount++;
			this.defaultTextures.push([tex,url_user_pair[1]]);
		}.bind(this));
	}
	

	var radius = 0.25;
	var spacing = 0.1;

	for(let i=0;i<Math.PI*2; i += 0.15){

		for(let z = -2; z < 6; z++){
			//to start, load the default textures
			let randIndex = parseInt(Math.random()*this.defaultTextureURLs.length);
			let url = this.defaultTextureURLs[randIndex][0];
			
			this.texturecache.loadTexture(url,function(tex){
				if(tex.instanceCount === undefined)tex.instanceCount = 0;
				tex.instanceCount++;
				//push new circle
				this.circles.push(new BettingCircle(tex,this.circleparent, z * (radius*2 + spacing), i));
			}.bind(this));

		}
	}

}
BettingCylinder.prototype.setNewImgList = function(img_user_list, includeDefaults){
	//Function to set the textures to be used given an array containing the URLs
	//imglist: an array of [[image URL, username to display]...]
	//After being loaded, new circles about to appear onscreen will be given a random texture from the URLs provided.
	if(includeDefaults === undefined)includeDefaults = true;

	this.loadedTextures = [];
	if(includeDefaults)img_user_list = img_user_list.concat(this.defaultTextureURLs);

	this.texturecache.clearCache();	

	//Load everything
	for(var i=0;i<img_user_list.length;i++){
		let user = img_user_list[i][1];
		let color = img_user_list[i][2]; //may be undefined
		this.texturecache.loadTexture(img_user_list[i][0],function(tex){
			if(tex.instanceCount === undefined)tex.instanceCount = 0;

			//loadedTextures is an array of [tex, username_to_display], one for each texture
			this.loadedTextures.push([tex, user, color]);
		}.bind(this));
	}
}

BettingCylinder.prototype.update = function(delta){
	var delta = this.clock.getDelta();

	//update any in-progress hex animations
	this.animtimer += delta;
	var allcomplete = true;
	for(var i=0;i<this.circles.length;i++){
		//advance circle animation
		this.circles[i].update(delta);
		
		//After a circle goes offscreen, mark it as requiring a new texture
		//The < 3.0 check is required so that this if-statement and the next one don't continually cancel each other out
		if( !this.circles[i].isDead && (this.circles[i].t % (Math.PI*2)) > 1.5 && (this.circles[i].t % (Math.PI*2)) < 3.0){
			this.circles[i].isDead = true;
		}
		if(this.circles[i].isDead && (this.circles[i].t % (Math.PI*2)) > 5.9 ){
			//circle is about to come onscreen, choose a new image
			if(this.loadedTextures.length > 0){
				
				let tex_user_pair = this.loadedTextures[Math.floor(Math.random()*this.loadedTextures.length)];


				//First, reduce instance count of previous texture, and if 0, dispose
				//If the same texture is on more than one circle in a vertical band, instanceCount can go negative. If so, don't dispose again.
				if(this.circles[i].circlemesh.material.map instanceof THREE.Texture){
					this.circles[i].circlemesh.material.map.instanceCount--;

					if(this.circles[i].circlemesh.material.map.instanceCount == 0){
						this.circles[i].circlemesh.material.map.dispose();
					}
				}

				//then, apply new texture, raising its instanceCount by 1
				this.circles[i].circlemesh.material.map = tex_user_pair[0];
				this.circles[i].circlemesh.material.map.instanceCount++;

				//If we're showing usernames, generate a new name texture and show it below the image
				if(this.show_user_names){
					if(tex_user_pair[1] != ""){
						//Generate a texture and show the nameplate

						var color = tex_user_pair[2]; //may be undefined
						this.circles[i].setNameTex(this.generateNameTex(tex_user_pair[1], color));
					}else{
						//An empty string = hide the nameplate
						this.circles[i].hideName();
					}
				}
			}else{
				//if no textures are loaded for some reason (weird concurrency issue? setNewImgList not called?) grab one from the default textures
				//Don't show names for default textures
				var tex_user_pair = this.defaultTextures[Math.floor(Math.random()*this.defaultTextures.length)];
				this.circles[i].circlemesh.material.map = tex_user_pair[0];
			}
			this.circles[i].isDead = false;
		}
	}

	//update BG
	if(this.colorfulbox){
		this.colorfulbox.uniforms.time.value = this.animtimer;
		this.colorfulbox.rotation.z += delta/20;
	}

	this.circleparent.rotation.y -= delta * Math.PI/ this.fullCircleRotationTime;

	this.renderer.render( this.scene, this.camera);
}


//Class that controls the circles themselves, along with the nameplates
function BettingCircle(initialtex, parentElement, z, initialRotation){
	this.t = initialRotation || 0; //from 0 to ???
				//0 should be about to be shown to the camera,
				///and ??? should be offscreen, fully scrolled
	this.z = z;

	this.isDead = true;
	this.fullCircleRotationTime = 20; //amount of time in s to make a full 360 degree rotation

	this.radius = 5;

	//create the circle mesh
	this.circlemesh = new THREE.Mesh(this.circlegeometry, new THREE.MeshPhongMaterial({color:0xffffff,map: initialtex}));

	this.circlemesh.position.set(this.radius*Math.cos(initialRotation - Math.PI/2),this.z,this.radius*Math.sin(initialRotation - Math.PI/2));
	this.circlemesh.rotation.set(0,-initialRotation,0);
	parentElement.add(this.circlemesh);

	//create the unused name mesh
	this.namemesh = new THREE.Mesh(this.namegeometry, new THREE.MeshBasicMaterial({color:0xffffff,transparent: true}));
	this.namemesh.visible = false; //Don't show the namemesh until a texture map has been set

	//set the name to follow the circle a bit closer to the center, but farther down
	this.namemesh.position.set((this.radius - 0.01)*Math.cos(initialRotation - Math.PI/2),this.z - 0.25,(this.radius - 0.01)*Math.sin(initialRotation - Math.PI/2));
	this.namemesh.rotation.copy(this.circlemesh.rotation);

	parentElement.add(this.namemesh);
}

BettingCircle.prototype.circlegeometry = new THREE.CircleGeometry(0.25,30);
BettingCircle.prototype.namegeometry = new THREE.PlaneGeometry(0.5,0.8);

BettingCircle.prototype.setNameTex = function(tex){
	//Set the texture for this circle's username nameplate

	//First, free texture memory of previous texture
	if(this.namemesh.material.map instanceof THREE.Texture){
		this.namemesh.material.map.dispose();
	}

	//Set new texture
	this.namemesh.material.map = tex;
	//this.namemesh.material.needsUpdate = true;
	this.namemesh.visible = true;
}
BettingCircle.prototype.hideName = function(){
	this.namemesh.visible = false;
}

BettingCircle.prototype.update = function(delta){

	this.t += delta * Math.PI/ this.fullCircleRotationTime;
}
