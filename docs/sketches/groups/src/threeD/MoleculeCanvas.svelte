<script type="module">
    import {kyaniteData, andalusiteData, sillimaniteData} from "./polymorphdata.js";
    import {getAtomColor} from "../colors.js";
    import { THREE } from "../../../../resources/build/explanaria-bundle.js";
    import * as EXP from "../../../../resources/build/explanaria-bundle.js";
    import {onMount} from "svelte";
    import {attachCanvas, three} from "../sharedthreejscanvas.js";

    const atomRadius = 0.5;
    const widthSegments = 32;
    const heightSegments = widthSegments/2;

    let spheregeo = new THREE.SphereGeometry(atomRadius, widthSegments, heightSegments);
    let material = new THREE.MeshBasicMaterial({color: "white"});


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


    const dummy = new THREE.Object3D();
    function setInstancePositionAndScale(instancedmesh, instanceIndex, xPos, yPos, zPos, scale=1){
        //THREE.InstancedMesh only takes a matrix4, not position and scale,
        //this uses a THREE.Object3D() to calculate a matrix with the appropriate position and scale components
        dummy.position.set(xPos, yPos, zPos)
        dummy.scale.setScalar(scale)
        dummy.updateMatrix();
        
        instancedmesh.setMatrixAt(instanceIndex, dummy.matrix);
    }


    
    function numAtomsIncludingSymmetryClones(crystaldata, extraAdirectionCells, extraBdirectionCells, extraCdirectionCells){
        let total = 0;
        for(let atomType in crystaldata.atoms){
            let atoms = crystaldata.atoms[atomType];
            let numAtoms = atoms.length;
            numAtoms *= 2*extraAdirectionCells + 1;
            numAtoms *= 2*extraBdirectionCells + 1;
            numAtoms *= 2*extraCdirectionCells + 1;
            total += numAtoms;
        }
        return total;
    }

    function makeBallStickDiagram(crystaldata, extraAdirectionCells=2, extraBdirectionCells=2, extraCdirectionCells=2){
        let parent = new THREE.Object3D();

        let numAtoms = numAtomsIncludingSymmetryClones(crystaldata, extraAdirectionCells, extraBdirectionCells, extraCdirectionCells)
        console.log(numAtoms)
        let instanceIndex = 0;

        let ballMesh = new THREE.InstancedMesh(spheregeo, material, numAtoms)

        for(let atomType in crystaldata.atoms){
            let atoms = crystaldata.atoms[atomType];
            let atomColor = new THREE.Color(getAtomColor(atomType));
            for(let i=0;i<atoms.length;i++){
                let originalAtomPos = atoms[i];
                for(let atomPos of getSymmetryClones(originalAtomPos, crystaldata, extraAdirectionCells, extraBdirectionCells, extraCdirectionCells)){
                    const atomScale = 0.5;

                    ballMesh.setColorAt(instanceIndex, atomColor)
                    setInstancePositionAndScale(ballMesh, instanceIndex, 
                        atomPos[0], atomPos[1],atomPos[2],
                        atomScale)
                    instanceIndex++;
                }
            }
            ballMesh.instanceMatrix.needsUpdate = true;
            ballMesh.instanceColor.needsUpdate = true;
        }
        parent.add(ballMesh)
        window.ballMesh = ballMesh;

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
        //three.on("update", (data) => {expbonds.activate()})

        //optimization: only activate the EXP thing once, giving a static mesh, then attach it to the parent's transform
        expbonds.activate();
        parent.add(expbondsoutput.mesh)


        let scaleVal = 5 * 1/crystaldata.biggestBasisLength;
        parent.scale.set(scaleVal,scaleVal,scaleVal) //todo: set scale to minimum of a,b,c 
        return [parent, expbonds]
    }


    let controls, fps=0;

    onMount(() => {  
        let canvas = attachCanvas("threecanvas", "threecanvas")

        window.three = three;
	    controls = new EXP.OrbitControls(three.camera,three.renderer.domElement);


        three.camera.position.z = 40;
        //three.camera.zoom = 10;


        
        let [kyanite, expkyanitebonds] = makeBallStickDiagram(kyaniteData);
        three.scene.add(kyanite)
        kyanite.position.x -= 4*5;
        kyanite.position.y -= 5;


        let [andalusite, expandalusitebonds] = makeBallStickDiagram(andalusiteData);
        three.scene.add(andalusite)
        andalusite.position.x += 4*5;
        andalusite.position.y -= 5;


        three.on("update", (data) => {fps = Math.round(1/data.realtimeDelta)})
        /*
        var color = 0xFFFFFF;  // white
          var near = 20;
          var far = 25;
        three.scene.fog = new THREE.Fog(color, near, far);*/
    })
    /* todo: onDestroy() */

</script>

<style>
    .threecanvascontainer{
        width:100%;
        height:100%;
        border-left: 1px solid gray;
        border-right: 1px solid gray;
    }
</style>


<div style:position="absolute" style:top="0%" style:text-align="right">Fps: {fps}</div>
<div class="threecanvascontainer" id="threecanvas" /> <!-- three.hs canvas attached here -->
