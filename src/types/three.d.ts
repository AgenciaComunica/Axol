declare namespace THREE {
  type Scene = any
  type PerspectiveCamera = any
  type WebGLRenderer = any
  type Raycaster = any
  type Vector2 = any
  type Vector3 = any
  type Group = any
  type Object3D = any
  type Box3 = any
  type Color = any
  type Sprite = any
  type Shape = any
  type ShapeGeometry = any
  type MeshBasicMaterial = any
  type Mesh<TGeom = any, TMat = any> = any
  type ExtrudeGeometry = any
  type MeshStandardMaterial = any
  type Path = any
  type Material = any
  type SpriteMaterial = any
  type TextureLoader = any
  type CanvasTexture = any
  type BufferGeometry = any
  type LineBasicMaterial = any
  type LineLoop = any
  const MOUSE: any
  const TOUCH: any
  const DoubleSide: any
  const LinearFilter: any
  const MathUtils: any
  const AmbientLight: any
  const DirectionalLight: any
}

declare module 'three' {
  const THREE: any
  export = THREE
}

declare module 'three/examples/jsm/controls/OrbitControls.js' {
  export class OrbitControls {
    constructor(...args: any[])
    [key: string]: any
  }
}
