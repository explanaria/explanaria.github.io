function Threeasy_Setup(autostart = true){
	this.prev_timestep = 0;
	this.autostart = autostart;

	this.camera = new THREE.OrthographicCamera({
		near: .1,
		far: 10000,

		//type: 'perspective',
		fov: 60,
		aspect: 1,
/*
		// type: 'orthographic',
		left: -1,
		right: 1,
		bottom: -1,
		top: 1,*/
	  });

	this.camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 10000000 );
	//this.camera = new THREE.OrthographicCamera( 70, window.innerWidth / window.innerHeight, 0.1, 10 );

	this.camera.position.set(0, 0, 10);
	this.camera.lookAt(new THREE.Vector3(0,0,0));


	this.renderer = new THREE.WebGLRenderer( { antialias: true } );
	this.renderer.setPixelRatio( window.devicePixelRatio );
	this.renderer.setSize( window.innerWidth, window.innerHeight );
	this.renderer.gammaInput = true;
	this.renderer.gammaOutput = true;
	this.renderer.shadowMap.enabled = true;
	this.renderer.vr.enabled = true;
	//create camera, scene, timer, renderer objects
	//craete render object


	
	this.scene = new THREE.Scene();
	this.scene.background = new THREE.Color( 0xFFFFFF );

	this.scene.add(this.camera);

	this.renderer = new THREE.WebGLRenderer( { antialias: true } );
	this.renderer.setPixelRatio( window.devicePixelRatio );
	this.renderer.setSize( window.innerWidth, window.innerHeight );
	this.renderer.setClearColor(new THREE.Color(0xFFFFFF), 1.0);

	this.container = document.createElement( 'div' );
	this.container.appendChild( this.renderer.domElement );

	this.renderer.domElement.addEventListener( 'mousedown', this.onMouseDown.bind(this), false );
	this.renderer.domElement.addEventListener( 'mouseup', this.onMouseUp.bind(this), false );
	this.renderer.domElement.addEventListener( 'touchstart', this.onMouseDown.bind(this), false );
	this.renderer.domElement.addEventListener( 'touchend', this.onMouseUp.bind(this), false );

	window.addEventListener( 'resize', this.onWindowResize.bind(this), false );

	/*
	//renderer.vr.enabled = true; 
	window.addEventListener( 'vrdisplaypointerrestricted', onPointerRestricted, false );
	window.addEventListener( 'vrdisplaypointerunrestricted', onPointerUnrestricted, false );
	document.body.appendChild( WEBVR.createButton( renderer ) );
	*/

	window.addEventListener('load', this.onPageLoad.bind(this), false);

	this.clock = new THREE.Clock();
}

Threeasy_Setup.prototype.onPageLoad = function() {
	console.log("Threeasy_Setup loaded!");
	document.body.appendChild( this.container );

	if(this.autostart){
		this.start();
	}
}
Threeasy_Setup.prototype.start = function(){
	this.prev_timestep = performance.now();
	this.clock.start();
	this.render(this.prev_timestep);
}

Threeasy_Setup.prototype.onMouseDown = function() {
	this.isMouseDown = true;
}
Threeasy_Setup.prototype.onMouseUp= function() {
	this.isMouseDown = false;
}
Threeasy_Setup.prototype.onPointerRestricted= function() {
	var pointerLockElement = renderer.domElement;
	if ( pointerLockElement && typeof(pointerLockElement.requestPointerLock) === 'function' ) {
		pointerLockElement.requestPointerLock();
	}
}
Threeasy_Setup.prototype.onPointerUnrestricted= function() {
	var currentPointerLockElement = document.pointerLockElement;
	var expectedPointerLockElement = renderer.domElement;
	if ( currentPointerLockElement && currentPointerLockElement === expectedPointerLockElement && typeof(document.exitPointerLock) === 'function' ) {
		document.exitPointerLock();
	}
}
Threeasy_Setup.prototype.onWindowResize= function() {
	this.camera.aspect = window.innerWidth / window.innerHeight;
	this.camera.updateProjectionMatrix();
	this.renderer.setSize( window.innerWidth, window.innerHeight );
}
Threeasy_Setup.prototype.listeners = {"update": [],"render":[]}; //update event listeners
Threeasy_Setup.prototype.render = function(timestep){
	var delta = this.clock.getDelta();
	//get timestep
	for(var i=0;i<this.listeners["update"].length;i++){
		this.listeners["update"][i]({"t":this.clock.elapsedTime,"delta":delta});
	}

	this.renderer.render( this.scene, this.camera );

	for(var i=0;i<this.listeners["render"].length;i++){
		this.listeners["render"][i]();
	}

	this.prev_timestep = timestep;
	window.requestAnimationFrame(this.render.bind(this));
}
Threeasy_Setup.prototype.on = function(event_name, func){
	//Registers an event listener.
	//each listener will be called with an object consisting of:
	//	{t: <current time in s>, "delta": <delta, in ms>}
	// an update event fires before a render. a render event fires post-render.
	if(event_name == "update"){ 
		this.listeners["update"].push(func);
	}else if(event_name == "render"){ 
		this.listeners["render"].push(func);
	}else{
		console.error("Invalid event name!")
	}
}
Threeasy_Setup.prototype.removeEventListener = function(event_name, func){
	//Unregisters an event listener, undoing an Threeasy_setup.on() event listener.
	//the naming scheme might not be the best here.
	if(event_name == "update"){ 
		let index = this.listeners["update"].indexOf(func);
		this.listeners["update"].splice(index,1);
	} else if(event_name == "render"){ 
		let index = this.listeners["render"].indexOf(func);
		this.listeners["render"].splice(index,1);
	}else{
		console.error("Nonexistent event name!")
	}
}

class Threeasy_Recorder extends Threeasy_Setup{
	//based on http://www.tysoncadenhead.com/blog/exporting-canvas-animation-to-mov/ to record an animation
	//when done,     ffmpeg -r 60 -framerate 60 -i ./frame-%d.png -vcodec libx264 -pix_fmt yuv420p -crf:v 0 video.mp4
	//then, add the yuv420p pixels (which for some reason isn't done by the prev command) by:
	// ffmpeg -i video.mp4 -vcodec libx264 -pix_fmt yuv420p -strict -2 -acodec aac output.mp4
	//check with ffmpeg -i output.mp4

	constructor(autostart, fps=30, length = 5){
		/* fps is evident, autostart is a boolean (by default, true), and length is in s.*/
		super(autostart);
		this.fps = fps;
		this.elapsedTime = 0;
		this.frameCount = fps * length;
		this.frames_rendered = 0;

		this.socket = io.connect('http://localhost:3000');
	}
	start(){
		//make a recording sign
		this.recording_icon = document.createElement("div");
		this.recording_icon.style.width="20px"
		this.recording_icon.style.height="20px"
		this.recording_icon.style.position = 'absolute';
		this.recording_icon.style.top = '20px';
		this.recording_icon.style.left = '20px';
		this.recording_icon.style.borderRadius = '10px';
		this.recording_icon.style.backgroundColor = 'red';
		document.body.appendChild(this.recording_icon);


		this.render();
	}
	render(timestep){
		var delta = 1/this.fps;
		//get timestep
		for(var i=0;i<this.listeners["update"].length;i++){
			this.listeners["update"][i]({"t":this.elapsedTime,"delta":delta});
		}

		this.renderer.render( this.scene, this.camera );

		for(var i=0;i<this.listeners["render"].length;i++){
			this.listeners["render"][i]();
		}

		this.record_frame();

		this.elapsedTime += delta;
		window.requestAnimationFrame(this.render.bind(this));
	}
	record_frame(){
		let current_frame = document.querySelector('canvas').toDataURL();
        this.socket.emit('render-frame', {
        	frame: this.frames_rendered++,
        	file: current_frame
        });
		if(this.frames_rendered>this.frameCount){
			this.render = null; //hacky way of stopping the rendering
			this.recording_icon.style.display = "none";
			alert("All done!\nFiles outputted to output_images if this was run via node."); //blocks last frame
		}
	}
}