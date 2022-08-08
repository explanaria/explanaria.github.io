export const lightblue = "hsla(240, 90%, 70%, 1)";


export const green = "hsla(120, 90%, 70%, 1)";
export const red = "hsla(0, 90%, 70%, 1)";



export const darkergreen = "hsla(120, 90%, 40%, 1)";
export const darkerred = "hsla(0, 90%, 40%, 1)";

export const purple = "hsla(320, 90%, 70%, 1)";

export function getAtomColor(atomName){
    if(atomName == "O")return "red";
    if(atomName == "Al")return "grey";
    if(atomName == "Si")return "blue";
    return "green";
}

export const generator1color = darkergreen;
export const generator2color = darkerred;
export const drawGeneratorsWithOutlines = false;
export const drawEyesOnArrows = true;

export const identityColor = "hsla(240, 0%, 70%, 1)";

export const generatorColors = [green, red, purple, lightblue]; //subtle bug here: this will error if we use a group with more generator than there are colors here

export let defaultGroupElementBorderColor = lightblue;
