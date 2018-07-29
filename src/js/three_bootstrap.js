//This library is designed to help start three.js easily, creating the render loop and canvas automagically.
//Really it should be spun off into its own thing instead of being part of explanaria.

//also, change Threeasy_Environment to Threeasy_Recorder to download high-quality frames of an animation

import CCapture from 'ccapture.js';
import { Detector } from '../lib/WebGL_Detector.js';

function ThreeasyEnvironment(autostart = true){
	this.prev_timestep = 0;
	this.autostart = autostart;

	if(!Detector.webgl)Detector.addGetWebGLMessage();

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

	this.scene.add(this.camera);

	this.renderer = new THREE.WebGLRenderer( { antialias: true } );
	this.renderer.setPixelRatio( window.devicePixelRatio );
	this.renderer.setSize( this.evenify(window.innerWidth),this.evenify(window.innerHeight) );
	this.renderer.setClearColor(new THREE.Color(0xFFFFFF), 1.0);

	this.aspect = window.innerWidth/window.innerHeight;

	this.timeScale = 1;
	this.elapsedTime = 0;

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

	this.IS_RECORDING = false; // queryable if one wants to do things like beef up particle counts for render
}

ThreeasyEnvironment.prototype.onPageLoad = function() {
	console.log("Threeasy_Setup loaded!");
	document.body.appendChild( this.container );

	if(this.autostart){
		this.start();
	}
}
ThreeasyEnvironment.prototype.start = function(){
	this.prev_timestep = performance.now();
	this.clock.start();
	this.render(this.prev_timestep);
}

ThreeasyEnvironment.prototype.onMouseDown = function() {
	this.isMouseDown = true;
}
ThreeasyEnvironment.prototype.onMouseUp= function() {
	this.isMouseDown = false;
}
ThreeasyEnvironment.prototype.onPointerRestricted= function() {
	var pointerLockElement = renderer.domElement;
	if ( pointerLockElement && typeof(pointerLockElement.requestPointerLock) === 'function' ) {
		pointerLockElement.requestPointerLock();
	}
}
ThreeasyEnvironment.prototype.onPointerUnrestricted= function() {
	var currentPointerLockElement = document.pointerLockElement;
	var expectedPointerLockElement = renderer.domElement;
	if ( currentPointerLockElement && currentPointerLockElement === expectedPointerLockElement && typeof(document.exitPointerLock) === 'function' ) {
		document.exitPointerLock();
	}
}
ThreeasyEnvironment.prototype.evenify = function(x){
	if(x % 2 == 1){
		return x+1
	};
	return x;
}
ThreeasyEnvironment.prototype.onWindowResize= function() {
	this.camera.aspect = window.innerWidth / window.innerHeight;
	this.aspect = this.camera.aspect;
	this.camera.updateProjectionMatrix();
	this.renderer.setSize( this.evenify(window.innerWidth),this.evenify(window.innerHeight) );
}
ThreeasyEnvironment.prototype.listeners = {"update": [],"render":[]}; //update event listeners
ThreeasyEnvironment.prototype.render = function(timestep){
	var delta = this.clock.getDelta()*this.timeScale;
	this.elapsedTime += delta;
	//get timestep
	for(var i=0;i<this.listeners["update"].length;i++){
		this.listeners["update"][i]({"t":this.elapsedTime,"delta":delta});
	}

	this.renderer.render( this.scene, this.camera );

	for(var i=0;i<this.listeners["render"].length;i++){
		this.listeners["render"][i]();
	}

	this.prev_timestep = timestep;
	window.requestAnimationFrame(this.render.bind(this));
}
ThreeasyEnvironment.prototype.on = function(event_name, func){
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
ThreeasyEnvironment.prototype.removeEventListener = function(event_name, func){
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
ThreeasyEnvironment.prototype.off = ThreeasyEnvironment.prototype.removeEventListener; //alias to match ThreeasyEnvironment.on

class ThreeasyRecorder extends ThreeasyEnvironment{
	//based on http://www.tysoncadenhead.com/blog/exporting-canvas-animation-to-mov/ to record an animation
	//when done,     ffmpeg -r 60 -framerate 60 -i ./%07d.png -vcodec libx264 -pix_fmt yuv420p -crf:v 0 video.mp4
    // to perform motion blur on an oversampled video, ffmpeg -i video.mp4 -vf tblend=all_mode=average,framestep=2 video2.mp4
	//then, add the yuv420p pixels (which for some reason isn't done by the prev command) by:
	// ffmpeg -i video.mp4 -vcodec libx264 -pix_fmt yuv420p -strict -2 -acodec aac finished_video.mp4
	//check with ffmpeg -i finished_video.mp4

	constructor(autostart, fps=30, length = 5){
		/* fps is evident, autostart is a boolean (by default, true), and length is in s.*/
		super(autostart);
		this.fps = fps;
		this.elapsedTime = 0;
		this.frameCount = fps * length;
		this.frames_rendered = 0;

		this.capturer = new CCapture( {
			framerate: fps,
			format: 'png',
			name: document.title,
			//verbose: true,
		} );

		this.rendering = false;

		this.IS_RECORDING = true;
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

		this.frameCounter = document.createElement("div");
		this.frameCounter.style.position = 'absolute';
		this.frameCounter.style.top = '20px';
		this.frameCounter.style.left = '50px';
		this.frameCounter.style.color = 'black';
		this.frameCounter.style.borderRadius = '10px';
		this.frameCounter.style.backgroundColor = 'rgba(255,255,255,0.1)';
		document.body.appendChild(this.frameCounter);

		this.capturer.start();
		this.rendering = true;
		this.render();
	}
	render(timestep){
		var delta = 1/this.fps*this.timeScale; //ignoring the true time, calculate the delta

		//get timestep
		for(var i=0;i<this.listeners["update"].length;i++){
			this.listeners["update"][i]({"t":this.elapsedTime,"delta":delta});
		}

		this.renderer.render( this.scene, this.camera );

		for(var i=0;i<this.listeners["render"].length;i++){
			this.listeners["render"][i]();
		}


		this.record_frame();
		this.recording_icon.style.borderRadius = '10px';

		this.elapsedTime += delta;
		window.requestAnimationFrame(this.render.bind(this));
	}
	record_frame(){
	//	let current_frame = document.querySelector('canvas').toDataURL();

		this.capturer.capture( document.querySelector('canvas') );

		this.frameCounter.innerHTML = this.frames_rendered + " / " + this.frameCount; //update timer

		this.frames_rendered++;


		if(this.frames_rendered>this.frameCount){
			this.render = null; //hacky way of stopping the rendering
			this.recording_icon.style.display = "none";
			//this.frameCounter.style.display = "none";

			this.rendering = false;
			this.capturer.stop();
			// default save, will download automatically a file called {name}.extension (webm/gif/tar)
			this.capturer.save();
		}
	}
	onWindowResize() {
		//stop recording if window size changes
		if(this.rendering && window.innerWidth / window.innerHeight != this.aspect){
			this.capturer.stop();
			this.render = null; //hacky way of stopping the rendering
			alert("Aborting record: Window-size change detected!");
			this.rendering = false;
			return;
		}
		super.onWindowResize();
	}
}

function setupThree(autostart, fps=30, length = 5){
	/* All the existing code I have uses "new ThreeasySetup" or "new ThreeasyRecorder" and I want to switch
   between them dynamically so that you can record by appending "?record=true" to an url. */
	var recorder = null;
	var is_recording = false;

	//extract record parameter from url
	var params = new URLSearchParams(document.location.search);
	let recordString = params.get("record");

	if(recordString)is_recording = params.get("record").toLowerCase() == "true" || params.get("record").toLowerCase() == "1";

	if(is_recording){
		return new ThreeasyRecorder(autostart, fps, length);
	
	}else{
		return new ThreeasyEnvironment(autostart);
	}
}

export {setupThree, ThreeasyEnvironment, ThreeasyRecorder}
