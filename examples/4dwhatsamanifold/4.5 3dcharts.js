let three, controls, objects, knotParams;

let userPointParams = {x1:0,x2:0,x3:0};
let rotateObjects = [];

function setup(){
	three = EXP.setupThree(60,15,document.getElementById("threeDcanvas"));
	controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);

    presentation = new EXP.UndoCapableDirector();

	three.camera.position.z = 3;
	three.camera.position.y = 0.5;

    controls.enableKeys = false;
    controls.autoRotate = false;

    three.camera.setFocalLength(40);
    three.camera.position.z = 40/3
    
	three.on("update",function(time){
		for(var x of objects){
			x.activate(time.t);
		}
		for(var x of rotateObjects){
			x.rotation.y += 0.1*(time.delta);
		}
		controls.update();
	});

	three.scene.add( new THREE.AmbientLight( 0x443333 ) );

	var light = new THREE.DirectionalLight( 0xffddcc, 1 );
	light.position.set( 1, 0.75, 0.5 );
	three.scene.add( light );

	var light = new THREE.PointLight( 0xccccff, 1 );
	light.position.set( - 1, 0.75, - 0.5 );
	three.scene.add( light );

    console.log("Loaded.");

    //cube to represent area
    
    let boxWidth = 2; //width of the area in R^3 that's being passed into this parametrization.

    let cubeGeom = new THREE.BoxGeometry(boxWidth,boxWidth,boxWidth);

    let cubeMaterial = new THREE.MeshBasicMaterial({ opacity:0.2, side: THREE.BackSide, color: new THREE.Color(coordinateLine1ColorDarker)})

    var cube = new THREE.Mesh(cubeGeom, cubeMaterial);
    three.scene.add(cube);

    let cubeMaterial2 = new THREE.MeshBasicMaterial({ opacity:0.2, side: THREE.BackSide, vertexColors: THREE.FaceColors, transparent: true});

    var cubeGridTex = new THREE.TextureLoader().load( 'grid.png', function(texture){
        cubeMaterial2.map = texture;
        cubeMaterial2.needsUpdate = true;
        cubeMaterial2.transparent = true;
    });

    var cube2 = new THREE.Mesh(new THREE.BoxGeometry(boxWidth-0.01,boxWidth-0.01,boxWidth-0.01), cubeMaterial2);
    three.scene.add(cube2);

    var leftcube = new THREE.Mesh(cubeGeom, new THREE.MeshBasicMaterial({ opacity:0.2, side: THREE.BackSide, color: new THREE.Color(coordinateLine2ColorDarker)}));
    var leftcube2 = new THREE.Mesh(new THREE.BoxGeometry(boxWidth-0.01,boxWidth-0.01,boxWidth-0.01), cubeMaterial2);
    three.scene.add(leftcube);
    three.scene.add(leftcube2);

    leftcube.position.x = -3;
    leftcube2.position.x = -3;


    var rightcube = new THREE.Mesh(cubeGeom, new THREE.MeshBasicMaterial({ opacity:0.2, side: THREE.BackSide, color: new THREE.Color(coordinateLine3ColorDarker)}));
    var rightcube2 = new THREE.Mesh(new THREE.BoxGeometry(boxWidth-0.01,boxWidth-0.01,boxWidth-0.01), cubeMaterial2);
    three.scene.add(rightcube);
    three.scene.add(rightcube2);

    rightcube.position.x = 3;
    rightcube2.position.x = 3;

    rotateObjects = [cube, cube2, leftcube, leftcube2];


    var userPoint1 = new EXP.Array({data: [[0],[-3],[3]]}); //point xes
    userPoint1
    .add(new EXP.Transformation({expr: (i,t,x) => [x,0,0]}))
    .add(new EXP.PointOutput({width:0.3, color: pointColor}));
    


    objects = [userPoint1];
}

async function animate(){

    await presentation.begin();

    await presentation.nextSlide();

    let questoinMark = document.getElementById("question");
    presentation.TransitionTo(questoinMark.style, {'opacity':"1"}, 0);

    await presentation.nextSlide();
    
    let threeDCharts = document.getElementById("threeDcanvas");
    presentation.TransitionTo(threeDCharts.style, {'opacity':"1"}, 0);


}


window.addEventListener("load",function(){
    setup();
    animate();
});

//debugging code
//window.setInterval(() => { userPointParams.x1 += 0.1/30; userPointParams.x2 += 0.1/30;},1/30);
