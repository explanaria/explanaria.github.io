let three, controls, controlsToRotateAboutOrigin, objects=[], knotParams;

let pointCoords = [0,0,0];

let presentation = null;

let manifoldPoint = null;//will be an EXP.Transformation

let settings = {'updateControls':true};

let xAxis, yAxis, zAxis, wAxis = null;
let xAxisControl,yAxisControl,zAxisControl = null; //the 3 3D axes
let manifoldPointOutput = null; //the 3 points on the R^3 = three Rs graph
let manifoldPointPositions = null // the positions of those points
let pointCoordinateArrows = null;

let wAxisPointPosition = null; //the dot at the end of the w-axis coordinate arrow
let wAxisCoordinateArrow = null,wAxisCoordinateArrowOutput=null;

let manifold4PointOutput = null;

function pointPath(i,t,x){
    //point in 3D space's path
    return [Math.sin(t/3), Math.sin(t/5), Math.sin(t/7), Math.sin(t/2.5)]
}


function setupThree(){
	three = EXP.setupThree(document.getElementById("canvas"));
	controls = new EXP.OrbitControls(three.camera,three.renderer.domElement);

    controlsToRotateAboutOrigin = new RotateAboutCenterControls([],three.renderer.domElement);
    
	three.camera.position.z = 3;
	three.camera.position.y = 0.5;

    controls.autoRotate = true;    
    controls.enableKeys = false;
    controls.autoRotateSpeed = 1;

    controlsToRotateAboutOrigin.enabled = false;
    
	three.on("update",function(time){
		for(var x of objects){
			x.activate(time.t);
		}

        //HACKY HACK ALERT. If I don't disable the controls, then when I try to lerp the camera position they both fight for domination over camera rotation, making a jerky ride.
		if(settings.updateControls){
            controls.update();
            controlsToRotateAboutOrigin.update(time.delta);
        }
	});
}

function setup(){
    setupThree();

    console.log("Loaded.");

    let axisSize = 1.5;
    
    var threeDPoint = new EXP.Array({data: [[0]]})
    manifoldPoint = new EXP.Transformation({expr: (i,t,x) => pointPath(i,t,x)});

    //threeDPoint's visual job is now taken by multipleManifoldPoints - multiple points which overlap, then separate.
    // it's not needed to be displayed anymore. It still needs to exist to update the DOM though.
    threeDPoint
    .add(manifoldPoint)
    //.add(new EXP.PointOutput({width:0.2, color: pointColor}));
    


    var multipleManifoldPoints = new EXP.Array({data: [[0],[1],[2]]});
    /*
    manifoldPointPositions = new EXP.Transformation({expr: (i,t,x) => {
        let point3DPos = pointPath(i,t,x); 
        let returnedPos = [point3DPos[i],i-1,0];
        return returnedPos;
        }
    });
    */
    manifoldPointPositions = new EXP.Transformation({expr: (i,t,x) => pointPath(i,t,x)});
    manifoldPointOutput = new EXP.PointOutput({width:0.2, color: pointColor});

    multipleManifoldPoints
    .add(manifoldPointPositions)
    .add(manifoldPointOutput);

    setup4DEmbedding(); //before 3DAxes

    setup4DAxes();

    wAxis.getDeepestChildren().forEach((output) => {
        output.opacity = 0;
    });
    //the fourth dimension!

    /*
    wAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
    wAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [(axisSize*x),-(1)*3/4,0]}))
    .add(new EXP.VectorOutput({width:3, color: coordinateLine4Color, opacity:0}));
    wAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [-(axisSize*x),-(1)*3/4,0]}))
    .add(new EXP.VectorOutput({width:3, color: coordinateLine4Color, opacity:0}));*/

    //the 4th axis also needs a point + vector vector
    wAxisCoordinateArrow = new EXP.Transformation({expr: (i,t,x) => i==0 ? [0,-(1)*3/4,0,0]: [pointCoords[3],-(1)*3/4,0,0]});

    wAxisCoordinateArrowOutput = new EXP.VectorOutput({width:15, color: coordinateLine4Color, opacity:0}) 

    wAxis
    .add(wAxisCoordinateArrow)
    .add(R4Embedding.makeLink())
    .add(wAxisCoordinateArrowOutput);


    //THAT'S RIGHT IT'S HORRIBLE HACK TIME
    //SET THAT ZERO COLOR
    wAxis.activate(0);
    let color1 = colorMap(0);
    wAxisCoordinateArrowOutput._setColorForVertexRGB(0, color1.r, color1.g, color1.b);

    //the point on the w axis
    let fourthManifoldPoint = new EXP.Array({data: [[0]]});
    wAxisPointPosition = new EXP.Transformation({expr: (i,t,x) => [pointCoords[3],-(1)*3/4,0,0]});
    manifold4PointOutput = new EXP.PointOutput({width:0.199, color: pointColor, opacity:0}); //slightly smaller than the manifold's 3point

    fourthManifoldPoint
    .add(wAxisPointPosition)
    .add(R4Embedding.makeLink())
    .add(manifold4PointOutput);

    //This sets the color of the point and the arrow
    fourthManifoldPoint.add(new EXP.Transformation({expr: (i,t,x,y,z,w) => {
        let color = colorMap(pointCoords[3]);
        manifold4PointOutput.color = color;
        wAxisCoordinateArrowOutput._setColorForVertexRGB(1, color.r, color.g, color.b);
        return []
     }}));


    //for each coordinate, make a vector representing the scaled basis vector
    pointCoordinateArrows = new EXP.Area({bounds: [[0,1]], numItems: 2});
    pointCoordinateArrows
    .add(manifoldPoint.makeLink())
    .add(new EXP.Transformation({expr: (i,t,x,y,z) => i==0 ? [0,0,0]: [x,0,0]}))
    .add(new EXP.VectorOutput({width:15, color: coordinateLine1Color}));

    pointCoordinateArrows
    .add(manifoldPoint.makeLink())
    .add(new EXP.Transformation({expr: (i,t,x,y,z) => i==0 ? [x,0,0]: [x,y,0]}))
    .add(new EXP.VectorOutput({width:15, color: coordinateLine2Color}));

    pointCoordinateArrows
    .add(manifoldPoint.makeLink())
    .add(new EXP.Transformation({expr: (i,t,x,y,z) => i==0 ? [x,y,0]: [x,y,z]}))
    .add(new EXP.VectorOutput({width:15, color: coordinateLine3Color}));

    //read out the point's coords
    manifoldPoint.add(new EXP.FlatArrayOutput({array: pointCoords}));


    //update all HTML elements with class coord1-num with the first coordinate of the point, and so on
    let domElems = [];
    for(var i=0;i<4;i++){
        domElems.push(Array.prototype.slice.call(document.getElementsByClassName("coord"+(i+1)+"-num")));
    }
    for(var i=0;i<3;i++){
        domElems.push(Array.prototype.slice.call(document.getElementsByClassName("orthocoord"+(i+1))));
    }

    let pointUpdater = {'activate':function(){
        for(let i=0;i<4;i++){
            domElems[i].forEach( (el) => {el.innerHTML = format(pointCoords[i])});
        }

        //update the orthogonal 4-vec's HTML elements too, in the two slides they're used
        for(let i=0;i<3;i++){
            domElems[i+4].forEach( (el) => {el.innerHTML = format(userParams.orthographic4Vec[i])});
        }
    }};

    //set all HTML elements with class "coord1" to the appropriate color
    Array.prototype.slice.call(document.getElementsByClassName("coord1")).forEach( (elem) => { elem.style.color = coordinateLine1Color; } );
    Array.prototype.slice.call(document.getElementsByClassName("coord2")).forEach( (elem) => { elem.style.color = coordinateLine2Color; } );
    Array.prototype.slice.call(document.getElementsByClassName("coord3")).forEach( (elem) => { elem.style.color = coordinateLine3Color; } );
    Array.prototype.slice.call(document.getElementsByClassName("coord4")).forEach( (elem) => { elem.style.color = coordinateLine4Color; } );
    Array.prototype.slice.call(document.getElementsByClassName("directionVecColor")).forEach( (elem) => { elem.style.color = orthographic4VecColor; } );
    Array.prototype.slice.call(document.getElementsByClassName("planeOfRotationGraphicColor")).forEach( (elem) => { elem.style.color = planeOfRotationColor; } );

	presentation = new EXP.UndoCapableDirector();

    //make sure everything gets updated.
    //xAxis, yAxis, zAxis, and wAxis are already in objects
    [threeDPoint, fourthManifoldPoint, pointCoordinateArrows, pointUpdater, multipleManifoldPoints].forEach( (x) => objects.push(x));
}

function setup3DAxes(){
    let axisSize = 1.5;

    xAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
    xAxisControl = new EXP.Transformation({expr: (i,t,x,y,z) => [x,y,z,0]});
    xAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [axisSize*x,0,0,0]}))
    .add(xAxisControl)
    .add(R4Rotation.makeLink())
    .add(R4Embedding.makeLink())
    .add(new EXP.VectorOutput({width:3, color: coordinateLine1Color}));
    
    xAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [-axisSize*x,0,0,0]}))
    .add(xAxisControl.makeLink())
    .add(R4Rotation.makeLink())
    .add(R4Embedding.makeLink())
    .add(new EXP.VectorOutput({width:3, color: coordinateLine1Color}));

    yAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
    yAxisControl = new EXP.Transformation({expr: (i,t,x,y,z) => [x,y,z,0]});
    yAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [0,axisSize*x,0,0]}))
    .add(yAxisControl)
    .add(R4Rotation.makeLink())
    .add(R4Embedding.makeLink())
    .add(new EXP.VectorOutput({width:3, color: coordinateLine2Color}));
    yAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [0,-axisSize*x,0,0]}))
    .add(yAxisControl.makeLink())
    .add(R4Rotation.makeLink())
    .add(R4Embedding.makeLink())
    .add(new EXP.VectorOutput({width:3, color: coordinateLine2Color}));

    zAxis = new EXP.Area({bounds: [[0,1]], numItems: 2});
    zAxisControl = new EXP.Transformation({expr: (i,t,x,y,z) => [x,y,z,0,0]});
    zAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [0,0,axisSize*x,0]}))
    .add(zAxisControl)
    .add(R4Rotation.makeLink())
    .add(R4Embedding.makeLink())
    .add(new EXP.VectorOutput({width:3, color: coordinateLine3Color}));
    zAxis
    .add(new EXP.Transformation({expr: (i,t,x) => [0,0,-axisSize*x,0]}))
    .add(zAxisControl.makeLink())
    .add(R4Rotation.makeLink())
    .add(R4Embedding.makeLink())
    .add(new EXP.VectorOutput({width:3, color: coordinateLine3Color}));
    
    [xAxis, yAxis,zAxis].forEach((i) => objects.push(i));
}

function format(x){
    return Number(x).toFixed(2);
}


//let fourDDemonstrateAxisPoint = [1.0,0.5,1,1];
let fourDDemonstrateAxisPoint = [-1.0,0.5,0.5,1];

async function animate(){
    if(!presentation.initialized)await presentation.begin();

    //technically this is a string. the CSS animation handles the transition.
    //let threeDCoords = document.getElementById("coords");
    //presentation.TransitionTo(threeDCoords.style, {'opacity':1}, 0);

    await presentation.nextSlide();

    //this is the slide where we break R^3 into 3 lines.
    //re-center camera
    presentation.TransitionTo(controls, {'autoRotateSpeed':0}, 250);
    await presentation.delay(300);
    presentation.TransitionTo(controls, {'autoRotate':false}, 0);

    presentation.TransitionTo(three.camera.position, {'x':0,'y':0,'z':3}, 1000);
    presentation.TransitionTo(three.camera.rotation,{'x':0,'y':0,'z':0},1000);

    await presentation.delay(1500);
    
    //separate axes
    [xAxisControl,yAxisControl,zAxisControl, wAxisControl].forEach((item, axisNumber) => {
        presentation.TransitionTo(item, {'expr': (i,t,x,y,z,w)=>[x+y+z+w, (-axisNumber+2)*3/4, 0,0]}, 1500);
    });
    
    //the wAxis is stretched by a factor of sq3 to seem more even. But we want the waxis to look the same size. Unstretch it here
    presentation.TransitionTo(wAxis.children[0], {'expr': (i,t,x)=>[0,0,0,x*1.5]}, 0);
    presentation.TransitionTo(wAxis.children[1], {'expr': (i,t,x)=>[0,0,0,-x*1.5]}, 0);
    

    //separate out the arrows for each individual coordinate
    pointCoordinateArrows.children.forEach((manifoldLink, axisNumber) => {
        let arrowSetter = manifoldLink.children[0]


    
        presentation.TransitionTo(arrowSetter, {
            expr: (i,t,x,y,z) => {
                if(i==0){
                    return [0, (-axisNumber+2)*3/4, -0.001];
                }else{
                    let coordinate = [x,y,z][axisNumber];
                    return [coordinate, (-axisNumber+2)*3/4, -0.001];
                }
            }
        }, 1500);
    });

    //move 3 points with them
    presentation.TransitionTo(manifoldPointPositions, {expr: (i,t,x) => {
        let point3DPos = pointPath(i,t,x); 
        let returnedPos = [point3DPos[i],(-i+2)*3/4,0];
        return returnedPos;
        }
    },1500);
   
    
    await presentation.nextSlide();
    //let's show that 4th axis!
    await presentation.delay(250);
    //CSS animation
    let threeDCoords = document.getElementById("coord4Reveal");
    presentation.TransitionTo(threeDCoords.style, {'fontSize':""}, 0);

    //show w axis
    wAxis.getDeepestChildren().forEach((output) => {
        presentation.TransitionTo(output, {'opacity':1}, 1000);
    });
    //show w axis point
    presentation.TransitionTo(manifold4PointOutput, {'opacity':1},1000);
    

    await presentation.nextSlide();
    await presentation.nextSlide();
    await presentation.nextSlide();
    await presentation.nextSlide();
    //We'll sneakily teleport the 3D point to a specific location so we can demonstrate easier.
    
    presentation.TransitionTo(window, {'pointPath':(i,t,x) => fourDDemonstrateAxisPoint},1000);

    await presentation.nextSlide();

    if(animate4D){
        await animateBackTo3DEmbedding();

        //fade away the point and its arrows
        pointCoordinateArrows.getDeepestChildren().forEach((output) => {
            presentation.TransitionTo(output, {opacity:0}, 1000);
        });
        [manifold4PointOutput,wAxisCoordinateArrowOutput].forEach((output) => {
            presentation.TransitionTo(output, {opacity:0}, 1000);
        });
        //and the DOM coords
        try{
            let threeDCoords = document.getElementById("coords");
            presentation.TransitionTo(threeDCoords.style, {'opacity':0}, 0);
        }catch(e){}

        //undo color shifting, too
        [xAxis, yAxis, zAxis].forEach((axis) => axis.getDeepestChildren().forEach((output) => {
            presentation.TransitionTo(output, {"color": new THREE.Color(output.color).offsetHSL(0,0.15,-0.15)});
        }));

        await presentation.nextSlide();
        await animate4D();

    }
}

async function animateBackTo3DEmbedding(){

    await presentation.nextSlide();
    //Re-center axes
    [xAxisControl,yAxisControl,zAxisControl].forEach((item, axisNumber) => {
        presentation.TransitionTo(item, {'expr': (i,t,x,y,z)=>[x, y,z, 0]}, 1000);
    });

    [xAxis, yAxis, zAxis].forEach((axis) => axis.getDeepestChildren().forEach((output) => {
        presentation.TransitionTo(output, {"color": new THREE.Color(output.color).offsetHSL(0,-0.15,0.15)});
    }));


    //re-put the XYZ arrows into tip-to-toe

    presentation.TransitionTo(three.camera.position, {'x':0,'y':0.5,'z':3}, 1000);
    presentation.TransitionTo(controls, {'autoRotateSpeed':1, autoRotate: true}, 100);

    //move point coordinate arrows back to their original positions
    let arrowFuncs = [
        (i,t,x,y,z) => i==0 ? [0,0,0]: [x,0,0],
        (i,t,x,y,z) => i==0 ? [x,0,0]: [x,y,0],
        (i,t,x,y,z) => i==0 ? [x,y,0]: [x,y,z]
    ];
    pointCoordinateArrows.children.forEach((manifoldLink, axisNumber) => {
        let arrowSetter = manifoldLink.children[0];

        presentation.TransitionTo(arrowSetter, {
            expr: arrowFuncs[axisNumber]
        }, 1000);
    });
    //re-move points back to the single path
    presentation.TransitionTo(manifoldPointPositions, {expr: (i,t,x) => pointPath(i,t,x)},1000);

    //for better viewing angle, change the ortho vector a little. TOTAL HACK ALERT
    presentation.TransitionTo(R4OrthoVector,{expr: (i,t,x,y,z) => [1/sq3,1/sq3+0.2,1/sq3]}, 1000);

    await presentation.nextSlide();
    //"Let's just choose a random direction, and put the fourth axis there."

    let redOrthoDirectionShowerVec = grayProjectionVisualizingAxes.getDeepestChildren()[6];
    presentation.TransitionTo(redOrthoDirectionShowerVec, {opacity: 1}, 1000);
    
    await presentation.nextSlide();

    //the point of this slide is to put the W axis back with the other axes.
    //show w axis point
    
    presentation.TransitionTo(window, {'pointPath':(i,t,x) => fourDDemonstrateAxisPoint},1000);

    //OK - it's w-axis moving time.
    //put the w axis back together. First, move the w axis
    presentation.TransitionTo(wAxisControl, {expr: (i,t,x,y,z,w) => [x,y,z,w]},1000);

    presentation.TransitionTo(wAxis.children[0], {'expr': (i,t,x)=>[0,0,0,x*Math.sqrt(3)]}, 1000);
    presentation.TransitionTo(wAxis.children[1], {'expr': (i,t,x)=>[0,0,0,-x*Math.sqrt(3)]}, 1000);

    //also move the w-axisarrow to start from the origin
    presentation.TransitionTo(wAxisCoordinateArrow, {'expr': (i,t,x,y,z,w)=>i==0 ? [0,0,0,0]: [0,0,0,pointCoords[3]]}, 1000);
    presentation.TransitionTo(wAxisPointPosition, {'expr': (i,t,x,y,z,w)=> [0,0,0,pointCoords[3]]}, 1000);

    await presentation.delay(1000);
    presentation.TransitionTo(redOrthoDirectionShowerVec, {opacity: 0}, 100); //hide this now that the W axis is covering it

    await presentation.nextSlide();
    //then, move the arrow to be parallel to the w axis, but starting from that point

    presentation.TransitionTo(manifold4PointOutput, {'opacity':0},250);
    presentation.TransitionTo(wAxisCoordinateArrow, {'expr': (i,t,x,y,z,w)=>i==0 ? [pointCoords[0],pointCoords[1],pointCoords[2],0]: pointCoords}, 750);
    presentation.TransitionTo(wAxisPointPosition, {'expr': (i,t,x,y,z,w)=> [pointCoords[0],pointCoords[1],pointCoords[2],0]}, 750);

    let ballSwappyTrickDelay = 100;
    await presentation.delay(750 - ballSwappyTrickDelay);
    //finally, move the point from its 3D position to its 4D projected position.

    // HORRIBLE HACK ALERT. We've swapped out the visible point from manifoldPoints, which isn't R4-projected, to wAxisPointPosition, which is
    presentation.TransitionTo(manifold4PointOutput, {'opacity':1},ballSwappyTrickDelay);
    await presentation.delay(ballSwappyTrickDelay);
    presentation.TransitionTo(manifoldPointOutput, {'opacity':0},ballSwappyTrickDelay);
    
    //move the ball from the 3D coords along the 4D arrow to the 4D projected point
    await presentation.delay(250);
    presentation.TransitionTo(wAxisPointPosition, {'expr': (i,t,x,y,z,w)=> pointCoords}, 500);

    // HECK YEAH, WE'RE EMBEDDED IN 4D
    await presentation.nextSlide();
    
    //finally, show off that for negative coordinates, we go to a -1 coordinate
    let fourDDemonstrateAxisNegativePoint = EXP.Math.clone(fourDDemonstrateAxisPoint);
    fourDDemonstrateAxisNegativePoint[3] *= -1;
    presentation.TransitionTo(window, {'pointPath':(i,t,x) => fourDDemonstrateAxisNegativePoint},1000);

    //for good measure in case something messes up with undos
    presentation.TransitionTo(manifold4PointOutput, {'opacity':1},0);

    await presentation.nextSlide();

    //back to positive
    let fourDDemonstrateAxisHalfPoint = EXP.Math.clone(fourDDemonstrateAxisPoint);
    fourDDemonstrateAxisHalfPoint[3] *= 1/2;
    presentation.TransitionTo(window, {'pointPath':(i,t,x) => fourDDemonstrateAxisHalfPoint},1000);

    await presentation.nextSlide();

    //the rest of the presentation code is in 7 visualizing4d.js
}

window.addEventListener("load",function(){
    setup();
    animate();
    setColors("x",coordinateLine1ColorDarker);
    setColors("y",coordinateLine2ColorDarker);
    setColors("z",coordinateLine3ColorDarker);
    setColors("w",coordinateLine4Color);
});

function setColors(className, color){
    let x = document.getElementsByClassName(className);
    for(var i=0;i<x.length;i++){
        x[i].style.color = color;
    }
}

//debugging code
//window.setInterval(() => { userPointParams.x1 += 0.1/30; userPointParams.x2 += 0.1/30;},1/30);
