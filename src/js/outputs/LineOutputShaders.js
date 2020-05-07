//SurfaceOutputShaders.js

//experiment: shaders to get the triangle pulsating!
var vShader = [
"uniform vec3 color;", //todo: make varying
"uniform float aspect;", //used to calibrate screen space
"uniform float thickness;", //width of line
"uniform float miter;", //enable or disable line miters?
//"attribute vec3 position;", //added automatically by three.js
"attribute vec3 nextPointPosition;",
"attribute vec3 previousPointPosition;",
"attribute float direction;",
//"uniform float miter;",

"varying vec3 nextPtPos;",

"void main() {",

  "vec2 aspectVec = vec2(aspect, 1.0);",
  "mat4 projViewModel = projectionMatrix *",
            "viewMatrix * modelMatrix;",
  "vec4 previousProjected = projViewModel * vec4(previousPointPosition, 1.0);",
  "vec4 currentProjected = projViewModel * vec4(position, 1.0);",
  "vec4 nextProjected = projViewModel * vec4(nextPointPosition, 1.0);",

  //get 2D screen space with W divide and aspect correction
  "vec2 currentScreen = currentProjected.xy / currentProjected.w * aspectVec;",
  "vec2 previousScreen = previousProjected.xy / previousProjected.w * aspectVec;",
  "vec2 nextScreen = nextProjected.xy / nextProjected.w * aspectVec;",

  "float len = thickness;",
  "float orientation = direction;",

  "nextPtPos = vec3(currentScreen, 1.0);", //TODO: remove. it's for debugging colors

  //starting point uses (next - current)
  "vec2 dir = vec2(0.0);",
  "if (currentScreen == previousScreen) {",
  "  dir = normalize(nextScreen - currentScreen);",
  //"  nextPtPos.b = 0.0;", //TODO: remove
  "} ",
  //ending point uses (current - previous)
  "else if (currentScreen == nextScreen) {",
  "  dir = normalize(currentScreen - previousScreen);",
  "}",
  "//somewhere in middle, needs a join",
  "else {",
  //get directions from (C - B) and (B - A)
  "  vec2 dirA = normalize((currentScreen - previousScreen));",
  "  vec2 dirB = normalize((nextScreen - currentScreen));",
  "  if (miter == 1.0) {",
  "    //now compute the miter join normal and length",
  "    vec2 tangent = normalize(dirA + dirB);",
  "    vec2 perp = vec2(-dirB.y, dirB.x);",
  "    vec2 miterDirection = vec2(-tangent.y, tangent.x);",
  "    dir = tangent;",
  //"    miterExtensionDot = dot(miter, perp);", //normally this is used to solve the simultaneous solution of the two edge lines for the miter length. But if dirA and dirB are nearly parallel, the dot product will be near 0, and thickness/dot(miter, perp) will blow up!
//so instead of thickness * 1/dot(miter, perp)
// so I need a formula such that f(dot(miter, perp)) is 1/x when x is big, but instead of diverging when x=0, goes to 0.
//after experimentation with desmos I decided arctan(1/x) * arccos(c/(x+c)) works smoothly, and c=1 seems nicest.
//then I realized it was converging a bit too quickly, so sin(x) works, but clamp x to be <= pi/2 so it doesn't oscillate far from 0
  "    float miterExtensionDot = dot(miterDirection, perp);",
  //"    float miterLengthMultiplier = atan(1./miterExtensionDot)*sin(clamp(miterExtensionDot,0.0,1.5707));",
  "    len = thickness * miterExtensionDot; //miterLengthMultiplier;",
  "  } else {",
  "    dir = dirA;",
  "  }",
  "}",
  "nextPtPos = vec3(len);", //TODO: remove. it's for debugging colors
  "vec2 normal = vec2(-dir.y, dir.x) ;",
  "normal *= len/2.0;",
  "normal.x /= aspect;",

  "vec4 offset = vec4(normal * orientation, 0.0, 1.0);",
  "gl_Position = currentProjected + offset;",
  "gl_PointSize = 1.0;",
"}"].join("\n")

var fShader = [
"uniform vec3 color;",
"uniform float opacity;",
"varying vec3 nextPtPos;",

"void main(){",
"  gl_FragColor = vec4(color.rgb, opacity);",	
"  gl_FragColor = vec4((nextPtPos.rgb), opacity);",	
"}"].join("\n")

var uniforms = {
	color: {
		type: 'c',
		value: new THREE.Color(0x55aa55),
	},
	thickness: {
		type: 'f',
		value: 0.2,
	},
	miter: {
		type: 'f',
		value: 1.0,
	},
	opacity: {
		type: 'f',
		value: 1.0,
	},
	aspect: { //aspect ratio. need to load from renderer
		type: 'f',
		value: 1.0,
	}
};

export { vShader, fShader, uniforms };
