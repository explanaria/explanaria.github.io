<script type="module">
    import {kyaniteData} from "../polymorphdata.js";
    import { THREE } from "../../../../resources/build/explanaria-bundle.js";
    import * as EXP from "../../../../resources/build/explanaria-bundle.js";
    import {onMount} from "svelte";

    const atomRadius = 0.5;
    const widthSegments = 32;
    const heightSegments = widthSegments/2;

    let spheregeo = new THREE.SphereGeometry(atomRadius, widthSegments, heightSegments);
    let material = new THREE.MeshBasicMaterial({vertexColors: THREE.VertexColors, color: "green"});

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

    function makeBallStickDiagram(cifdata){
        let parent = new THREE.Object3D();
        for(let atomType in cifdata){
            let atoms = cifdata[atomType];
            console.log(atomType, atoms)
            for(let i=0;i<atoms.length;i++){
                let material = getAtomMaterial(atomType);
                let mesh = new THREE.Mesh(spheregeo, material)
                //mesh.color.set(getAtomColor(atomType))
                mesh.position.set(atoms[i][0], atoms[i][1],atoms[i][2])
                parent.add(mesh)


            }
        }
        return parent
    }


    let three, controls;

    onMount(() => {  

        three = EXP.setupThree(document.getElementById("threecanvas"));
        window.three = three;
	    controls = new EXP.OrbitControls(three.camera,three.renderer.domElement);

        let object = makeBallStickDiagram(kyaniteData);
        three.scene.add(object)

    })

</script>

<canvas id="threecanvas" style:border="1px solid red"/>
