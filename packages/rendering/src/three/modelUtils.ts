import {
  AdditiveBlending,
  Color,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  RingGeometry,
  TorusGeometry,
  type ColorRepresentation,
  type Object3D
} from 'three';

export interface ObjectPose {
  visible?: boolean;
  position?: Partial<{ x: number; y: number; z: number }>;
  rotation?: Partial<{ x: number; y: number; z: number }>;
  scale?: number | Partial<{ x: number; y: number; z: number }>;
}

export interface HologramModelOptions {
  accentColor?: ColorRepresentation;
  secondaryColor?: ColorRepresentation;
  scale?: number;
}

const FLOAT_NODE_KEY = 'aetherFloatNode';
const SPIN_NODE_KEY = 'aetherSpinNode';
const ELAPSED_MS_KEY = 'aetherElapsedMs';
const BASE_Y_KEY = 'aetherBaseY';

export function applyObjectPose(object: Object3D, pose: ObjectPose): Object3D {
  if (typeof pose.visible === 'boolean') {
    object.visible = pose.visible;
  }

  if (pose.position) {
    object.position.set(
      pose.position.x ?? object.position.x,
      pose.position.y ?? object.position.y,
      pose.position.z ?? object.position.z
    );
  }

  if (pose.rotation) {
    object.rotation.set(
      pose.rotation.x ?? object.rotation.x,
      pose.rotation.y ?? object.rotation.y,
      pose.rotation.z ?? object.rotation.z
    );
  }

  if (typeof pose.scale === 'number') {
    object.scale.setScalar(pose.scale);
  } else if (pose.scale) {
    object.scale.set(
      pose.scale.x ?? object.scale.x,
      pose.scale.y ?? object.scale.y,
      pose.scale.z ?? object.scale.z
    );
  }

  return object;
}

export function createHologramModel({
  accentColor = '#56e0ff',
  secondaryColor = '#ff8cc6',
  scale = 0.45
}: HologramModelOptions = {}): Group {
  const root = new Group();
  const floatingLayer = new Group();
  const spinLayer = new Group();

  const accent = new Color(accentColor);
  const secondary = new Color(secondaryColor);

  const core = new Mesh(
    new IcosahedronGeometry(0.28, 1),
    new MeshPhysicalMaterial({
      color: accent,
      emissive: accent.clone().multiplyScalar(0.45),
      roughness: 0.18,
      metalness: 0.22,
      transmission: 0.2,
      transparent: true,
      opacity: 0.92
    })
  );

  const orbitRing = new Mesh(
    new TorusGeometry(0.48, 0.02, 20, 80),
    new MeshBasicMaterial({
      color: secondary,
      transparent: true,
      opacity: 0.65
    })
  );

  const pulseRing = new Mesh(
    new RingGeometry(0.58, 0.72, 64),
    new MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.2,
      blending: AdditiveBlending,
      side: 2
    })
  );

  pulseRing.rotation.x = Math.PI / 2;
  pulseRing.position.y = -0.18;
  orbitRing.rotation.x = Math.PI / 3.4;

  spinLayer.add(core);
  spinLayer.add(orbitRing);
  floatingLayer.add(spinLayer);
  root.add(floatingLayer);
  root.add(pulseRing);

  root.scale.setScalar(scale);
  root.visible = false;
  root.userData[FLOAT_NODE_KEY] = floatingLayer;
  root.userData[SPIN_NODE_KEY] = spinLayer;
  root.userData[ELAPSED_MS_KEY] = 0;
  root.userData[BASE_Y_KEY] = floatingLayer.position.y;

  return root;
}

export function animateHologramModel(object: Object3D, deltaMs: number): void {
  const floatingLayer = object.userData[FLOAT_NODE_KEY] as Object3D | undefined;
  const spinLayer = object.userData[SPIN_NODE_KEY] as Object3D | undefined;
  const elapsedMs = Number(object.userData[ELAPSED_MS_KEY] ?? 0) + deltaMs;

  object.userData[ELAPSED_MS_KEY] = elapsedMs;

  if (floatingLayer) {
    const baseY = Number(object.userData[BASE_Y_KEY] ?? 0);
    floatingLayer.position.y = baseY + Math.sin(elapsedMs * 0.002) * 0.055;
  }

  if (spinLayer) {
    spinLayer.rotation.y += deltaMs * 0.0012;
    spinLayer.rotation.z += deltaMs * 0.00035;
  }
}
