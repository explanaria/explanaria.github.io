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

        let bondArray = crystaldata.bonds;
        let expbonds = new EXP.Area({bounds: [[0, bondArray.length-1], [0,1]], numItems: [bondArray.length, 2]});
        //whichAtom is an index which is always 0,1. bondNum is always an integer.
        //bonds[x] currently hsa extra data in indices 3 and 4 for the colors
        expbonds.add(new EXP.Transformation({expr: 
            (i,t, bondNum, whichAtom) => crystaldata.bonds[Math.round(bondNum)][whichAtom]
        }))
        .add(new EXP.Transformation({expr: 
            (i,t, x,y,z) => [parent.position.x + x * parent.scale.x, parent.position.y + y * parent.scale.y, parent.position.z + z * parent.scale.z]
        }))
        .add(new EXP.LineOutput({color: 0x333333}))
        three.on("update", (data) => {expbonds.activate()})


        let scaleVal = 5 * 1/crystaldata.biggestBasisLength;
        parent.scale.set(scaleVal,scaleVal,scaleVal) //todo: set scale to minimum of a,b,c 
        return [parent, expbonds]
    }


    let three, controls, fps=0;

    onMount(() => {  

        three = EXP.setupThree(document.getElementById("threecanvas"));
        window.three = three;
	    controls = new EXP.OrbitControls(three.camera,three.renderer.domElement);


        three.camera.position.z = 20;
        three.camera.zoom = 10;


        
        let [kyanite, expkyanitebonds] = makeBallStickDiagram(kyaniteData);
        three.scene.add(kyanite)
        kyanite.position.x -= 4;


        let [andalusite, expandalusitebonds] = makeBallStickDiagram(andalusiteData);
        three.scene.add(andalusite)
        andalusite.position.x += 4;


        three.on("update", (data) => {fps = Math.round(1/data.realtimeDelta)})
    })

</script>

Fps: {fps}<br />
<canvas id="threecanvas" style:border="1px solid red" style:width={800+"px"} style:height={500+"px"}/>
