<script type="module">
    import {kyaniteData, andalusiteData, sillimaniteData} from "../polymorphdata.js";
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

    function getSymmetryClones(atomPosition, crystaldata, extraAdirectionCells, extraBdirectionCells, extraCdirectionCells){
        let positions = [atomPosition]
        for(let i=-extraAdirectionCells;i<=extraAdirectionCells;i++){
            for(let j=-extraBdirectionCells;j<=extraBdirectionCells;j++){
                for(let k=-extraCdirectionCells;k<=extraCdirectionCells;k++){
                    let pos = atomPosition;
                    pos = EXP.Math.vectorAdd(pos, EXP.Math.vectorScale(crystaldata.aVec, i))
                    pos = EXP.Math.vectorAdd(pos, EXP.Math.vectorScale(crystaldata.bVec, j))
                    pos = EXP.Math.vectorAdd(pos, EXP.Math.vectorScale(crystaldata.cVec, k))
                    positions.push(pos)
                }
            }
        }
        return positions;
    }

    function computeBondSymmetryClones(bondarray, crystaldata, extraAdirectionCells, extraBdirectionCells, extraCdirectionCells){
        let newbonds = [];
        for(let [originalatom1pos, originalatom2pos, atom1type, atom2type] of crystaldata.bonds){
            for(let i=-extraAdirectionCells;i<=extraAdirectionCells;i++){
                for(let j=-extraBdirectionCells;j<=extraBdirectionCells;j++){
                    for(let k=-extraCdirectionCells;k<=extraCdirectionCells;k++){
                        let atom1pos = originalatom1pos;
                        let atom2pos = originalatom2pos;
                        atom1pos = EXP.Math.vectorAdd(atom1pos, EXP.Math.vectorScale(crystaldata.aVec, i))
                        atom1pos = EXP.Math.vectorAdd(atom1pos, EXP.Math.vectorScale(crystaldata.bVec, j))
                        atom1pos = EXP.Math.vectorAdd(atom1pos, EXP.Math.vectorScale(crystaldata.cVec, k))
                        atom2pos = EXP.Math.vectorAdd(atom2pos, EXP.Math.vectorScale(crystaldata.aVec, i))
                        atom2pos = EXP.Math.vectorAdd(atom2pos, EXP.Math.vectorScale(crystaldata.bVec, j))
                        atom2pos = EXP.Math.vectorAdd(atom2pos, EXP.Math.vectorScale(crystaldata.cVec, k))

                        newbonds.push([atom1pos, atom2pos, atom1type, atom2type])
                    }
                }
            }
        }
        return newbonds; //includes old bonds too
    }

    function makeBallStickDiagram(crystaldata, extraAdirectionCells=1, extraBdirectionCells=1, extraCdirectionCells=1){
        let parent = new THREE.Object3D();
        for(let atomType in crystaldata.atoms){
            let atoms = crystaldata.atoms[atomType];
            for(let i=0;i<atoms.length;i++){

                let originalAtomPos = atoms[i];
                for(let atomPos of getSymmetryClones(originalAtomPos, crystaldata, extraAdirectionCells, extraBdirectionCells, extraCdirectionCells)){
                    let material = getAtomMaterial(atomType);
                    let mesh = new THREE.Mesh(spheregeo, material)
                    //mesh.color.set(getAtomColor(atomType))
                    mesh.position.set(atomPos[0], atomPos[1],atomPos[2])
                    mesh.scale.setScalar(0.5)
                    parent.add(mesh)
                }
            }
        }

        let bondArray = computeBondSymmetryClones(crystaldata.bonds, crystaldata, extraAdirectionCells, extraBdirectionCells, extraCdirectionCells);
        let expbonds = new EXP.Area({bounds: [[0, bondArray.length-1], [0,1]], numItems: [bondArray.length, 2]});
        let expbondsoutput = new EXP.LineOutput({color: 0x333333, opacity: 0.3});
        //whichAtom is an index which is always 0,1. bondNum is always an integer.
        //bonds[x] currently hsa extra data in indices 3 and 4 for the colors
        expbonds.add(new EXP.Transformation({expr: 
            (i,t, bondNum, whichAtom) => bondArray[Math.round(bondNum)][whichAtom]
        }))
        .add(new EXP.Transformation({expr: 
            (i,t, x,y,z) => [parent.position.x + x * parent.scale.x, parent.position.y + y * parent.scale.y, parent.position.z + z * parent.scale.z]
        }))
        .add(expbondsoutput)
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
        //three.camera.zoom = 10;


        
        let [kyanite, expkyanitebonds] = makeBallStickDiagram(kyaniteData);
        three.scene.add(kyanite)
        kyanite.position.x -= 4*3;


        let [andalusite, expandalusitebonds] = makeBallStickDiagram(andalusiteData);
        three.scene.add(andalusite)
        andalusite.position.x += 4*3;


        three.on("update", (data) => {fps = Math.round(1/data.realtimeDelta)})
        /*
        var color = 0xFFFFFF;  // white
          var near = 20;
          var far = 25;
        three.scene.fog = new THREE.Fog(color, near, far);*/
    })

</script>

Fps: {fps}<br />
<canvas id="threecanvas" style:border="1px solid red" style:width={800+"px"} style:height={500+"px"}/>
