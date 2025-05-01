import "../../resources/build/explanaria-bundle.js";


import {RayTracingScene, ParabolicMirror, ParallelLightSource, ConicSectionMirror} from "./raytracing.js";


export default class RayTracingSim{
    constructor(threeDCanvasDOMID){
        this.threeDCanvasDOMID = threeDCanvasDOMID;
        this.objects = [];
        this.permanentObjects = [];
        window.addEventListener("load",this.setup.bind(this));
    }

    traceRays(){
        for(let x of this.objects){
            x.getDeepestChildren().forEach(output => {
                    output.mesh.geometry.dispose();
                    output.mesh.material.dispose();
                    three.scene.remove(output.mesh);
                    output.arrowheads.forEach(head => {
                        head.geometry.dispose();
                        head.material.dispose();
                        output.mesh.remove(head);
                    })
            })
        }

        this.objects = [];

        this.raytracing.clear();
        this.raytracing.trace();
        this.raytracing.rays.forEach(ray => {

            let raySource = new EXP.Array({data: [
                    ray.origin,
                    EXP.Math.vectorAdd(ray.origin, EXP.Math.vectorScale(ray.direction, ray.visualizationLength))
                ]
            })
            raySource.add(new EXP.VectorOutput());
            this.objects.push(raySource);
        })

    }

    setup(){
        this.canvas = document.getElementById(this.threeDCanvasDOMID);
        three = EXP.setupThree(60,15, this.canvas);
        //EXP.setThreeEnvironment(three);

	    this.controls = new EXP.OrbitControls(three.camera,three.renderer.domElement);
        this.controls.enableKeys = false;

	    three.camera.position.z = 5;

        let func = new EXP.Area({bounds: [[-5,5],[-5,5]]});
        func.add(new EXP.PointOutput({color: "orange", width: 0.2}));
        this.permanentObjects.push(func);



        this.raytracing = new RayTracingScene();
        this.raytracing.add(new ParabolicMirror(3, 5));
        //this.raytracing.add(new ParabolicMirror(-3, 2));
        this.raytracing.add(new ParallelLightSource([-2,0], [1,0], 6, 15));



        this.raytracing.glassElements.forEach(glass => {

            if(glass instanceof ConicSectionMirror){
                let mirrorLine = new EXP.Area({bounds: [[-glass.aperture/2, glass.aperture/2]]});
                mirrorLine.add(new EXP.Transformation({expr: (i,t,y) => [glass.xCurveCoord(y),y]}))
                .add(new EXP.LineOutput({color: "gray"}));
                this.permanentObjects.push(mirrorLine)
            }

        });

        this.traceRays();

        /*
        this.resultData = this.raytracing.rays.map(ray => [
            ray.origin,
            EXP.Math.vectorAdd(ray.origin, ray.direction)
        ]);
        let raySource = new EXP.Array({data: this.resultData
        })
        raySource.add(new EXP.VectorOutput());
        raySource.add(new EXP.PointOutput());
        this.objects.push(raySource)*/


        three.on("update",this.update.bind(this));
    }
    update(time){
            //time.dt
		    this.controls.update();

            //let angle = time.t/6 * Math.PI;

            let angle = Math.sin(time.t*2)/10;

            /*
            this.raytracing.glassElements[0].eccentricity = 0;
            if(time.t > 4){
                    this.raytracing.glassElements[0].eccentricity = 1;
                if(time.t < 5){
                    this.raytracing.glassElements[0].eccentricity = time.t-4;
                }
            
            }else{
            }*/


            this.raytracing.raySources[0].normal = [Math.cos(angle), Math.sin(angle)];
            //if(!window.doneOnce){
                this.traceRays();
            //}
            window.doneOnce = true;

            this.objects.forEach(obj => obj.activate());
            this.permanentObjects.forEach(obj => obj.activate());
    }
}


window.game = new RayTracingSim("threeDCanvas");
window.three = game.three;

let presentation = new EXP.UndoCapableDirector();
window.presentation = presentation;
await presentation.begin();
await presentation.nextSlide();
presentation.TransitionTo(window.game.raytracing.glassElements[0], {eccentricity: 1});
