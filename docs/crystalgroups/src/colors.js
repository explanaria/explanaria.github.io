export const lightblue = "hsla(240, 90%, 70%, 1)";


export const green = "hsla(120, 90%, 70%, 1)";
export const red = "hsla(0, 90%, 70%, 1)";



export const darkergreen = "hsla(120, 90%, 40%, 1)";
export const darkerred = "hsla(0, 90%, 40%, 1)";

export const pink = "hsla(320, 90%, 80%, 1)";
export const bluishpurple = "hsla(260, 90%, 75%, 1)";
export const teal = "hsla(200, 90%, 70%, 1)";

export const yellow = "hsla(60, 80%, 50%, 1)";
export const coolGreen = "hsla(90, 80%, 50%, 1)";
export const greenishTeal = "hsla(140, 80%, 80%, 1)";

//chapters 0,1
export function getAtomColor(atomName){
    if(atomName == "O")return "red";
    if(atomName == "Al")return "grey";
    if(atomName == "Si")return "blue";
    return "green";
}

//orange to green
export const chapter2linecolor = teal; //aVec
export const chapter2linecolor2 = coolGreen; //a + c
export const chapter2linecolor3 = yellow; //c

export const aVecColor = chapter2linecolor; //aVec
export const bVecColor = "hsla(140, 80%, 80%, 1)"; //bVec
export const cVecColor = chapter2linecolor3; //c
export const aPlusCVecColor = chapter2linecolor2;

//chapter 3
export const generator1color = darkergreen;
export const generator2color = darkerred;
export const drawGeneratorsWithOutlines = false;
export const drawEyesOnArrows = true;

export const identityColor = "hsla(240, 0%, 70%, 1)";

export const rfColor = bluishpurple;
export const rColor = green;
export const rrColor = darkergreen;
export const generatorColors = [green, red, bluishpurple, lightblue]; //subtle bug here: this will error if we use a group with more generator than there are colors here

export let defaultGroupElementBorderColor = lightblue;

export function chooseElementBorderColor(group, element){
    if(element.name == "e"){
        return identityColor;
    }
    if(specialGeneratorColors[element.name] !== undefined){
        return specialGeneratorColors[element.name];
    }
    if(group.generators.indexOf(element) !== -1){ //if the element is a generator, color it appropriately
        return generatorColors[group.generators.indexOf(element)] ;
    }
    return defaultGroupElementBorderColor;
}

//chapter 5
export const mirrorColor = "hsla(40, 60%, 50%, 1)";
export const mirrorColor2 = "hsla(70, 60%, 50%, 1)";
export const glidePlaneColor1 = "navy";
export const glidePlaneColor2 = "cyan";
export const rotationColor = rColor;

export const inversionColor = defaultGroupElementBorderColor;

export const glideRotationColor1 = defaultGroupElementBorderColor;
export const glideRotationColor2 = defaultGroupElementBorderColor;
export const glideRotationColor3 = defaultGroupElementBorderColor;

export const specialGeneratorColors = {"r": rColor, "rf":rfColor, "rr":rrColor, "a": aVecColor, "b": bVecColor, "c": cVecColor, "c⁻¹": cVecColor, "ca": aPlusCVecColor, "m": mirrorColor, "m2": mirrorColor2, "g": glidePlaneColor1};
