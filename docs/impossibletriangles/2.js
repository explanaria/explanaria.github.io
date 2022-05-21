import {Dynamic3DText} from "./katex-labels.js";
import {rColor, sColor, tColor, twoNColor, white, black, twoNTextColor} from "./colors.js";
import {addColorToHTML, AutoColoring3DText} from './2-addColorToHTMLMath.js';
import "./presentationmode.js";

/*
let a=1;
let b=5;
let c=7;
*/
let a=1;
let b=4;
let c=6;

addColorToHTML();

await EXP.pageLoad();
window.three = EXP.setupThree(60,15,document.getElementById("threeDcanvas"));
//var controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);

console.log("Loaded.");

three.camera.position.set(c/2,c/2,8);
three.camera.lookAt(new THREE.Vector3(c/2,c/2,0))

three.camera.position.z *= 10;
three.camera.zoom *= 10; //remove distortion from FOV and appear orthographic
three.camera.updateProjectionMatrix();

window.firstLine = new EXP.Area({bounds: [[-15,19]], numItems: 35});
firstLine.add(new EXP.LineOutput({width: 5, color: 0x777777, opacity: 0}));
firstLine.add(new EXP.PointOutput({width: 0.3, color: 0xaaaaaa, opacity: 0}));


//positions of the dots
let fakeN = 3;
let fakeB = Math.round(c/2);
let fakeA = fakeB-fakeN;
let fakeC = fakeB+fakeN;

window.firstNLine = new EXP.Area({bounds: [[fakeA, fakeC]], numItems: 2});
firstNLine.add(new EXP.Transformation({expr: (i,t,x) => [x,0,0.1]})).add(new EXP.LineOutput({width: 10, color: twoNColor, opacity: 0}));

window.dots = new EXP.Array({data: [[fakeA, 0],[fakeB, 0],[fakeC, 0]]});
dots.add(new EXP.PointOutput({width: 0.5, opacity: 0, color:sColor}));


window.firstNText1 = new Dynamic3DText({
    text: "N", 
    color: twoNColor,
    position3D: (t) => [(fakeA+fakeB)/2, -1],//(t) => window.rSquarePos.expr(0,t,a/2,a/2),
    opacity: 0,
})

window.firstNText2 = new Dynamic3DText({
    text: "N", 
    color: twoNColor,
    position3D: (t) => [(fakeB+fakeC)/2, -1],//(t) => [b/2,b/2],
    opacity: 0,
})


window.rSquarePos = new EXP.Transformation({'expr':(i,t,x,y) => [x,y]});
window.rSquare = new EXP.Array({data: [[0,0], [a,0],[a,a],[0,a]]});
rSquare
    .add(rSquarePos)
    .add(new EXP.ClosedPolygonOutput({color: rColor, opacity: 0}));

window.sSquareTop = new EXP.Array({data: [[0,b],[0,a], [b,a],[b,b]]});
sSquareTop
    .add(new EXP.Transformation({'expr':(i,t,x,y) => [x,y]}))
    .add(new EXP.ClosedPolygonOutput({color: sColor, opacity: 0}));
//sSquare.children[0].add(new EXP.LineOutput({color: 0x4488ff, width: 20}))

window.tSquareTop = new EXP.Array({data: [[0,c],[0,b],[b,b],[b,a], [c,a],[c,c]]});
tSquareTop
    .add(new EXP.Transformation({'expr':(i,t,x,y) => [x,y]}))
    .add(new EXP.ClosedPolygonOutput({color: tColor, opacity: 0}));

window.bottomPartPos = new EXP.Transformation({'expr':(i,t,x,y) => [x,y]});
window.sSquareBottom = new EXP.Array({data: [[a,a],[a,0], [b,0],[b,a]]});
sSquareBottom
    .add(bottomPartPos.makeLink())
    .add(new EXP.ClosedPolygonOutput({color: sColor, opacity: 0}));

window.tSquareBottom = new EXP.Array({data: [[b,a],[b,0],[c,0],[c,a]]});
tSquareBottom
    .add(bottomPartPos.makeLink())
    .add(new EXP.ClosedPolygonOutput({color: tColor, opacity: 0}));
    

var bigBorder1 = new EXP.Array({data: [[0,c],[0,a],[a,a],[a,0], [c,0],[c,c], [0,c],[0,a]]});
window.firstBorderLine = new EXP.LineOutput({color: twoNColor, opacity:0, width:15})
bigBorder1
    .add(new EXP.Transformation({'expr':(i,t,x,y) => [x,y,0.01]}))
    .add(firstBorderLine);

var bigBorder2 = new EXP.Array({data: [[0,a], [0,c],[c+a,c], [c+a,a], [0,a], [0,c]]});
window.secondBorderLine = new EXP.LineOutput({color: twoNColor, opacity:0, width:15})
bigBorder2
    .add(new EXP.Transformation({'expr':(i,t,x,y) => [x,y,0.01]}))
    .add(secondBorderLine);

var triangleOutline = new EXP.Array({data: [[0,a],[c+a,c], [c+a,a], [0,a], [c+a,c]]});
window.thirdTriangleOutline = new EXP.LineOutput({color: twoNColor, opacity:0, width:15})
triangleOutline
    .add(new EXP.Transformation({'expr':(i,t,x,y) => [x,y,0.01]}))
    .add(thirdTriangleOutline);



window.aText = new Dynamic3DText({
    text: "r^2", 
    color: rColor,
    position3D: (t) => [fakeA, 1],//(t) => window.rSquarePos.expr(0,t,a/2,a/2),
    frostedBG: false,
    opacity: 0,
})

window.bText = new Dynamic3DText({
    text: "s^2", 
    color: sColor,
    position3D: (t) => [fakeB, 1],//(t) => [b/2,b/2],
    frostedBG: false,
    opacity: 0,
})

window.cText = new Dynamic3DText({
    text: "t^2", 
    color: tColor,
    position3D: (t) => [fakeC, 1],//(t) => [(b+c)/2,(b+c)/2],
    frostedBG: false,
    opacity: 0,
})

window.firstTwoNText = new Dynamic3DText({
    text: "2N", 
    color: twoNTextColor,
    position3D: (t) => [(a+c)/2,(a+c)/2],
    opacity: 0,
    frostedBG: true,
})

window.secondTwoNText = new Dynamic3DText({
    text: "\\text{Still }2N", 
    color: twoNTextColor,
    position3D: (t) => [(a+c)/2,(a+c)/2],
    opacity: 0, //0
    frostedBG: true,
})

window.triangleNText = new Dynamic3DText({ //below
    text: "N", 
    color: twoNTextColor,
    position3D: (t) => [(2*c+a)/3,(2*a+c)/3],
    opacity: 0, //0
    frostedBG: true,
})

window.triangleNText2 = new Dynamic3DText({ //top
    text: "N", 
    color: twoNTextColor,
    position3D: (t) => [(2*a+c)/3,(2*c+a)/3],
    opacity: 0, //0
    frostedBG: true,
})

let sideLengthColor = black; //"green"

window.side1Text = new AutoColoring3DText({ //horizontal
    text: "t+r", 
    color: sideLengthColor,
    position3D: (t) => [(0+c)/2,a],
    opacity: 0,
    frostedBG: true,
})
window.side2Text = new AutoColoring3DText({ //vertical
    text: "t-r", 
    color: sideLengthColor,
    position3D: (t) => [c+a,(a+c)/2],
    opacity: 0,
    frostedBG: true,
    align: "left",
})
window.side3Text = new AutoColoring3DText({ //hypotenuse
    text: "2s", 
    color: sideLengthColor,
    position3D: (t) => [(0+c)/2,(a+c)/2],
    opacity: 0,
    frostedBG: true,
})

/*
var grid = new EXP.Area({bounds: [[-5,5],[-5,5]],numItems: 16});
grid.add(new EXP.PointOutput({width: 0.2, color:0xcccccc})); // grid*/

window.objects = [];
window.staticObjects = [firstLine, dots, firstNLine];
objects = objects.concat([firstNText1, firstNText2]);// firstALabel, firstBLabel, firstCLabel]);
staticObjects = staticObjects.concat([triangleOutline])
objects = objects.concat([rSquare, sSquareTop, sSquareBottom, tSquareTop, tSquareBottom, aText, bText, cText,]);
objects = objects.concat([bigBorder1, firstTwoNText, secondTwoNText,bigBorder2])
staticObjects = staticObjects.concat([triangleOutline])
objects = objects.concat([triangleNText, triangleNText2, side1Text,side2Text,side3Text])
three.on("update",function(time){
    objects.forEach(i => i.activate(time.t));
    //controls.update();
});
staticObjects.forEach(i => i.activate(0));


function setupGoat(presentation){
    //analytics
    document.addEventListener('visibilitychange', function(e) {
        if (window.goatcounter === undefined)return;
        if (document.visibilityState !== 'hidden')
            return
        if (goatcounter.filter())
            return
        navigator.sendBeacon(goatcounter.url({
            event: true,
            title: location.pathname + location.search + " unloaded on slide " + presentation.currentSlideIndex,
            path: function(p) { return 'unload-' + p + '-slide-'+presentation.currentSlideIndex },
        }))
    })
}

//begin animations
let presentation = new EXP.UndoCapableDirector();
await presentation.begin();
setupGoat(presentation);


[aText, bText, cText, firstNText1, firstNText2].forEach(label => presentation.TransitionTo(label, {'opacity':1}));

[firstLine, dots, firstNLine].forEach(item => item.getDeepestChildren().forEach(output => presentation.TransitionTo(output, {'opacity':1})));
[firstNText1, firstNText2].forEach(item => 
presentation.TransitionTo(item, {'opacity': 1}))

await presentation.nextSlide();

await presentation.nextSlide();
await presentation.nextSlide();

//let firstTexts = [firstALabel, firstBLabel, firstCLabel];
//firstTexts.forEach(label => presentation.TransitionTo(label, {'opacity':0}, 500));

[firstNText1, firstNText2].forEach(item => 
presentation.TransitionTo(item, {'opacity':0 }));
[firstLine, dots, firstNLine].forEach(item => item.getDeepestChildren().forEach(output => presentation.TransitionTo(output, {'opacity':0}, 500)));

presentation.TransitionTo(aText, {'position3D':(t) => window.rSquarePos.expr(0,t,a/2,a/2)});
presentation.TransitionTo(bText, {'position3D':(t) => [b/2,b/2]});
presentation.TransitionTo(cText, {'position3D':(t) => [(b+c)/2,(b+c)/2]});

EXP.TransitionTo(three.camera.position, {'y':c/2 + 1.5});



await presentation.delay(1000);

[rSquare, sSquareTop, sSquareBottom, tSquareTop, tSquareBottom].forEach(item => item.getDeepestChildren().forEach(output => presentation.TransitionTo(output, {'opacity':1}, 500)));
[aText, bText, cText].forEach(output => presentation.TransitionTo(output, {'color':new THREE.Color('white'), 'frostedBG': true}, 500))
await presentation.nextSlide();



await presentation.TransitionTo(bText, {'opacity':0}, 500);
await presentation.TransitionTo(cText, {'opacity':0}, 500);
await presentation.TransitionTo(rSquarePos, {'expr': (i,t,x,y) => [x-1.2,y-0.2]})
await presentation.delay(1000);

await presentation.TransitionTo(firstBorderLine, {'opacity':1}, 500);
await presentation.TransitionTo(firstTwoNText, {'opacity':1}, 500);
await presentation.nextSlide();

await presentation.TransitionTo(aText, {'opacity':0}, 500);
await presentation.TransitionTo(firstBorderLine, {'opacity':0}, 500);
await presentation.TransitionTo(firstTwoNText, {'opacity':0}), 500;

//replace this with drawing a line
await presentation.TransitionTo(bottomPartPos, {'expr': (i,t,x,y) => [x,y-0.2]}) 
//await presentation.delay(1000);
//await presentation.TransitionTo(rSquarePos, {'expr': (i,t,x,y) => [x-1.2,y-8.2]},3000) //yeet
await presentation.nextSlide();

await presentation.TransitionTo(bottomPartPos, {'expr': (i,t,x,y) => [x+c,y-0.2]})
await presentation.delay(1000);
await presentation.TransitionTo(bottomPartPos, {'expr': (i,t,x,y) => [-y+c+a+0.5,x]}, 1000)
await presentation.delay(1000);
await presentation.TransitionTo(bottomPartPos, {'expr': (i,t,x,y) => [-y+c+a,x]}, 500)
await presentation.delay(500);
await presentation.TransitionTo(secondTwoNText, {'opacity':1}, 500);
await presentation.TransitionTo(secondBorderLine, {'opacity':1}, 500);

await presentation.nextSlide();
//show triangles
//todo: fancy pull away?
await presentation.TransitionTo(secondTwoNText, {'opacity':0}, 500);
await presentation.TransitionTo(secondBorderLine, {'opacity':0});

await presentation.TransitionTo(thirdTriangleOutline, {'opacity':1}, 500);
await presentation.TransitionTo(triangleNText, {'opacity':1}, 500);
//triangleNText2?

//even better - all the sides are rational!
await presentation.nextSlide();
[side1Text,side2Text,side3Text].forEach(item => presentation.TransitionTo(item, {'opacity':1})); //not awaited. should these be awaited?
await presentation.nextSlide();
[side1Text,side2Text,side3Text, triangleNText].forEach(item => presentation.TransitionTo(item, {'opacity':0}));


[rSquare, sSquareTop, sSquareBottom, tSquareTop, tSquareBottom, thirdTriangleOutline].forEach(item => item.getDeepestChildren().forEach(output => presentation.TransitionTo(output, {'opacity':0.1}, 500)));
await presentation.nextSlide();
await presentation.nextSlide();
await presentation.nextSlide();
await presentation.nextSlide();
await presentation.nextSlide();
