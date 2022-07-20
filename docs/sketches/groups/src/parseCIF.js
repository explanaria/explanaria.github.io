import {Math as EXPMath} from "../../../resources/build/explanaria-bundle.js";

export function parseCIFString(cifString){
    //parses CIF, crystal information file, into a JS object
    //extremely janky and definitely not spec compliant
    let lines = cifString.trim().split("\n");
    let parsed = {};
    if(lines[0] != "data_global"){
        throw new Exception("First line isn't data_global, are you sure this is a CIF file?")
    }
    let inLoopHeader = false;
    let loopTemplate = [];
    let values = [];
    for(let line of lines){
        line = line.trim();
        if(line == 'data_global')continue; //first line

        let words = line.split(/\s+/) //split by whitespace. regex used so two spaces in a row don't create empty entries
        if(words[0][0] == "_" && !inLoopHeader){
            //something like _chemical_name_mineral "Blahite"
            savePreviousFindings(parsed, loopTemplate, values);
            values = [];
            loopTemplate = [];

            let tagName = words[0].slice(1) //remove underscore
            loopTemplate = [tagName]
            let restOfLine = line.slice(tagName.length + 1).trim();
            values.push(parseValue(restOfLine));
        }

        else if(words[0] == "loop_"){
            //save previous findings
            savePreviousFindings(parsed, loopTemplate, values);
            inLoopHeader = true;
            values = [];
            loopTemplate = [];
        }
        else if(words[0][0] == "_" && inLoopHeader){
            //values and loopTemplate should be cleared by the loop_ command
            let tagName = words[0].slice(1);
            loopTemplate.push(tagName)
        }else{
            //just a value
            inLoopHeader = false;
            let valueThing = {};
            if(loopTemplate.length > 1){
                for(let i=0;i<words.length;i++){
                    valueThing[loopTemplate[i]] = words[i]
                }
            }else{
                
                valueThing = parseValue(line);
            }
            values.push(valueThing)
        }
    }
    savePreviousFindings(parsed, loopTemplate, values);
    return parsed;
}
function savePreviousFindings(parsed, loopTemplate, values){
    if(values.length == 1){
        values = values[0]
    }
    if(values.length == 0)return;
    parsed[loopTemplate[0]] = values;
}
function parseValue(valueString){
    //handles numbers and removing quotes from quoted strings
    //does NOT handle multiline strings with ;
    if(isNumeric(valueString)){
        return Number(valueString)
    }
    if(valueString[0] == "'"){
        return valueString.slice(1, -1); //trim quotes off beginning and end 
    }
    return valueString
}

const isNumeric = (num) => (typeof(num) === 'number' || typeof(num) === "string" && num.trim() !== '') && !isNaN(num);



export function CIFStringTo3DInfo(cifstring){
    let cifData = parseCIFString(cifstring)
    let atomPositions = {};

    for(let atomData of cifData.atom_site_label){
        let atomName = atomData.atom_site_label; 
        atomName = removeFinalLowercaseLetterOrNumber(atomName); //how am i going to do this. just hardcode all the atom names??
        if(atomPositions[atomName] === undefined){
            atomPositions[atomName] = [];
        }
        let atomPos = [atomData.atom_site_fract_x, atomData.atom_site_fract_y, atomData.atom_site_fract_z];
        //generate multiple atoms from one template atom and the symmetries
        for(let atomPlace of generateSymmetricAtoms(atomPos, cifData)){
            atomPositions[atomName].push(atomPlace)
        }
    }
    imposePeriodicBoundaryConditions(atomPositions);
    deduplicateAtoms(atomPositions);

    let cartesianAtomPositions = convertToCartesianSpace(atomPositions, cifData); //all the atoms are expressed in the [a,b,c] basis. scale and stretch em  

    let [aVec, bVec, cVec] = computeBasisVectorsFromAngles(cifData);
    let bondList = computeBonds(cartesianAtomPositions, aVec, bVec, cVec);

    return {
        name: cifData.chemical_name_mineral,
        atoms: cartesianAtomPositions,
        aVec: aVec,
        bVec: bVec,
        cVec: cVec,
        bonds: bondList,
        biggestBasisLength: Math.max(cifData.cell_length_a, cifData.cell_length_b, cifData.cell_length_c),
    }
}


function generateSymmetricAtoms(atomPos, cifData){
    let symmetries = cifData.space_group_symop_operation_xyz;
    let generatedPositions = [];
    for(let symmetryString of symmetries){
        //symmetryString is something like "-x,1/2+y,z"
        let coordOperations = symmetryString.split(",");
        let coords = ['x','y','z']

        let atomPosition = [];
        for(let i=0;i<3;i++){
            let symmetryOperation = coordOperations[i].replace(coords[i], "e");
            let original = Number(atomPos[i]) //get the ith coordinate

            let symmetricCoordinate = 0;
            if(symmetryOperation=="e"){
                symmetricCoordinate = original
            }else if(symmetryOperation=="-e"){
                symmetricCoordinate = -original
            }else if(symmetryOperation=="1/2+e"){
                symmetricCoordinate = 1/2+original
            }else if(symmetryOperation=="1/2-e"){
                symmetricCoordinate = 1/2-original
            }else if(symmetryOperation=="1/4+e"){
                symmetricCoordinate = 1/4+original
            }else if(symmetryOperation=="1/4-e"){
                symmetricCoordinate = 1/4-original
            }else{
                throw new Error("Unable to parse " + symmetryOperation + "in "+symmetryString)
            }

            atomPosition.push(symmetricCoordinate)
        }
        generatedPositions.push(atomPosition)
    }
    return generatedPositions;
}


function deduplicateAtoms(atomData){
    //reduce duplicate atom positions to one atom, to vastly speed up stuff like computing bonds later
    for(let atomType in atomData){
        let generatedPositions = atomData[atomType]

        let deduplicatedPositions = [];
        for(let i=0;i<generatedPositions.length;i++){
            let newPos = generatedPositions[i];
            let duplicate = false;
            for(let j=0;j<deduplicatedPositions.length;j++){
                let existingPos = deduplicatedPositions[j];
                if((Math.abs(newPos[0] - existingPos[0]) + 
                    Math.abs(newPos[1] - existingPos[1]) + 
                    Math.abs(newPos[2] - existingPos[2])) < 0.01){
                    duplicate = true;
                    break;
                }
            }
            if(!duplicate){
                deduplicatedPositions.push(newPos)
            }
        }
        atomData[atomType] = deduplicatedPositions; 
    }
}

function imposePeriodicBoundaryConditions(atomData){

    for(let atomName in atomData){
        let atomPositions = atomData[atomName];
        for(let i=0;i<atomPositions.length;i++){

            for(let j=0;j<3;j++){
                let x = atomPositions[i][j];
                //I'd do x = x % 1, but that plays badly with negative numbers in JS
                //wrap anything below 0 or above 1 to its remainder when divided by 1
                atomPositions[i][j] = x - Math.floor(x);
            }
        }
    }
}


function convertToCartesianSpace(atomData, cifData){
    //the coordinates here go from 0 to 1, called "fractional space". but they're really at an angle and the sides might be different lengths. this function turns the fractional space into the real xyz positions of the atoms

    let [aVec, bVec, cVec] = computeBasisVectorsFromAngles(cifData);

    let newAtomPositions = {};
    for(let atomName in atomData){
        let atomPositions = atomData[atomName];
        newAtomPositions[atomName] = [];
        for(let i=0;i<atomPositions.length;i++){
            //modifies the array in place because we won't be using it later
            newAtomPositions[atomName].push(applyBasisVectors(atomPositions[i], aVec, bVec, cVec))
        }
    }
    return newAtomPositions;
}


function computeBasisVectorsFromAngles(cifData){
    //compute basis vectors from angles between them
    //from https://chemistry.stackexchange.com/posts/136837/revisions
    let α = cifData.cell_angle_alpha * Math.PI / 180; //cif files store in degrees
    let β = cifData.cell_angle_beta * Math.PI / 180;
    let γ = cifData.cell_angle_gamma * Math.PI / 180;

    let n2 = (Math.cos(α) - Math.cos(γ)*Math.cos(β)) / Math.sin(γ);

    let aVec = [cifData.cell_length_a,0,0];
    let bVec = EXPMath.vectorScale([Math.cos(γ), Math.sin(γ),0], cifData.cell_length_b);
    let cVec = EXPMath.vectorScale([Math.cos(β), n2, Math.sqrt(Math.sin(β)*Math.sin(β) - n2*n2)], cifData.cell_length_c);
    return [aVec, bVec, cVec]
}

function shouldBond(cartesianAtomPos1, cartesianAtomPos2, maxBondLength=2.3){
    //decides on whether to draw a bond between two atoms based on their positions

    let cartesianDelta = [0,1,2].map((i) => (cartesianAtomPos1[i] - cartesianAtomPos2[i]))
    let lengthSquared = cartesianDelta[0]*cartesianDelta[0] + cartesianDelta[1]*cartesianDelta[1] + cartesianDelta[2]*cartesianDelta[2];

    if(lengthSquared > 0.1 && lengthSquared < maxBondLength * maxBondLength){
        //atoms are close enough together. yes bond
        //>0.1 is used so atoms don't bond with themselves
        return true; 
    }
    return false;
}

function shouldBondWraparound(fractionalAtomPos1, fractionalAtomPos2, aVec, bVec, cVec, maxBondLength=2){
    //decides on whether to draw a bond between two atoms based on their positions
    //I want to measure M * v1 - M * v2
    //which is equal to M * (v1 - v2)
    //but if the atoms are on opposite sides of the cube, i should measure distance the short way
    // so I compute (v1 - v2), and if any components of that vector are longer than 1, the cube's side length, i shrink it
    //then multiply by M to get the length in angstroms between the two atoms

    let fractionalDelta = [0,1,2].map((i) => {
        let delta = Math.abs(fractionalAtomPos1[i] - fractionalAtomPos2[i]);
        delta = delta % 1; //wrap around the cube if needed
        return delta
    })
    let cartesianDelta = applyBasisVectors(fractionalDelta, aVec, bVec, cVec);
    let lengthSquared = cartesianDelta[0]*cartesianDelta[0] + cartesianDelta[1]*cartesianDelta[1] + cartesianDelta[2]*cartesianDelta[2];

    if(lengthSquared > 0.1 && lengthSquared < maxBondLength * maxBondLength){
        //atoms are close enough together. yes bond
        //>0.1 is used so atoms don't bond with themselves
        return true; 
    }
    return false;
}

function computeBonds(cartesianAtomPositions, aVec, bVec, cVec, includePeriodicBoundaryCrossers=true){
    //ASSUMPTION: atoms of the same type don't bond together
    //this may be incorrect
    let bonds = [];

    let allAtoms = [];
    for(let atomType in cartesianAtomPositions){
        for(let atomPos of cartesianAtomPositions[atomType]){
            allAtoms.push([atomType, atomPos])
        }
    }

    let extraAtomsBeyondThisUnitCell = []; //extra atoms in neighboring unit cells to render

    let numAtomTypes = Object.keys(cartesianAtomPositions).length;

    for(let i=0;i<allAtoms.length;i++){
        for(let j=i+1;j<allAtoms.length;j++){ //start from i+1 so atoms don't bond to themselves
            let [atom1Type, atom1Pos] = allAtoms[i];
            let [atom2Type, atom2Pos] = allAtoms[j];

            if(atom1Type == atom2Type && numAtomTypes > 1)continue; //speedup: atoms of same type don't bond.
        
            //atoms in same unit cell
            if(shouldBond(atom1Pos, atom2Pos)){
                bonds.push([atom1Pos, atom2Pos, atom1Type, atom2Type])
            }

            if(includePeriodicBoundaryCrossers){
                //atom 2 in this unit cell, atom 1 in a different one
                for(let atom1SymmetryPosition of atomCopiesInSurroundingUnitCells(atom1Pos, aVec, bVec, cVec)){
                    if(shouldBond(atom1SymmetryPosition, atom2Pos)){
                        bonds.push([atom1SymmetryPosition, atom2Pos, atom1Type, atom2Type])
                        extraAtomsBeyondThisUnitCell.push([atom1Type, atom1SymmetryPosition]);
                    }
                }
                //atom 1 in this unit cell, atom 2 in a different one
                for(let atom2SymmetryPosition of atomCopiesInSurroundingUnitCells(atom2Pos, aVec, bVec, cVec)){
                    if(shouldBond(atom1Pos, atom2SymmetryPosition)){
                        bonds.push([atom1Pos, atom2SymmetryPosition, atom1Type, atom2Type])
                        extraAtomsBeyondThisUnitCell.push([atom2Type, atom2SymmetryPosition]);
                    }
                }
            }
        }
    }
    //return extraAtomsBeyondThisUnitCell; //todo: use this data somehow
    return bonds;
}

function atomCopiesInSurroundingUnitCells(atomPos, aVec, bVec, cVec){
    //return copies of atomPos either in this unit cell or in neighboring unit cells
    return [
        [0,1,2].map((i) => atomPos[i] + aVec[i]), //vector addition
        [0,1,2].map((i) => atomPos[i] + bVec[i]),
        [0,1,2].map((i) => atomPos[i] + cVec[i]),
        [0,1,2].map((i) => atomPos[i] - aVec[i]),
        [0,1,2].map((i) => atomPos[i] - bVec[i]),
        [0,1,2].map((i) => atomPos[i] - cVec[i]),
    ]
}


function applyBasisVectors(fractionalPos, aVec, bVec, cVec){
    //compute the matrix-vector product [aVec, bVec, cVec] * fractionalPos
    //converts from fratctional (0-1) coordinates to cartesian xyz positions

    //dot with basis vectors
    let vec = [0,0,0];
    for(let i=0;i<3;i++){
        vec[i] = aVec[i] * fractionalPos[0] + bVec[i] * fractionalPos[1] + cVec[i] * fractionalPos[2];
    }
    return vec
}

function removeFinalLowercaseLetterOrNumber(atomName){

    //count numbers at end of name, then remove them
    let numbersAtEndOfName = 0;
    for(let i=atomName.length; i >= 0; i--){
        if(isNumeric(atomName[i]))numbersAtEndOfName++;
    }
    if(numbersAtEndOfName > 0){
        atomName = atomName.slice(0, -numbersAtEndOfName)
    }

    //annoying special case for this one CIF file which labels atoms Oa Ob Oc Od instead of O1 O2 O3 O4
    if(atomName[0] == "O" && atomName.length == 2 && atomName[1] != "s" && atomName[1] != "g")atomName = "O";

    return atomName;
}
