import {
  AmbientLight,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type ColorRepresentation,
  type Object3D
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { RenderConfig, RenderFrameContext, Renderer } from '../pipeline/types';
import { applyObjectPose, type ObjectPose } from './modelUtils';

const DEFAULT_RENDER_CONFIG: RenderConfig = {
  pipeline: 'forward',
  antialiasing: 'msaa',
  shadowQuality: 'high',
  maxLights: 8,
  occlusionCulling: true
};

export interface ThreeSceneRendererOptions {
  canvas?: HTMLCanvasElement;
  scene?: Scene;
  camera?: PerspectiveCamera;
  alpha?: boolean;
  antialias?: boolean;
  autoLights?: boolean;
  clearColor?: ColorRepresentation;
  pixelRatio?: number | (() => number);
}

export interface ThreeRenderFrameContext extends RenderFrameContext {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
}

export type ThreeFrameHandler = (context: ThreeRenderFrameContext) => void;

export class ThreeSceneRenderer implements Renderer {
  private config: RenderConfig = DEFAULT_RENDER_CONFIG;

  private readonly renderer: WebGLRenderer;

  private readonly scene: Scene;

  private readonly camera: PerspectiveCamera;

  private readonly loader = new GLTFLoader();

  private readonly frameHandlers = new Set<ThreeFrameHandler>();

  private readonly pixelRatio: number | (() => number);

  constructor({
    canvas,
    scene,
    camera,
    alpha = true,
    antialias = true,
    autoLights = true,
    clearColor = '#020617',
    pixelRatio = () => window.devicePixelRatio || 1
  }: ThreeSceneRendererOptions = {}) {
    this.renderer = new WebGLRenderer({
      canvas: canvas ?? document.createElement('canvas'),
      alpha,
      antialias,
      powerPreference: 'high-performance'
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setClearColor(clearColor, alpha ? 0 : 1);

    this.scene = scene ?? new Scene();
    this.camera = camera ?? new PerspectiveCamera(48, 1, 0.01, 100);
    this.camera.position.set(0, 0.1, 2.25);
    this.camera.lookAt(0, 0, 0);
    this.pixelRatio = pixelRatio;

    if (autoLights) {
      this.installDefaultLights();
    }
  }

  public configure(config: Partial<RenderConfig>): void {
    this.config = { ...this.config, ...config };
    this.renderer.shadowMap.enabled = this.config.shadowQuality !== 'low';
  }

  public render(frame: RenderFrameContext): void {
    this.resize(frame.viewportWidth, frame.viewportHeight);

    const context: ThreeRenderFrameContext = {
      ...frame,
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera
    };

    this.frameHandlers.forEach((handler) => handler(context));
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    this.frameHandlers.clear();
    this.renderer.dispose();
  }

  public getConfig(): Readonly<RenderConfig> {
    return this.config;
  }

  public getDomElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  public getScene(): Scene {
    return this.scene;
  }

  public getCamera(): PerspectiveCamera {
    return this.camera;
  }

  public setClearColor(color: ColorRepresentation, alpha = 1): void {
    this.renderer.setClearColor(color, alpha);
  }

  public add(object: Object3D): Object3D {
    this.scene.add(object);
    return object;
  }

  public remove(object: Object3D): Object3D {
    this.scene.remove(object);
    return object;
  }

  public onBeforeRender(handler: ThreeFrameHandler): () => void {
    this.frameHandlers.add(handler);
    return () => {
      this.frameHandlers.delete(handler);
    };
  }

  public async loadGLTFModel(source: string, pose: ObjectPose = {}): Promise<Object3D> {
    const gltf = await this.loader.loadAsync(source);
    return applyObjectPose(gltf.scene, pose);
  }

  private resize(width: number, height: number): void {
    const nextWidth = Math.max(1, Math.floor(width));
    const nextHeight = Math.max(1, Math.floor(height));
    const nextPixelRatio =
      typeof this.pixelRatio === 'function' ? this.pixelRatio() : this.pixelRatio;

    this.renderer.setPixelRatio(Math.max(1, nextPixelRatio));
    this.renderer.setSize(nextWidth, nextHeight, false);
    this.camera.aspect = nextWidth / nextHeight;
    this.camera.updateProjectionMatrix();
  }

  private installDefaultLights(): void {
    if (this.scene.getObjectByName('aether-default-ambient')) {
      return;
    }

    const ambient = new AmbientLight(0xffffff, 1.15);
    ambient.name = 'aether-default-ambient';

    const keyLight = new DirectionalLight(new Color('#8be9fd'), 2.8);
    keyLight.name = 'aether-default-key';
    keyLight.position.set(4, 5, 6);

    const rimLight = new DirectionalLight(new Color('#f9a8d4'), 1.35);
    rimLight.name = 'aether-default-rim';
    rimLight.position.set(-3, 2, -4);

    this.scene.add(ambient, keyLight, rimLight);
  }
}
