import * as EXP from "../../resources/build/explanaria-bundle.js";

import {Dynamic3DText} from "./katex-labels-v2.js";

var three = EXP.setupThree();
var controls = new EXP.OrbitControls(three.camera,three.renderer.domElement);


three.camera.position.z = 4;

console.log("Loaded.");


var embeddingTranslation = new EXP.Transformation({'expr': (i,t,x,y,z) => [x,y,z||0]});
var embedding = new EXP.Transformation({'expr': (i,t,x,y,z) => [x,y,z]});


//green lines
var area = new EXP.Area({bounds: [[0.0001,5],[0,2*Math.PI]], numItems: [41, 64]});
var applyCylindricalCoords = new EXP.Transformation({'expr': (i,t,r,theta,z) => [r*Math.cos(theta),r*Math.sin(theta),z]});
area.add(applyCylindricalCoords);
var output2 = new EXP.LineOutput({width: 3, opacity: 0.4});
applyCylindricalCoords.add(embeddingTranslation.makeLink()).add(embedding.makeLink()).add(output2);


var unitcircle = new EXP.Area({bounds: [[0,2*Math.PI]], numItems: 40});
unitcircle
	.add(new EXP.Transformation({'expr': (i,t,theta) => [1*Math.cos(theta),1*Math.sin(theta)]}))
	.add(new EXP.LineOutput({width:5, color: 0x555555}));

//objects are split into two halves so that the point at 0 goes away when 1/z sends it to infinity
//otherwise there would be a weird stretching line during the animation	
var axis1 = new EXP.Area({bounds: [[0,5]], numItems: 20});
axis1.add(embeddingTranslation.makeLink()).add(embedding.makeLink()).add(new EXP.LineOutput({width:5, color: 0x000000}));
axis1.add(new EXP.Transformation({expr: (i,t,x) => [-x,0,0]})).add(embeddingTranslation.makeLink()).add(embedding.makeLink()).add(new EXP.LineOutput({width:5, color: 0x000000}));

var axis2 = new EXP.Area({bounds: [[0,5]], numItems: 20})
axis2.add(new EXP.Transformation({expr: (i,t,y) => [0,y,0]})).add(embeddingTranslation.makeLink()).add(embedding.makeLink()).add(new EXP.LineOutput({width:5, color: 0x000000}));
axis2.add(new EXP.Transformation({expr: (i,t,y) => [0,-y,0]})).add(embeddingTranslation.makeLink()).add(embedding.makeLink()).add(new EXP.LineOutput({width:5, color: 0x000000}));



var redcircle = new EXP.Area({bounds: [[0,2*Math.PI]], numItems: 60});
redcircle
	.add(new EXP.Transformation({'expr': (i,t,theta) => [-1.25+1*Math.cos(theta),-1.75+1*Math.sin(theta),0]}))
    .add(embeddingTranslation.makeLink()).add(embedding.makeLink())
	.add(new EXP.LineOutput({width:5, color: 0xff5555, opacity: 0}));

var bluecircle = new EXP.Area({bounds: [[0,3]], numItems: 30});
bluecircle
    .add(new EXP.Transformation({'expr': (i,t, k) => [k*k*k]})) //concentrate points close to 0
	.add(new EXP.Transformation({'expr': (i,t, k) => [k, -k,0]})) //top left half of line
    .add(embeddingTranslation.makeLink()).add(embedding.makeLink())
	.add(new EXP.LineOutput({width:5, color: 0x5555ff, opacity: 0}));
bluecircle
    .add(new EXP.Transformation({'expr': (i,t, k) => [k*k*k]})) //concentrate points close to 0
	.add(new EXP.Transformation({'expr': (i,t, k) => [-k, k,0]})) //bottom right half of line
    .add(embeddingTranslation.makeLink()).add(embedding.makeLink())
	.add(new EXP.LineOutput({width:5, color: 0x5555ff, opacity: 0}));

//add some text labels
let knownPoints = [[0,0], [0,1], [1,0],[-1,0],[0,-1], [999,0], [-999,0]]
let knownPointNames = ["0",'i','1','-1','-i', '∞', '∞']

let pointPositions = new EXP.ArrayofArraysOutput();
let pointComplexCoords = new EXP.Array({data: knownPoints})
pointComplexCoords
    .add(embeddingTranslation.makeLink()).add(embedding.makeLink())
	.add(pointPositions);

let labels = []
for(let pointIndex=0; pointIndex<knownPointNames.length; pointIndex++){
    console.log(pointIndex)
    labels.push(new Dynamic3DText({
        camera: three.camera,
        renderer: three.renderer,
        position3D: (t) => {return pointPositions.array[pointIndex]}, //todo
        text: knownPointNames[pointIndex],
        align: "center",
        frostedBG: true,
        htmlParent: document.getElementById("body")
    }))
}
window.pointPositions = pointPositions;



let objects = [area, unitcircle, axis1, axis2, redcircle,bluecircle, pointComplexCoords];
objects = objects.concat(labels)

three.on("update",function(time){
    objects.forEach(item => item.activate(time.t));
	//controls.update();

	//three.camera.lookAt(new THREE.Vector3())
});

let presentation = new EXP.UndoCapableDirector();

async function animate(){
    await presentation.begin();

	await presentation.nextSlide();

	//to THE THIRD DIMENSION
	presentation.TransitionTo(three.camera.position, {'x':0,'y':-6,'z':2})
	presentation.TransitionTo(three.camera.rotation, {'x':1.325,'y':0,'z':0})

	await presentation.delay(1500);

	//to the Riemann sphere!
	presentation.TransitionTo(embedding, {'expr': (i,t,x,y,z) =>  {
        let r = Math.sqrt(x*x+y*y);
        let theta = Math.atan2(y,x)

        let newR = 2*r/(r*r+1); //distance from z axis along horizontal slice of sphere
          
        return [newR * Math.cos(theta), newR * Math.sin(theta), (r*r-1)/(r*r+1)];
    }}, 2000)

    //back to complex plane
	await presentation.nextSlide();
		presentation.TransitionTo(embedding, {'expr': (i,t,x,y,z) =>  [x,y,z]}, 2000)

    
	await presentation.nextSlide();
    redcircle.getDeepestChildren().forEach(async (output) =>
        await presentation.TransitionTo(output, {"opacity":1})
    );
    bluecircle.getDeepestChildren().forEach(async (output) =>
        await presentation.TransitionTo(output, {"opacity":1})
    );

	await presentation.nextSlide();
	await presentation.nextSlide();
	presentation.TransitionTo(embedding, {'expr': (i,t,x,y,z) =>  {
        let r = Math.sqrt(x*x+y*y);
        let theta = Math.atan2(y,x)

        let newR = 2*r/(r*r+1); //distance from z axis along horizontal slice of sphere
          
        return [newR * Math.cos(theta), newR * Math.sin(theta), (r*r-1)/(r*r+1)];
    }}, 2000)

	await presentation.nextSlide();



	//1/z, and back again, completing the transformation
	presentation.TransitionTo(embedding, {'expr': (i,t,x,y,z) => {

        let r = Math.sqrt(x*x+y*y);
        let theta = Math.atan2(y,x)
            return [Math.cos(theta)/r, Math.sin(theta)/r, 0];
        }}, 2000)
    presentation.TransitionTo(labels[0], {opacity: 0},250);

	await presentation.nextSlide();
	presentation.TransitionTo(three.camera.position, {'x':0,'y':0,'z':4})
	presentation.TransitionTo(three.camera.rotation, {'x':0,'y':0,'z':0})

	await presentation.nextSlide();

    
    presentation.TransitionTo(labels[0], {opacity: 1},250);
	presentation.TransitionTo(three.camera.position, {'x':0,'y':-4,'z':1})
	presentation.TransitionTo(three.camera.rotation, {'x':1.325,'y':0,'z':0})
	//to the Riemann sphere!
	presentation.TransitionTo(embedding, {'expr': (i,t,x,y,z) =>  {
        let r = Math.sqrt(x*x+y*y);
        let theta = Math.atan2(y,x)

        let newR = 2*r/(r*r+1); //distance from z axis along horizontal slice of sphere
          
        return [newR * Math.cos(theta), newR * Math.sin(theta), (r*r-1)/(r*r+1)];
    }}, 2000)

	await presentation.nextSlide();


	presentation.TransitionTo(embeddingTranslation, {'expr': (i,t,x,y,z) => [x+1,y,z||0]});
	await presentation.nextSlide();
    
    presentation.TransitionTo(labels[3], {opacity: 0},250);
	presentation.TransitionTo(embedding, {'expr': (i,t,x,y,z) => {

        let r = Math.sqrt(x*x+y*y);
        let theta = Math.atan2(y,x)
            return [Math.cos(theta)/r, Math.sin(theta)/r, 0];
        }}, 2000)

    await presentation.delay(3000);


	presentation.TransitionTo(three.camera.position, {'x':0,'y':0,'z':3}, 1500)
	presentation.TransitionTo(three.camera.rotation, {'x':0,'y':0,'z':0}, 1500)


}
animate();
