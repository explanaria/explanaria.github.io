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

        let words = line.split(" ")
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
_cell_modulation_dimension
const isNumeric = (num) => (typeof(num) === 'number' || typeof(num) === "string" && num.trim() !== '') && !isNaN(num);



function CIFDataTo3DInfo(cifdata){
    let atomTypes = {};

    let aVec = [cifdata.cell_length_a,0,0];
    let bVec = rotateAlongAxis([cifdata.cell_length_b,0,0], cifData._cell_angle_beta); //are these the right angles?
    let cVec = rotateAlongAxis([cifdata.cell_length_c,0,0], cifData._cell_angle_gamma);
    //assert bVec dot cVec / bVec.length / cVec.length == Math.cos(cell_angle_alpha)

    for(let atomData of cifdata.atom_site_label){
        let atomName = atomData.atom_site_label; 
        removeFinalLowercaseLetterOrNumber(); //how am i going to do this. just hardcode all the atom names??
        if(atomTypes[atomName] === undefined)atomTypes[atomName] = [];
        atomTypes[atomName].push([atomData.atom_site_fract_x, atomData.atom_site_fract_y, atomData.atom_site_fract_z])
    }

}
