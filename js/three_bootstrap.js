function Threeasy_setup(){
	this.prev_timestep = 0;

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

	this.camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 10 );
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
}

Threeasy_setup.prototype.onPageLoad = function() {
	console.log("Loaded!");
	document.body.appendChild( this.container );
	this.prev_timestep = performance.now();
	this.render(this.prev_timestep);
}

Threeasy_setup.prototype.onMouseDown = function() {
	this.isMouseDown = true;
}
Threeasy_setup.prototype.onMouseUp= function() {
	this.isMouseDown = false;
}
Threeasy_setup.prototype.onPointerRestricted= function() {
	var pointerLockElement = renderer.domElement;
	if ( pointerLockElement && typeof(pointerLockElement.requestPointerLock) === 'function' ) {
		pointerLockElement.requestPointerLock();
	}
}
Threeasy_setup.prototype.onPointerUnrestricted= function() {
	var currentPointerLockElement = document.pointerLockElement;
	var expectedPointerLockElement = renderer.domElement;
	if ( currentPointerLockElement && currentPointerLockElement === expectedPointerLockElement && typeof(document.exitPointerLock) === 'function' ) {
		document.exitPointerLock();
	}
}
Threeasy_setup.prototype.onWindowResize= function() {
	this.camera.aspect = window.innerWidth / window.innerHeight;
	this.camera.updateProjectionMatrix();
	this.renderer.setSize( window.innerWidth, window.innerHeight );
}
Threeasy_setup.prototype.listeners = []; //update event listeners
Threeasy_setup.prototype.render = function(timestep){
	var delta = timestep - this.prev_timestep;
	//get timestep
	//rend.rend()
	for(var i=0;i<this.listeners.length;i++){
		this.listeners[i](delta);
	}

	this.renderer.render( this.scene, this.camera );

	this.prev_timestep = timestep;
	window.requestAnimationFrame(this.render.bind(this));
}
Threeasy_setup.prototype.on = function(event_name, func){
	//event_name = "update". Registers an event listener.
	if(event_name == "update"){ 
		this.listeners.push(func);
	}
}
