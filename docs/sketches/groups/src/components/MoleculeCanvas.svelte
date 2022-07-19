<script type="module">
    import {kyaniteData, andalusiteData} from "../polymorphdata.js";
    import { THREE } from "../../../../resources/build/explanaria-bundle.js";
    import * as EXP from "../../../../resources/build/explanaria-bundle.js";
    import {onMount} from "svelte";

    const atomRadius = 0.5;
    const widthSegments = 32;
    const heightSegments = widthSegments/2;

    let spheregeo = new THREE.SphereGeometry(atomRadius, widthSegments, heightSegments);
    let material = new THREE.MeshBasicMaterial({vertexColors: THREE.VertexColors, color: "green"});

    console.log(kyaniteData)

    function getAtomColor(atomName){
        if(atomName == "O")return "red";
        if(atomName == "Al")return "grey";
        if(atomName == "Si")return "blue";
        return "green";
    }

    let materialsCache = new Map();
    function getAtomMaterial(atomName){
        if(materialsCache.has(atomName)){
            return materialsCache.get(atomName);
        }
        let mat = new THREE.MeshBasicMaterial({vertexColors: THREE.VertexColors, color: getAtomColor(atomName)});
        materialsCache.set(atomName, mat);
        return mat;
    }

    function makeBallStickDiagram(crystaldata){
        console.log(crystaldata)
        let parent = new THREE.Object3D();
        for(let atomType in crystaldata.atoms){
            let atoms = crystaldata.atoms[atomType];
            for(let i=0;i<atoms.length;i++){
                let material = getAtomMaterial(atomType);
                let mesh = new THREE.Mesh(spheregeo, material)
                //mesh.color.set(getAtomColor(atomType))
                mesh.position.set(atoms[i][0], atoms[i][1],atoms[i][2])
                parent.add(mesh)
            }
        }

        let scaleVal = 5 * 1/crystaldata.biggestBasisLength;
        parent.scale.set(scaleVal,scaleVal,scaleVal) //todo: set scale to minimum of a,b,c 
        return parent
    }


    let three, controls, fps=0;

    onMount(() => {  

        three = EXP.setupThree(document.getElementById("threecanvas"));
        window.three = three;
	    controls = new EXP.OrbitControls(three.camera,three.renderer.domElement);


        /*
        let object = makeBallStickDiagram(kyaniteData);
        three.scene.add(object)
        object.position.x -= 4;*/


        let andalusite = makeBallStickDiagram(andalusiteData);
        three.scene.add(andalusite)
        andalusite.position.x += 4;


        three.on("update", (data) => {fps = Math.round(1/data.realtimeDelta)})
    })

</script>

Fps: {fps}<br />
<canvas id="threecanvas" style:border="1px solid red" style:width={500} style:height={500}/>
