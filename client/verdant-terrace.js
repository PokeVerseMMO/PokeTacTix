import * as THREE from "./vendor/three.module.min.js";
import { BENCH_TOP, PODIUM, benchXZ, petalSystem } from "./arena.js";
import { sceneryMotion } from "./scenery-motion.js";
import { WIND } from "./scenery.js";

const WIDTH = 1672, HEIGHT = 941;
// Position of the original court composition within the extended scenic painting.
const ART_WIDTH = 2470, ART_HEIGHT = 1618, INSET_X = 378, INSET_Y = 310;
const VERTICAL_FOV = 9.31;
const asset = new URL("./art/environment/verdant-blossom-terrace.webp", import.meta.url).href;
// The long lens matches the shallow perspective of the approved terrace painting.
const eye = new THREE.Vector3(0.287, 30.272, 78);
export const terraceTarget = new THREE.Vector3(0.287, 0, -0.371);

export function frameTerrace(camera, aspect) {
  const designAspect = WIDTH / HEIGHT;
  camera.aspect = aspect;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(VERTICAL_FOV / 2)) * Math.max(1, designAspect / aspect)));
  camera.position.copy(eye);
  camera.lookAt(terraceTarget);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

export async function loadTerraceArt() {
  try {
    const texture = await new THREE.TextureLoader().loadAsync(asset);
    // The plate shader works in the artwork's top-down, display-encoded coordinates.
    texture.flipY = false;
    return texture;
  } catch (error) {
    console.warn("Verdant Blossom Terrace is unavailable. Loading the floating island.", error);
    return null;
  }
}

function terraceBench(i) {
  const { x } = benchXZ(i);
  return { x, z: 8.45 };
}

function terraceGeometry() {
  const camera = new THREE.PerspectiveCamera();
  frameTerrace(camera, WIDTH / HEIGHT);
  const pixel = 2 * eye.distanceTo(terraceTarget) * Math.tan(THREE.MathUtils.degToRad(VERTICAL_FOV / 2)) / HEIGHT;
  const plane = new THREE.PlaneGeometry(ART_WIDTH * pixel, ART_HEIGHT * pixel);
  plane.translate((ART_WIDTH / 2 - INSET_X - WIDTH / 2) * pixel, (INSET_Y + HEIGHT / 2 - ART_HEIGHT / 2) * pixel, 0);
  plane.applyQuaternion(camera.quaternion);
  plane.translate(terraceTarget.x, terraceTarget.y, terraceTarget.z);
  return plane;
}

const vertexShader = `
  varying vec2 imageUV;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
    imageUV = vec2(uv.x, 1. - uv.y);
  }`;

const fragmentShader = `
  uniform sampler2D painting;
  uniform float time;
  uniform vec2 artSize;
  uniform vec2 inset;
  uniform vec2 courtSize;
  varying vec2 imageUV;

  // Coordinates are in the source painting. The banks are fixed; only radiance
  // varies within each narrow ribbon. Increasing time moves a highlight downhill.
  float fallingRibbon(vec2 p, vec2 lip, vec2 foot, float bend, vec2 widths, float seed) {
    float y = (p.y-lip.y)/(foot.y-lip.y);
    if (y <= 0. || y >= 1.) return 0.;
    float center = mix(lip.x, foot.x, y) + bend * 4.*y*(1.-y);
    float across = (p.x-center) / mix(widths.x,widths.y,y);
    if (abs(across) >= 1.) return 0.;
    float mask = (1.-smoothstep(.68,1.,abs(across))) * smoothstep(0.,.09,y) * (1.-smoothstep(.85,1.,y));
    float lane = across*8. + seed;
    // A square-root travel time accelerates the strands slightly after the lip.
    float travel = (sqrt(y+.15)-sqrt(.15))*1.6;
    float crest = .5+.5*sin(travel*20. - time*4.8 + sin(lane*1.7)*1.4 + seed);
    float strand = .5+.5*cos(lane*3.8+sin(lane*1.3));
    return mask * (.28+.72*strand) * (pow(crest,2.)-.32);
  }

  void main(){
    vec2 p = imageUV * artSize - inset;
    vec2 uv = p / courtSize;
    vec2 sampleUV = imageUV;
    if (uv.y < .44) {
      float left = (1.-smoothstep(.30,.47,uv.x))*(1.-smoothstep(.105,.30,uv.y));
      float right = smoothstep(.63,.93,uv.x)*(1.-smoothstep(.15,.31,uv.y));
      float tip = left*smoothstep(.015,.23,uv.x) + right*(1.-smoothstep(.88,1.,uv.x));
      // The lower sprays of blossom are visible beneath the standings ribbon.
      float spray = 1.-smoothstep(.48,1.,length((uv-vec2(.966,.321))/vec2(.063,.105)));
      spray += 1.-smoothstep(.48,1.,length((uv-vec2(.026,.275))/vec2(.055,.07)));
      if (spray > 0.) {
        vec3 leaf = texture2D(painting,imageUV).rgb;
        tip += spray * smoothstep(.025,.14,leaf.r-leaf.g) * smoothstep(.0,.10,leaf.b-leaf.g);
      }
      float wind = sin(.94*time + 8.*uv.x) + .32*sin(1.6*time + 13.*uv.y);
      sampleUV += tip * vec2(.0045*wind,.0040*cos(.92*time+7.*uv.x)) * courtSize/artSize;
    }
    vec3 color = texture2D(painting,sampleUV).rgb;
    if (p.x < 175. && p.y > 347. && p.y < 880.) {
      float f = fallingRibbon(p,vec2(109.,350.),vec2(101.,461.),-1.,vec2(7.,13.),2.);
      f += fallingRibbon(p,vec2(148.,349.),vec2(156.,402.),2.,vec2(4.,7.),5.);
      f += fallingRibbon(p,vec2(142.,422.),vec2(115.,469.),-3.,vec2(5.,9.),3.);
      f += fallingRibbon(p,vec2(80.,488.),vec2(42.,584.),-5.,vec2(14.,16.),7.);
      f += fallingRibbon(p,vec2(103.,478.),vec2(63.,564.),-9.,vec2(6.,8.),1.);
      f += fallingRibbon(p,vec2(-120.,657.),vec2(-142.,862.),-6.,vec2(7.,17.),4.);
      f += fallingRibbon(p,vec2(-150.,647.),vec2(-175.,831.),-7.,vec2(5.,9.),8.);
      color += vec3(.27,.31,.33)*f;
    }
    gl_FragColor = vec4(color,1.);
  }`;


export function buildVerdantTerrace(scene, quality, texture) {
  const root = new THREE.Group();
  root.name = "Verdant Blossom Terrace";
  scene.add(root);
  scene.background = new THREE.Color(0x18273b);
  const clock = { value: 0 };
  const plate = new THREE.Mesh(terraceGeometry(), new THREE.ShaderMaterial({
    uniforms: {
      painting: { value: texture }, time: clock,
      artSize: { value: new THREE.Vector2(ART_WIDTH, ART_HEIGHT) },
      inset: { value: new THREE.Vector2(INSET_X, INSET_Y) },
      courtSize: { value: new THREE.Vector2(WIDTH, HEIGHT) }
    }, vertexShader, fragmentShader,
    depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false
  }));
  plate.renderOrder = -100;
  plate.frustumCulled = false;
  root.add(plate);

  root.add(new THREE.HemisphereLight(0xfff1db, 0x9fa788, 1.55));
  const sun = new THREE.DirectionalLight(0xffe3b5, 2.1);
  sun.position.set(-10, 16, 6);
  root.add(sun, sun.target);
  const podium = new THREE.Group();
  podium.position.set(PODIUM.x, 0, PODIUM.z);
  root.add(podium);
  if (quality.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 14, bottom: -14, near: 1, far: 46 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = 0.025;
    const shadow = new THREE.ShadowMaterial({ opacity: 0.26, depthWrite: false });
    const receiver = (parent, geom, x, y, z) => {
      const mesh = new THREE.Mesh(geom, shadow);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, y, z);
      mesh.receiveShadow = true;
      mesh.renderOrder = -2;
      parent.add(mesh);
    };
    receiver(root, new THREE.PlaneGeometry(16.4, 13.9), 0, 0, 0);
    receiver(podium, new THREE.CircleGeometry(1.35, 32), 0, PODIUM.h, 0);
    receiver(root, new THREE.PlaneGeometry(16.1, 1.2), 0.6, BENCH_TOP, terraceBench(0).z);
  }

  const drift = new THREE.Group();
  const petalCount = Math.round(quality.petals * 0.6), petalOpacity = 0.76;
  drift.add(
    petalSystem(petalCount, new THREE.Vector3(-11, 0.2, -2), new THREE.Vector3(7, 0, 11), 7.5, 0xffbfdb, petalOpacity),
    petalSystem(Math.round(petalCount * 0.6), new THREE.Vector3(7, 0.2, -3), new THREE.Vector3(5, 0, 10), 7, 0xffd4e3, petalOpacity)
  );
  root.add(drift);
  return {
    podium, benchXZ: terraceBench, opponentBenchTop: 0, opponentReserveScale: 0.78,
    update(_time, dt) {
      drift.visible = sceneryMotion.enabled;
      if (drift.visible) clock.value += dt;
      WIND.value = clock.value * 1.45;
    }
  };
}
