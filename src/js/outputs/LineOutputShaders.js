//SurfaceOutputShaders.js

//experiment: shaders to get the triangle pulsating!
var vShader = [
"varying vec3 vNormal;",
"varying vec3 vPosition;",
"uniform vec3 color;", //todo: make varying
"uniform float aspect;",
"attribute vec3 position;",
"attribute vec3 nextPointPosition;",
"attribute vec3 previousPointPosition;",
//"uniform float miter;",

"void main() {",
  "vec2 aspectVec = vec2(aspect, 1.0);",
  "mat4 projViewModel = projectionMatrix *",
            "modelViewMatrix;",
  "vec4 previousProjected = projViewModel * vec4(previousPointPosition, 1.0);",
  "vec4 currentProjected = projViewModel * vec4(position, 1.0);",
  "vec4 nextProjected = projViewModel * vec4(nextPointPosition, 1.0);",

  //get 2D screen space with W divide and aspect correction
  "vec2 currentScreen = currentProjected.xy / currentProjected.w * aspectVec;",
  "vec2 previousScreen = previousProjected.xy / previousProjected.w * aspectVec;",
  "vec2 nextScreen = nextProjected.xy / nextProjected.w * aspectVec;",

  "float len = thickness;",
  "float orientation = direction;",

  //starting point uses (next - current)
  "vec2 dir = vec2(0.0);",
  "if (currentScreen == previousScreen) {",
  "  dir = normalize(nextScreen - currentScreen);",
  "} ",
  //ending point uses (current - previous)
  "else if (currentScreen == nextScreen) {",
  "  dir = normalize(currentScreen - previousScreen);",
  "}",
  "//somewhere in middle, needs a join",
  "else {",
  //get directions from (C - B) and (B - A)
  "  vec2 dirA = normalize((currentScreen - previousScreen));",
  "  if (miter == 1) {",
  "    vec2 dirB = normalize((nextScreen - currentScreen));",
  "    //now compute the miter join normal and length",
  "    vec2 tangent = normalize(dirA + dirB);",
  "    vec2 perp = vec2(-dirA.y, dirA.x);",
  "    vec2 miter = vec2(-tangent.y, tangent.x);",
  "    dir = tangent;",
  "    len = thickness / dot(miter, perp);",
  "  } else {",
  "    dir = dirA;",
  "  }",
  "}",
  "vec2 normal = vec2(-dir.y, dir.x);",
  "normal *= len/2.0;",
  "normal.x /= aspect;",

  "vec4 offset = vec4(normal * orientation, 0.0, 1.0);",
  "gl_Position = currentProjected + offset;",
  "gl_PointSize = 1.0;",
"}"].join("\n")

var fShader = [
"uniform vec3 color;",
"uniform float opacity;",

"void main(){",
"  gl_FragColor = vec4(color.rgb, opacity);",	
"}"].join("\n")

var uniforms = {
	color: {
		type: 'c',
		value: new THREE.Color(0x55aa55),
	},
	thickness: {
		type: 'f',
		value: 1.0,
	},/*
	miter: {
		type: 'f',
		value: 1,
	},*/
	opacity: {
		type: 'f',
		value: 0.1,
	},
	aspect: { //aspect ratio. need to load from renderer
		type: 'f',
		value: 1.0,
	}
};

export { vShader, fShader, uniforms };
