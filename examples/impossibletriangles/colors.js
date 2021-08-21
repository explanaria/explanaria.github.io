
const validIntegerColor = "green";
const invalidIntegerColor = "maroon";


//2 colors
let rColor = new THREE.Color("hsl(0, 80%, 50%)");0x00ff55;
let sColor = new THREE.Color("hsl(120, 80%, 50%)");0x4488ff;
let tColor = new THREE.Color("hsl(240, 80%, 50%)");0x55ff00;
let twoNColor = new THREE.Color("hsl(300, 50%, 50%)");0xff66ff;

let white = new THREE.Color("white");
let black = new THREE.Color("black");


let yColor = new THREE.Color("hsl(180, 80%, 50%)");
let xColor = new THREE.Color("hsl(60, 80%, 50%)");

let gridColor = new THREE.Color(0xcccccc);


//unused right now
let rTextColor = new THREE.Color(rColor); rTextColor.offsetHSL(0,-0.2,0.4);
let sTextColor = new THREE.Color(sColor); sTextColor.offsetHSL(0,0,0.4);
let tTextColor = new THREE.Color(tColor); tTextColor.offsetHSL(0,0,0.4);
let twoNTextColor = new THREE.Color(twoNColor); //twoNTextColor.offsetHSL(0,0,0.2);
rTextColor = sTextColor = tTextColor = white;



export {rColor, sColor, tColor, twoNColor, yColor, xColor, gridColor, white, black, rTextColor, sTextColor, tTextColor, twoNTextColor, invalidIntegerColor, validIntegerColor};

