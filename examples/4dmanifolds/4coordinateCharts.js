let three, controls, objects=[];
let atlas = null;

var raycaster;

let meshBeingCoveredInCharts= null;

function setup() {
    
	three = EXP.setupThree(60,15,document.getElementById("canvas"));
	controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);

	three.camera.position.z = 4;

    //add lights
	//three.scene.add( new THREE.AmbientLight( 0x443333 ) );
	three.scene.add( new THREE.AmbientLight( 0xaaaaaa ) );

	var light = new THREE.DirectionalLight( 0xffddcc, 0.5 );
	light.position.set( 1, 0.75, 0.5 );
	three.scene.add( light );

	var light = new THREE.DirectionalLight( 0xccccff, 0.5 );
	light.position.set( - 1, 0.75, - 0.5 );
	three.scene.add( light );


    atlas = new Atlas(null); //will hold all the charts
    objects.push(atlas);

	loadMeshBeingCoveredInCharts();

    setupDragControls();

	raycaster = new THREE.Raycaster();

	three.on("update",function(time){
		for(var x of objects){
			x.activate(time.t);
		}
        centerCamera();
	});
}

let mammothMesh = null;
function loadMeshBeingCoveredInCharts() {

    
	var loader = new THREE.GLTFLoader();

	loader.load( 'mammoth.glb', function ( gltf ) {

		mammothMesh = gltf.scene.children[ 0 ];
		mammothMesh.material = new THREE.MeshPhongMaterial( {
			specular: 0x111111,
            color: 0xDEB887,
			shininess: 25
		} );

	} );

    setMeshToTorus();
}

function setMeshToMammoth(){
    if(mammothMesh != null){
		three.scene.add( mammothMesh );
		mammothMesh.scale.set(1/5,1/5,1/5);
        mammothMesh.rotation.set(-Math.PI/2,0,Math.PI/2)
        mammothMesh.position.set(2,-6,0);
        setMeshBeingCoveredInCharts(mammothMesh, [0,0,12]);
    }
}

function setMeshToTorus(){
    let geometry = new THREE.TorusGeometry( 2, 1, 100, 100);
    let torus = new THREE.Mesh(geometry,
		new THREE.MeshPhongMaterial({
			specular: 0x111111,
            color: 0xff00ff,
			shininess: 25,
		})
    )


    let size = 1.7;
    atlas.newChartSize = new THREE.Vector3(size,size,2);

    let firstChartPoint = [0,-1.71,1];
    setMeshBeingCoveredInCharts(torus, firstChartPoint);

    //shoot a second chart to the up-right of that first chart
    shootFirstDecal([1.4,-1.41,1], [0,0,0]);

    //hide ball on second chart
    atlas.charts.forEach( (chart, num) => {if(num>0)chart.hideDraggables(); chart.twoDslider.onWindowResize()})

    //set position to first chart, not second chart
    atlas.threeDPointPos.set(...firstChartPoint);

}

function setMeshToSphere(){
    let geometry = new THREE.SphereGeometry(2, 32, 32);
    let sphere = new THREE.Mesh(geometry,
		new THREE.MeshPhongMaterial({
			specular: 0x111111,
            color: 0xff00ff,
			shininess: 25,
		})
    );

    let size = 2.5;
    atlas.newChartSize = new THREE.Vector3(size,size,size);

    let rotationHelper = new THREE.Object3D();

    //front
    setMeshBeingCoveredInCharts(sphere, [0,0,2]);

    //R
    shootFirstDecal([2,0,0], [Math.PI,Math.PI/2,Math.PI]);

    //back
    shootFirstDecal([0,0,-2], [0,-Math.PI,0]);
    //L
    shootFirstDecal([-2,0,0], [-Math.PI,-Math.PI/2,Math.PI]);

    //poles, the finickiest
    shootFirstDecal([0,2,0], [-Math.PI/2,0,0]);
    shootFirstDecal([0,-2,0], [Math.PI/2,0,0]);

    atlas.charts.forEach( (i, num) => {if(num>0)i.hideDraggables()});


    atlas.threeDPointPos.set(0,0,2);
}

function setMeshBeingCoveredInCharts(mesh, firstDecalPosition, firstDecalAngle){
    if(meshBeingCoveredInCharts !== null)three.scene.remove(meshBeingCoveredInCharts);
    atlas.removeAllCharts();
    
    meshBeingCoveredInCharts = mesh;
    atlas.meshBeingCoveredInCharts = mesh;
    three.scene.add(mesh);

    shootFirstDecal(firstDecalPosition, firstDecalAngle);

}

function shootFirstDecal(position=[0,-1.71,1], eulerAngle=[0,0,0]){

    let firstPoint = new THREE.Vector3(position[0],position[1],position[2]);
    let firstOrientation = new THREE.Euler(eulerAngle[0],eulerAngle[1],eulerAngle[2]); //euler angles.

    var chart = new CoordinateChart2D(atlas, firstPoint, firstOrientation);
    atlas.addChart(chart);
    atlas.threeDPointPos = firstPoint;
}

let presentation = new EXP.NonDecreasingDirector();
async function animate(){
    
    await presentation.begin();
    await presentation.nextSlide();
    setMeshToTorus()
    await presentation.nextSlide();
    setMeshToMammoth();
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

