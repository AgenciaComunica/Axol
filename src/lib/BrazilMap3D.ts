import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

type GeoJsonFeature = {
  type: 'Feature'
  properties?: { nome?: string; sigla?: string }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

type GeoJson = {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
}

export type StateSelect = { name: string; sigla: string; value: number }

type StateMesh = THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshStandardMaterial>
type StateGroup = THREE.Group & {
  userData: {
    name: string
    sigla: string
    value: number
    baseZ: number
    targetZ: number
    baseColor: THREE.Color
    hoverColor: THREE.Color
    targetColor: THREE.Color
  }
}

export class BrazilMap3D {
  private container: HTMLDivElement
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private controls: OrbitControls
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()
  private hasPointer = false
  private meshes: StateMesh[] = []
  private stateGroups: StateGroup[] = []
  private hovered: StateMesh | null = null
  private hoveredGroup: StateGroup | null = null
  private animationId = 0
  private resizeObserver: ResizeObserver | null = null
  private onSelect: (payload: StateSelect) => void
  private onHover?: (payload: StateSelect) => void
  private onClear?: () => void
  private valueByUf: Record<string, number>
  private mapBounds: THREE.Box3 | null = null

  constructor(
    container: HTMLDivElement,
    geojson: GeoJson,
    onSelect: (payload: StateSelect) => void,
    onHover?: (payload: StateSelect) => void,
    onClear?: () => void,
    valueByUf: Record<string, number> = {}
  ) {
    this.container = container
    this.onSelect = onSelect
    this.onHover = onHover
    this.onClear = onClear
    this.valueByUf = valueByUf

    this.scene = new THREE.Scene()

    const { width, height } = this.container.getBoundingClientRect()
    this.camera = new THREE.PerspectiveCamera(45, width / Math.max(height, 1), 0.1, 2000)
    this.camera.position.set(0, -110, 190)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(width, height)
    this.renderer.setClearColor(0x000000, 0)
    this.container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enablePan = true
    this.controls.screenSpacePanning = true
    this.controls.enableZoom = true
    this.controls.rotateSpeed = 0.2
    this.controls.panSpeed = 0.9
    this.controls.minDistance = 30
    this.controls.maxDistance = 220
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    }
    this.controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_ROTATE,
    }

    const ambient = new THREE.AmbientLight(0xffffff, 0.85)
    const directional = new THREE.DirectionalLight(0xffffff, 0.7)
    directional.position.set(80, -60, 140)
    this.scene.add(ambient, directional)

    this.loadGeoJson(geojson)
    this.limitRotation()
    this.bindEvents()
    this.animate()
  }

  dispose() {
    this.unbindEvents()
    cancelAnimationFrame(this.animationId)
    this.controls.dispose()
    this.meshes.forEach((mesh) => mesh.geometry.dispose())
    this.renderer.dispose()
    this.container.removeChild(this.renderer.domElement)
  }

  private bindEvents() {
    this.renderer.domElement.addEventListener('mousemove', this.handlePointerMove)
    this.renderer.domElement.addEventListener('mouseleave', this.handlePointerLeave)
    this.renderer.domElement.addEventListener('click', this.handleClick)
    this.controls.addEventListener('change', this.handleControlsChange)

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize()
    })
    this.resizeObserver.observe(this.container)
  }

  private unbindEvents() {
    this.renderer.domElement.removeEventListener('mousemove', this.handlePointerMove)
    this.renderer.domElement.removeEventListener('mouseleave', this.handlePointerLeave)
    this.renderer.domElement.removeEventListener('click', this.handleClick)
    this.controls.removeEventListener('change', this.handleControlsChange)
    this.resizeObserver?.disconnect()
  }

  private handleResize() {
    const { width, height } = this.container.getBoundingClientRect()
    this.camera.aspect = width / Math.max(height, 1)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  private handlePointerMove = (event: MouseEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.hasPointer = true
    this.updateHoverFromRaycast()
  }

  private handlePointerLeave = () => {
    this.hasPointer = false
    if (this.hovered) {
      this.setHover(this.hovered, false)
      this.hovered = null
    }
    if (this.hoveredGroup) {
      this.hoveredGroup = null
      this.onClear?.()
    }
  }

  private handleClick = () => {
    if (!this.hovered) return
    const group = this.hovered.userData.stateGroup as StateGroup | undefined
    if (!group) return
    const name = String(group.userData.name || '')
    const sigla = String(group.userData.sigla || '')
    const value = Number(group.userData.value || 0)
    if (!name || !sigla) return
    this.onSelect({ name, sigla, value })
  }

  private setHover(mesh: StateMesh | null, active: boolean) {
    if (!mesh) return
    const group = mesh.userData.stateGroup as StateGroup | undefined
    if (!group) return
    group.userData.targetZ = active ? group.userData.baseZ + 1.2 : group.userData.baseZ
    group.userData.targetColor = active ? group.userData.hoverColor : group.userData.baseColor
    if (active && this.hoveredGroup !== group) {
      this.hoveredGroup = group
      this.onHover?.({
        name: group.userData.name,
        sigla: group.userData.sigla,
        value: group.userData.value,
      })
    }
    if (!active && this.hoveredGroup === group) {
      this.hoveredGroup = null
      this.onClear?.()
    }
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate)

    this.stateGroups.forEach((group) => {
      const targetZ = group.userData.targetZ ?? group.userData.baseZ
      group.position.z += (targetZ - group.position.z) * 0.12

      const targetColor = group.userData.targetColor as THREE.Color
      group.children.forEach((child) => {
        if (!(child instanceof THREE.Mesh)) return
        const mesh = child as StateMesh
        mesh.material.color.lerp(targetColor, 0.12)
      })
    })

    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  private loadGeoJson(data: GeoJson) {
    const group = new THREE.Group()
    const baseColor = new THREE.Color('#fcfcfd')
    const hoverColor = new THREE.Color('#f1f3f6')
    const borderColor = new THREE.Color('#6b6b6b')
    const hoverInset = 0.2
    const expandStates = new Set(['DF'])

    data.features.forEach((feature) => {
      const sigla = feature.properties?.sigla || ''
      const value = this.valueByUf[sigla] ?? this.valueFromSigla(sigla)
      const shapes = this.featureToShapes(feature)
      const stateGroup = new THREE.Group() as StateGroup
      stateGroup.userData = {
        name: feature.properties?.nome || '',
        sigla,
        baseZ: 0,
        targetZ: 0,
        baseColor,
        hoverColor,
        targetColor: baseColor,
        value,
      }

      shapes.forEach((shape) => {
        const geometry = new THREE.ShapeGeometry(shape)
        const material = new THREE.MeshStandardMaterial({
          color: baseColor,
          roughness: 0.85,
          metalness: 0.02,
          side: THREE.DoubleSide,
        })
        const mesh = new THREE.Mesh(geometry, material) as StateMesh
        mesh.userData.stateGroup = stateGroup
        stateGroup.add(mesh)
        const border = this.createBorder(shape, borderColor)
        border.position.z = 0.2
        mesh.add(border)

      })

      group.add(stateGroup)
      this.stateGroups.push(stateGroup)

      if (shapes.length) {
        const centroid = this.featureCentroid(feature)
        const inset = expandStates.has(sigla) ? -0.2 : hoverInset
        const hitMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#1d4ed8'),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: false,
        })
        shapes.forEach((shape) => {
          const points = shape.extractPoints(0)
          const insetOuter = this.insetPath(points.shape, centroid, inset)
          const hitShape = new THREE.Shape(insetOuter)
          points.holes.forEach((hole) => {
            const insetHole = this.insetPath(hole, centroid, inset)
            hitShape.holes.push(new THREE.Path(insetHole))
          })
          const hitGeometry = new THREE.ShapeGeometry(hitShape)
          const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial) as StateMesh
          hitMesh.position.z = 0.3
          hitMesh.userData.stateGroup = stateGroup
          stateGroup.add(hitMesh)
          this.meshes.push(hitMesh)
        })
      }
    })

    const box = new THREE.Box3().setFromObject(group)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y)
    const scale = 170 / Math.max(maxDim, 1)
    group.scale.setScalar(scale)

    const scaledBox = new THREE.Box3().setFromObject(group)
    const scaledCenter = new THREE.Vector3()
    scaledBox.getCenter(scaledCenter)
    group.position.x = -scaledCenter.x
    group.position.y = -scaledCenter.y
    group.position.z = 0

    this.scene.add(group)
    this.controls.target.set(0, 0, 0)
    this.controls.update()

    const bounds = new THREE.Box3().setFromObject(group)
    bounds.expandByScalar(6)
    this.mapBounds = bounds
  }

  private featureToShapes(feature: GeoJsonFeature) {
    if (feature.geometry.type === 'Polygon') {
      return this.polygonToShapes(feature.geometry.coordinates as number[][][])
    }
    const multi = feature.geometry.coordinates as number[][][][]
    return multi.flatMap((coords) => this.polygonToShapes(coords))
  }

  private polygonToShapes(rings: number[][][]) {
    if (!rings.length) return []
    const [outer, ...holes] = rings
    const shape = new THREE.Shape(this.ringToVector2(outer))
    holes.forEach((hole) => {
      const path = new THREE.Path(this.ringToVector2(hole))
      shape.holes.push(path)
    })
    return [shape]
  }

  private ringToVector2(coords: number[][]) {
    return coords.map(([lon, lat]) => new THREE.Vector2(lon, lat))
  }

  private insetPath(points: THREE.Vector2[], centroid: THREE.Vector2, inset: number) {
    return points.map((point) => {
      const dir = new THREE.Vector2().subVectors(point, centroid)
      const length = dir.length()
      if (length === 0) return point.clone()
      const insetDistance = Math.min(inset, Math.max(length - 0.001, 0))
      return point.clone().add(dir.normalize().multiplyScalar(-insetDistance))
    })
  }

  private createBorder(shape: THREE.Shape, color: THREE.Color) {
    const points = shape.getPoints()
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
    const line = new THREE.LineLoop(geometry, material)
    line.renderOrder = 3
    material.depthTest = false
    return line
  }

  private featureCentroid(feature: GeoJsonFeature) {
    const polygons =
      feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates as number[][][]]
        : (feature.geometry.coordinates as number[][][][])
    let totalArea = 0
    let cx = 0
    let cy = 0
    polygons.forEach((rings) => {
      if (!rings[0]) return
      const area = this.ringArea(rings[0])
      const centroid = this.ringCentroid(rings[0])
      totalArea += area
      cx += centroid.x * area
      cy += centroid.y * area
    })
    if (!totalArea) return new THREE.Vector2(0, 0)
    return new THREE.Vector2(cx / totalArea, cy / totalArea)
  }

  private ringArea(ring: number[][]) {
    let area = 0
    for (let i = 0; i < ring.length - 1; i += 1) {
      const [x1, y1] = ring[i]
      const [x2, y2] = ring[i + 1]
      area += x1 * y2 - x2 * y1
    }
    return Math.abs(area) / 2
  }

  private ringCentroid(ring: number[][]) {
    let area = 0
    let cx = 0
    let cy = 0
    for (let i = 0; i < ring.length - 1; i += 1) {
      const [x1, y1] = ring[i]
      const [x2, y2] = ring[i + 1]
      const cross = x1 * y2 - x2 * y1
      area += cross
      cx += (x1 + x2) * cross
      cy += (y1 + y2) * cross
    }
    area *= 0.5
    if (area === 0) return new THREE.Vector2(ring[0][0], ring[0][1])
    return new THREE.Vector2(cx / (6 * area), cy / (6 * area))
  }

  private valueFromSigla(sigla: string) {
    let hash = 0
    for (let i = 0; i < sigla.length; i += 1) {
      hash = (hash * 31 + sigla.charCodeAt(i)) % 997
    }
    return 80 + (hash % 160)
  }

  private limitRotation() {
    const polar = this.controls.getPolarAngle()
    const azimuth = this.controls.getAzimuthalAngle()
    const polarDelta = 0.25
    const azimuthDelta = 0.35
    this.controls.minPolarAngle = Math.max(0.2, polar - polarDelta)
    this.controls.maxPolarAngle = Math.min(Math.PI - 0.2, polar + polarDelta)
    this.controls.minAzimuthAngle = azimuth - azimuthDelta
    this.controls.maxAzimuthAngle = azimuth + azimuthDelta
  }

  private handleControlsChange = () => {
    if (!this.mapBounds) return
    const target = this.controls.target
    const clampedX = THREE.MathUtils.clamp(target.x, this.mapBounds.min.x, this.mapBounds.max.x)
    const clampedY = THREE.MathUtils.clamp(target.y, this.mapBounds.min.y, this.mapBounds.max.y)
    if (clampedX === target.x && clampedY === target.y) return
    const deltaX = clampedX - target.x
    const deltaY = clampedY - target.y
    target.x = clampedX
    target.y = clampedY
    this.camera.position.x += deltaX
    this.camera.position.y += deltaY
    if (this.hasPointer) {
      this.updateHoverFromRaycast()
    }
  }

  private updateHoverFromRaycast() {
    this.raycaster.setFromCamera(this.mouse, this.camera)
    const hits = this.raycaster.intersectObjects(this.meshes)
    const hit = hits[0]?.object as StateMesh | undefined

    if (hit && hit !== this.hovered) {
      this.setHover(this.hovered, false)
      this.hovered = hit
      this.setHover(this.hovered, true)
      return
    }

    if (!hit && this.hovered) {
      this.setHover(this.hovered, false)
      this.hovered = null
    }
  }

}
