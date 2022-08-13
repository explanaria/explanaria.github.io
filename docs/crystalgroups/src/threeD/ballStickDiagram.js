import {getAtomColor} from "../colors.js";
import * as EXP from "../../../resources/build/explanaria-bundle.js";

let THREE = EXP.THREE;


const atomRadius = 0.5;
const widthSegments = 32;
const heightSegments = widthSegments/2;

let spheregeo = new THREE.SphereGeometry(atomRadius, widthSegments, heightSegments);
//let material = new THREE.MeshBasicMaterial({color: "white"}); //tinted by vertex colors
//one new material per diagram

export function getSymmetryClones(atomPosition, crystaldata, extraAdirectionCells, extraBdirectionCells, extraCdirectionCells){
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

export function computeBondSymmetryClones(bondarray, crystaldata, extraAdirectionCells, extraBdirectionCells, extraCdirectionCells){
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
export function setInstancePositionAndScale(instancedmesh, instanceIndex, xPos, yPos, zPos, scale=1){
    //THREE.InstancedMesh only takes a matrix4, not position and scale,
    //this uses a THREE.Object3D() to calculate a matrix with the appropriate position and scale components
    dummy.position.set(xPos, yPos, zPos)
    dummy.scale.setScalar(scale)
    dummy.updateMatrix();
    
    instancedmesh.setMatrixAt(instanceIndex, dummy.matrix);
}



export function numAtomsIncludingSymmetryClones(crystaldata, extraAdirectionCells, extraBdirectionCells, extraCdirectionCells){
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

export function allAtoms(crystalData){
        let allAtoms = [];
        Object.keys(crystalData.atoms).forEach(
            atomName => {allAtoms = allAtoms.concat(crystalData.atoms[atomName])}
        );
        return allAtoms;
}   

export function makeBallStickDiagram(crystaldata, extraAdirectionCells=2, extraBdirectionCells=2, extraCdirectionCells=2){
    let parent = new THREE.Object3D();

    let numAtoms = numAtomsIncludingSymmetryClones(crystaldata, extraAdirectionCells, extraBdirectionCells, extraCdirectionCells)
    let instanceIndex = 0;

    let material = new THREE.MeshBasicMaterial({color: "white"}); //tinted by vertex colors
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
