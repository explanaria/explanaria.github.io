let three, controls, objects=[];
let atlas = null;

var raycaster;

function setup() {
    
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

function loadMeshBeingCoveredInCharts() {

    /*
	var loader = new GLTFLoader();

	loader.load( 'models/gltf/LeePerrySmith/LeePerrySmith.glb', function ( gltf ) {

		meshBeingCoveredInCharts = gltf.scene.children[ 0 ];
		meshBeingCoveredInCharts.material = new THREE.MeshPhongMaterial( {
			specular: 0x111111,
			map: textureLoader.load( 'models/gltf/LeePerrySmith/Map-COL.jpg' ),
			specularMap: textureLoader.load( 'models/gltf/LeePerrySmith/Map-SPEC.jpg' ),
			normalMap: textureLoader.load( 'models/gltf/LeePerrySmith/Infinite-Level_02_Tangent_SmoothUV.jpg' ),
			shininess: 25
		} );

		three.scene.add( meshBeingCoveredInCharts );
		meshBeingCoveredInCharts.scale.set( 10, 10, 10 );

	} );*/

    //let geometry = new THREE.SphereGeometry(2, 32, 32);
    let geometry = new THREE.TorusGeometry( 2, 1, 100, 100);

    meshBeingCoveredInCharts = new THREE.Mesh(geometry,
		new THREE.MeshPhongMaterial({
			specular: 0x111111,
            color: 0xff00ff,
			shininess: 25,
		})
    );

    three.scene.add(meshBeingCoveredInCharts);
}

function shootFirstDecal(){

    let firstPoint = new THREE.Vector3(0,-1.7,1);
    let firstOrientation = new THREE.Euler(0,0,0); //euler angles.

    var chart = new CoordinateChart2D(atlas, firstPoint, firstOrientation);
    atlas.addChart(chart);
    atlas.threeDPointPos = firstPoint;
}

function removeAllCharts() {
    atlas.removeAllCharts();
}


async function animate(){
/*
    await EXP.delay(2000);
    EXP.TransitionTo(knotParams,{'a':3,'b':2});*/
}

//camera controls
let centerCameraAutomatically = true;
let cameraLookTarget = new THREE.Vector3();
function setupDragControls(){
	document.getElementById("canvas").addEventListener( 'mousedown', () => {
        centerCameraAutomatically = false;
        cameraLookTarget.set(0,0,0);
	}, false );
	document.getElementById("canvas").addEventListener( 'touchstart', () =>{
        centerCameraAutomatically = false;
        cameraLookTarget.set(0,0,0);
	}, false );

	document.getElementById("canvas").addEventListener( 'mouseup', () =>{
        centerCameraAutomatically = true;
	}, false);
	document.getElementById("canvas").addEventListener( 'touchend', () =>{
        centerCameraAutomatically = true;
	}, false);

}

function centerCamera(){
    //center the camera so it gives a view of the normal.
    //a bit nauseating though...
    let cameraTarget = atlas.threeDPointNormal.clone().multiplyScalar(3).add(atlas.threeDPointPos);

    if(centerCameraAutomatically){
        three.camera.position.lerp(cameraTarget, 0.03);
        cameraLookTarget.lerp(atlas.threeDPointPos, 0.03);
        three.camera.lookAt(cameraLookTarget);
    }

}

window.addEventListener("load",function(){
    setup();
    animate();
});

