import "../../build/explanaria-bundle.js";
import "../../src/lib/OrbitControls.js";


import {Point, Line} from "./PointsLinesFaces.js";
import {setThreeEnvironment, getThreeEnvironment, threeEnvironment} from "./copypastes/ThreeEnvironment.js";

import "./lib/kiwi.js";
console.log(kiwi);

class Manifolder{
    constructor(threeDCanvasDOMID){
        this.threeDCanvasDOMID = threeDCanvasDOMID;
        this.objects = [];
        window.addEventListener("load",this.setup.bind(this));
    }
    setup(){
        this.canvas = document.getElementById(this.threeDCanvasDOMID);
        three = EXP.setupThree(60,15, this.canvas);
        setThreeEnvironment(three);

	    this.controls = new THREE.OrbitControls(three.camera,three.renderer.domElement);
        this.controls.enableKeys = false;

	    three.camera.position.z = 5;
       

        let p1 = new Point([0,1]);
        let p2 = new Point([1,1]);
        let p3 = new Point([1,0]);


        this.objects.push(p1);
        this.objects.push(p2);
        this.objects.push(p3);

        let line1 = new Line(p1,p2,0x55aa00);
        this.objects.push(line1);


        let line2 = new Line(p2,p3,0x55aa00);
        this.objects.push(line1);


        let line3 = new Line(p1,p3,0x55aa00);
        this.objects.push(line1);

        three.on("update",this.update.bind(this));
    }
    update(time){
            //time.dt
		    this.controls.update();
    }
}

export default Manifolder;
