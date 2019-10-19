let three, controls, objects=[];
let atlas = null;



var meshBeingCoveredInCharts;
var raycaster;
var normalLine;

var intersection = {
	intersects: false,
	point: new THREE.Vector3(),
	normal: new THREE.Vector3()
};
var mouse = new THREE.Vector2();

var mouseHelper;
var position = new THREE.Vector3();
var orientation = new THREE.Euler();

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

    //the normalLine pointing out the normals
	var geometry = new THREE.BufferGeometry();
	geometry.setFromPoints( [ new THREE.Vector3(), new THREE.Vector3() ] );

	normalLine = new THREE.Line( geometry, new THREE.LineBasicMaterial() );
	three.scene.add( normalLine );

	loadMeshBeingCoveredInCharts();



    atlas = new Atlas(meshBeingCoveredInCharts); //will hold all the charts
    objects.push(atlas);

    shootFirstDecal();

	raycaster = new THREE.Raycaster();

	mouseHelper = new THREE.Mesh( new THREE.BoxBufferGeometry( 1, 1, 10 ), new THREE.MeshNormalMaterial() );
	mouseHelper.visible = false;
	three.scene.add( mouseHelper );

	var moved = false;

	controls.addEventListener( 'change', function () {

		moved = true;

	} );

	document.getElementById("canvas").addEventListener( 'mousedown', function () {

		moved = false;

	}, false );

	document.getElementById("canvas").addEventListener( 'mouseup', function () {

		checkIntersection();
		if ( ! moved && intersection.intersects ) shootNewDecal();

	} );

	document.getElementById("canvas").addEventListener( 'mousemove', onTouchMove );
	document.getElementById("canvas").addEventListener( 'touchmove', onTouchMove );
    
	three.on("update",function(time){
		for(var x of objects){
			x.activate(time.t);
		}
        centerCamera();
	});
}

function onTouchMove( event ) {

	var x, y;

	if ( event.changedTouches ) {

		x = event.changedTouches[ 0 ].pageX;
		y = event.changedTouches[ 0 ].pageY;

	} else {

		x = event.clientX;
		y = event.clientY;

	}
    let canvas = three.renderer.domElement;
    let w = canvas.width, h = canvas.height;

	mouse.x = ( x / w ) * 2 - 1;
	mouse.y = - ( y / h ) * 2 + 1;

	checkIntersection();

}

function checkIntersection() {
    //raycast and check the mouse's position.

	if ( ! meshBeingCoveredInCharts ) return;

	raycaster.setFromCamera( mouse, three.camera );

	var intersects = raycaster.intersectObjects( [ meshBeingCoveredInCharts ] );

	if ( intersects.length > 0 ) {

		var p = intersects[ 0 ].point;
		mouseHelper.position.copy( p );
		intersection.point.copy( p );

		var n = intersects[ 0 ].face.normal.clone();
		n.transformDirection( meshBeingCoveredInCharts.matrixWorld );
		n.multiplyScalar( 10 );
		n.add( intersects[ 0 ].point );

		intersection.normal.copy( intersects[ 0 ].face.normal );
		mouseHelper.lookAt( n );

		var positions = normalLine.geometry.attributes.position;
		positions.setXYZ( 0, p.x, p.y, p.z );
		positions.setXYZ( 1, n.x, n.y, n.z );
		positions.needsUpdate = true;

		intersection.intersects = true;
	} else {
		intersection.intersects = false;
	}
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

    let firstPoint = new THREE.Vector3(0,-1.5,1);
    let firstOrientation = new THREE.Euler(0,0,0); //euler angles.

    var chart = new CoordinateChart2D(atlas, firstPoint, firstOrientation);
    atlas.addChart(chart);
    atlas.threeDPointPos = firstPoint;
}

function shootNewDecal() {

	position.copy( intersection.point );
	orientation.copy( mouseHelper.rotation );

    var chart = new CoordinateChart2D(atlas, position, orientation);
    atlas.addChart(chart);

}

function removeAllCharts() {
    atlas.removeAllCharts();
}


async function animate(){
/*
    await EXP.delay(2000);
    EXP.TransitionTo(knotParams,{'a':3,'b':2});*/
}

let cameraLookTarget = new THREE.Vector3();
function centerCamera(){
    //center the camera so it gives a view of the normal.
    //a bit nauseating though...
    let cameraTarget = atlas.threeDPointNormal.clone().multiplyScalar(3).add(atlas.threeDPointPos);

    three.camera.position.lerp(cameraTarget, 0.03);

    cameraLookTarget.lerp(atlas.threeDPointPos, 0.03);

    three.camera.lookAt(cameraLookTarget);

}

window.addEventListener("load",function(){
    setup();
    animate();
});

