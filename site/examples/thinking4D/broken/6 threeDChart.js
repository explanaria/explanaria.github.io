

class threeDChart(){

    var cubeGridTex = new THREE.TextureLoader().load( './gridblue.png' , (tex) => {console.log("Loaded");console.log(tex)});
    var cube = new THREE.Mesh(new THREE.BoxBufferGeometry(5,5,5), new THREE.MeshBasicMaterial({ opacity:0.2, side: THREE.BackSide, map:cubeGridTex}));


	three = EXP.setupThree(60,15,document.getElementById("canvas"));
	controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);

	three.camera.position.z = 4;

    //add lights
	three.scene.add( new THREE.AmbientLight( 0x443333 ) );

	var light = new THREE.DirectionalLight( 0xffddcc, 1 );
	light.position.set( 1, 0.75, 0.5 );
	three.scene.add( light );

	var light = new THREE.DirectionalLight( 0xccccff, 1 );
	light.position.set( - 1, 0.75, - 0.5 );
	three.scene.add( light );

	loadMeshBeingCoveredInCharts();

    setupDragControls();



    atlas = new Atlas(meshBeingCoveredInCharts); //will hold all the charts
    objects.push(atlas);

    shootFirstDecal();

	raycaster = new THREE.Raycaster();

    
	three.on("update",function(time){
		for(var x of objects){
			x.activate(time.t);
		}
        centerCamera();
	});
}
