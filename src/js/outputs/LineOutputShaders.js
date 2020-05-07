//SurfaceOutputShaders.js

//experiment: shaders to get the triangle pulsating!
var vShaderMiter = [
"uniform vec3 color;", //todo: make varying
"uniform float aspect;", //used to calibrate screen space
"uniform float thickness;", //width of line
"uniform float miter;", //enable or disable line miters?
//"attribute vec3 position;", //added automatically by three.js
"attribute vec3 nextPointPosition;",
"attribute vec3 previousPointPosition;",
"attribute float direction;",
"uniform float miter;",

"varying float crossLinePosition;",
"varying vec3 debugInfo;",

"void main() {",

  "vec2 aspectVec = vec2(aspect, 1.0);",
  "mat4 projViewModel = projectionMatrix *",
            "viewMatrix * modelMatrix;",
  "vec4 previousProjected = projViewModel * vec4(previousPointPosition, 1.0);",
  "vec4 currentProjected = projViewModel * vec4(position, 1.0);",
  "vec4 nextProjected = projViewModel * vec4(nextPointPosition, 1.0);",

  "crossLinePosition = direction;", //send direction to the fragment shader

  //get 2D screen space with W divide and aspect correction
  "vec2 currentScreen = currentProjected.xy / currentProjected.w * aspectVec;",
  "vec2 previousScreen = previousProjected.xy / previousProjected.w * aspectVec;",
  "vec2 nextScreen = nextProjected.xy / nextProjected.w * aspectVec;",

  "float len = thickness;",
  "float orientation = direction;",

  "debugInfo = vec3(currentScreen, 1.0);", //TODO: remove. it's for debugging colors

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
  "  vec2 dirB = normalize((nextScreen - currentScreen));",
  "  if (miter == 1.0) {",
  "    //now compute the miter join normal and length",
  "    vec2 miterDirection = normalize(dirA + dirB);",
  "    dir = miterDirection;",
  "    float miterExtensionDot = 1./dot(dirA, dirB);",
      "vec2 prevLineExtrudeDirection = vec2(-dirA.y, dirA.x);",
      "vec2 miter = vec2(-miterDirection.y, miterDirection.x);",
      "len = thickness / dot(miter, prevLineExtrudeDirection);", //huh?
  "  } else {",
  "    dir = dirA;",
  "  }",
  "}",
  "vec2 normal = vec2(-dir.y, dir.x) ;",
  "normal *= len/2.0;",
  "normal.x /= aspect;",

  "vec4 offset = vec4(normal * orientation, 0.0, 0.0);",
  "gl_Position = currentProjected + offset;",
  "gl_PointSize = 1.0;",
"}"].join("\n");

///////////true shader 

var vShader = [
"uniform vec3 color;", //todo: make varying
"uniform float aspect;", //used to calibrate screen space
"uniform float thickness;", //width of line
"uniform float miter;", //enable or disable line miters?
"uniform float bevel;", //enable or disable line bevels?
//"attribute vec3 position;", //added automatically by three.js
"attribute vec3 nextPointPosition;",
"attribute vec3 previousPointPosition;",
"attribute float direction;",
"attribute float approachNextOrPrevVertex;",

"varying float crossLinePosition;",

"varying vec3 debugInfo;",

"void main() {",

  "vec2 aspectVec = vec2(aspect, 1.0);",
  "mat4 projViewModel = projectionMatrix *",
            "viewMatrix * modelMatrix;",
  "vec4 previousProjected = projViewModel * vec4(previousPointPosition, 1.0);",
  "vec4 currentProjected = projViewModel * vec4(position, 1.0);",
  "vec4 nextProjected = projViewModel * vec4(nextPointPosition, 1.0);",

  "crossLinePosition = direction;", //send direction to the fragment shader

  //get 2D screen space with W divide and aspect correction
  "vec2 currentScreen = currentProjected.xy / currentProjected.w * aspectVec;",
  "vec2 previousScreen = previousProjected.xy / previousProjected.w * aspectVec;",
  "vec2 nextScreen = nextProjected.xy / nextProjected.w * aspectVec;",

  "float len = thickness;",
  "float orientation = direction;",

  "debugInfo = vec3(abs(sin(currentProjected)));", //TODO: remove. it's for debugging colors

  "vec2 dirA = normalize((currentScreen - previousScreen));",
  "vec2 dirB = normalize((nextScreen - currentScreen));",

  //starting point uses (next - current)
  "vec2 dir = vec2(0.0);",
  "if (currentScreen == previousScreen) {",
  "  dir = dirB * orientation;",
  //"  debugInfo.b = 0.0;", //TODO: remove
  "} ",
  //ending point uses (current - previous)
  "else if (currentScreen == nextScreen) {",
  "  dir = dirA * orientation;",
  "}",
  "//somewhere in middle, needs a join",
  "else {",
  //get directions from (C - B) and (B - A)
  "  if (miter == 1.0) {",
  "    //now compute the miter join normal and length",
  "    vec2 miterDirection = normalize(dirA + dirB);",
      "vec2 prevLineExtrudeDirection = vec2(-dirA.y, dirA.x);",
      "vec2 miter = vec2(-miterDirection.y, miterDirection.x);",
      "len = thickness / dot(miter, prevLineExtrudeDirection);", //huh?
  "    dir = miterDirection * orientation;",
  "  } else if (bevel == 1.0){",
    
  "    vec2 perpA = vec2(-dirA.y, dirA.x);",
  "    vec2 perpB = vec2(-dirB.y, dirB.x);",
  "    vec2 yourDirection = mix(dirA, dirB, approachNextOrPrevVertex);",
  "    vec2 yourPerpDirection = mix(perpB, perpA, approachNextOrPrevVertex);",
  "    dir = yourDirection + yourPerpDirection * orientation;",
  "    dir = vec2(-dir.y, dir.x) ;", //perp this so it gets unperped later
  "    len = 1.0;",
  "  } else {",
  //"    dir = dirA;",
  "    dir = vec2(0,0);",
  "  }",
  "}",
  //"debugInfo = vec3(approachNextOrPrevVertex, orientation, 0.0);", //TODO: remove. it's for debugging colors
  "vec2 normal = vec2(-dir.y, dir.x) ;",
  "normal *= len/2.0;",
  "normal.x /= aspect;",

  "vec4 offset = vec4(normal, 0.0, 0.0);",
  "gl_Position = currentProjected + offset* currentProjected.w;",

  /*the start of some end cap code, which extends the ends a bit beyond in screen space where the line is
  "if (currentScreen == previousScreen) {",
  "  gl_Position += vec4(dirB,0.0,0.0) * -0.3 * currentProjected.w;",
  "} ",
  "else if (currentScreen == nextScreen) {",
  "  gl_Position += vec4(dirA,0.0,0.0) * -0.3 * currentProjected.w;",
  "}",
  */
  "gl_PointSize = 1.0;",
"}"].join("\n");

var fShader = [
"uniform vec3 color;",
"uniform float opacity;",
"varying vec3 debugInfo;",
"varying float crossLinePosition;",

"void main(){",
"  vec3 col = color.rgb;",
"  col = debugInfo.rgb;",
//"  col *= clamp(1.-2.*abs(crossLinePosition),0.0,1.0);", //this goes from 1 in the middle to 0 at the half mark
"  gl_FragColor = vec4(col, opacity);",
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
		value: 0.0,
	},
	bevel: {
		type: 'f',
		value: 0.0,
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
