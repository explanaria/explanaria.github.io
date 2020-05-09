//LineOutputShaders.js

//based on https://mattdesl.svbtle.com/drawing-lines-is-hard but with several errors corrected, bevel shading added, and more

var vShader = [
"uniform float aspect;", //used to calibrate screen space
"uniform float lineWidth;", //width of line
"uniform float miter;", //enable or disable line miters?
"uniform float bevel;", //enable or disable line bevels?
"uniform float roundjoin;", //enable or disable round line joins?
//"attribute vec3 position;", //added automatically by three.js
"attribute vec3 nextPointPosition;",
"attribute vec3 previousPointPosition;",
"attribute float direction;",
"attribute float approachNextOrPrevVertex;",

"varying float crossLinePosition;",
"attribute vec3 color;",
"varying vec3 vColor;",
"varying vec2 lineSegmentAClipSpace;",
"varying vec2 lineSegmentBClipSpace;",
"varying float thickness;",


"varying vec3 debugInfo;",

"vec3 angle_to_hue(float angle) {", //for debugging
"  angle /= 3.141592*2.;",
"  return clamp((abs(fract(angle+vec3(3.0, 2.0, 1.0)/3.0)*6.0-3.0)-1.0), 0.0, 1.0);",
"}",

//given an unit vector, move dist units perpendicular to it.
"vec2 offsetPerpendicularAlongScreenSpace(vec2 dir, float twiceDist) {",
  "vec2 normal = vec2(-dir.y, dir.x) ;",
  "normal *= twiceDist/2.0;",
  "normal.x /= aspect;",
  "return normal;",
"}",

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

  //"centerPointClipSpacePosition = currentProjected.xy / currentProjected.w;",//send to fragment shader
  "crossLinePosition = direction;", //send direction to the fragment shader
  "vColor = color;", //send direction to the fragment shader

  "thickness = lineWidth / 400.;", //TODO: convert lineWidth to pixels
  "float orientation = direction;",

  //get directions from (C - B) and (B - A)
  "vec2 vecA = (currentScreen - previousScreen);",
  "vec2 vecB = (nextScreen - currentScreen);",
  "vec2 dirA = normalize(vecA);",
  "vec2 dirB = normalize(vecB);",

  //DEBUG
  "lineSegmentAClipSpace = mix(previousScreen,currentScreen,approachNextOrPrevVertex) / aspectVec;",//send to fragment shader
  "lineSegmentBClipSpace = mix(currentScreen,nextScreen,approachNextOrPrevVertex) / aspectVec;",//send to fragment shader

  //"debugInfo = vec3((orientation+1.)/2.,approachNextOrPrevVertex,0.0);", //TODO: remove. it's for debugging colors

  //starting point uses (next - current)
  "vec2 offset = vec2(0.0);",
  "if (currentScreen == previousScreen) {",
  "  offset = offsetPerpendicularAlongScreenSpace(dirB * orientation, thickness);",
  //offset += dirB * thickness; //end cap
  "} ",
  //ending point uses (current - previous)
  "else if (currentScreen == nextScreen) {",
  "  offset = offsetPerpendicularAlongScreenSpace(dirA * orientation, thickness);",
  //offset += dirA * thickness; //end cap
  "}",
  "//somewhere in middle, needs a join",
  "else {",
  "  if (miter == 1.0) {",
        //corner type: miter. This is buggy (there's no miter limit yet) so don't use
  "    //now compute the miter join normal and length",
  "    vec2 miterDirection = normalize(dirA + dirB);",
  "    vec2 prevLineExtrudeDirection = vec2(-dirA.y, dirA.x);",
  "    vec2 miter = vec2(-miterDirection.y, miterDirection.x);",
  "    float len = thickness / (dot(miter, prevLineExtrudeDirection)+0.0001);", //calculate. dot product is always > 0
  "    offset = offsetPerpendicularAlongScreenSpace(miterDirection * orientation, len);",
  "  } else if (bevel == 1.0){",
    //corner type: bevel
  "    vec2 dir = mix(dirA, dirB, approachNextOrPrevVertex);",
  "    offset = offsetPerpendicularAlongScreenSpace(dir * orientation, thickness);",
  "  } else if (roundjoin == 1.0){",
    //corner type: round
  "    vec2 dir = mix(dirA, dirB, approachNextOrPrevVertex);",
  "    vec2 halfThicknessPastTheVertex = dir*thickness/2. * approachNextOrPrevVertex / aspectVec;",
  "    offset = offsetPerpendicularAlongScreenSpace(dir * orientation, thickness) - halfThicknessPastTheVertex;", //extend rects past the vertex
  "  } else {", //no line join type specified, just go for the previous point
  "    offset = offsetPerpendicularAlongScreenSpace(dirA, thickness);",
  "  }",
  "}",

  "debugInfo = vec3(approachNextOrPrevVertex, orientation, 0.0);", //TODO: remove. it's for debugging colors
  "gl_Position = currentProjected + vec4(offset, 0.0,0.0) *currentProjected.w;",
"}"].join("\n");

var fShader = [
"uniform float opacity;",
"uniform vec2 screenSize;",
"uniform float aspect;",
"varying vec3 vColor;",
"varying vec3 debugInfo;",
"varying vec2 lineSegmentAClipSpace;",
"varying vec2 lineSegmentBClipSpace;",
"varying float crossLinePosition;",
"varying float thickness;",


"float lineSDF(vec2 point, vec2 lineStartPt,vec2 lineEndPt) {",
  "float h = clamp(dot(point-lineStartPt,lineEndPt-lineStartPt)/dot(lineEndPt-lineStartPt,lineEndPt-lineStartPt),0.0,1.0);",
  "vec2 projectedVec = (point-lineStartPt-(lineEndPt-lineStartPt)*h);",
  "return length(projectedVec * vec2(aspect,1.0));",
"}",


"void main(){",
"  vec3 col = vColor.rgb;",
//"  col = debugInfo.rgb;",

"  vec2 vertScreenSpacePosition = gl_FragCoord.xy/screenSize;", //goes from 0 to 1 in both directions
"  vec2 linePtAScreenSpace = (lineSegmentAClipSpace+1.)/2.;", //convert [-1,1] to [0,1]
"  vec2 linePtBScreenSpace = (lineSegmentBClipSpace+1.)/2.;",

"  float distFromLine = lineSDF(vertScreenSpacePosition, linePtAScreenSpace,linePtBScreenSpace);",
"  float sdf = 1.-(1./thickness * 4.0 *distFromLine);",
"  float opacity2 = sdf/fwidth(sdf);",

"  gl_FragColor = vec4(col, opacity);",
"  gl_FragColor = vec4(opacity2,0.0, 0.0,opacity);",
//"  gl_FragColor = vec4(col,opacity2);",
"}"].join("\n")

var uniforms = {
	lineWidth: {
		type: 'f',
		value: 1.0, //currently in units of yHeight*400
	},
	screenSize: {
		value: new THREE.Vector2( 1, 1 ),
	},
	miter: {
		type: 'f',
		value: 0.0,
	},
	bevel: {
		type: 'f',
		value: 0.0,
	},
	roundjoin: {
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
