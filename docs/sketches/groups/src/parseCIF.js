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

    return convertToCartesianSpace(atomPositions, cifData); //all the atoms are expressed in the [a,b,c] basis. scale and stretch em   
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

    for(let atomName in atomData){
        let atomPositions = atomData[atomName];
        for(let i=0;i<atomPositions.length;i++){
            //modifies the array in place because we won't be using it later
            atomPositions[i] = applyBasisVectors(atomPositions[i], aVec, bVec, cVec)
        }
    }
    return atomData
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
