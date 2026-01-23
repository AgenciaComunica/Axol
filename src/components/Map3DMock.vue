<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { BrazilMap3D, type StateSelect } from '@/lib/BrazilMap3D'

type MapItem = { id: string; name: string; qty: number; sigla?: string }

const props = defineProps<{
  level: string
  items: unknown[]
  title: string
  valuesByUf: Record<string, number>
  dataset: 'br' | 'mg'
  munCode?: string | null
  munFile?: string | null
  transformersCount?: number | null
}>()

const emit = defineEmits<{
  (e: 'select', item: MapItem): void
  (e: 'hover', payload: StateSelect | null): void
  (e: 'background'): void
  (e: 'move', payload: { x: number; y: number }): void
}>()
const containerRef = ref<HTMLDivElement | null>(null)
const lastHover = ref<StateSelect | null>(null)
let mapInstance: BrazilMap3D | null = null

async function loadMap() {
  if (!containerRef.value) return
  mapInstance?.dispose()
  mapInstance = null
  const url =
    props.dataset === 'mg' && props.munFile
      ? new URL(`../assets/cities/setores-mg/${props.munFile}`, import.meta.url)
      : props.dataset === 'mg'
        ? new URL('../assets/states/MG_Municipios_2024.geojson', import.meta.url)
        : new URL('../assets/country/brasil-estados.geojson', import.meta.url)
  try {
    const response = await fetch(url)
    const raw = await response.json()
    const geojson =
      props.dataset === 'mg'
        ? {
            ...raw,
            features: (raw.features || []).map((feature: any) => ({
              ...feature,
              properties: {
                ...feature.properties,
                nome: feature.properties?.NM_MUN || feature.properties?.nome || '',
                sigla: feature.properties?.CD_MUN || feature.properties?.sigla || '',
              },
            })),
          }
        : raw
    if (!containerRef.value) return
    const options =
      props.dataset === 'mg' && props.munCode
        ? { hoverInset: 0.001, hoverLift: 0, hitboxOpacity: 0, hoverPolygonsEnabled: false }
        : props.dataset === 'mg'
          ? { hoverInset: 0.001, hoverLift: 0.25, hitboxOpacity: 0.45 }
          : { hoverInset: 0.001, hoverLift: 1.2, hitboxOpacity: 0 }
    mapInstance = new BrazilMap3D(
      containerRef.value,
      geojson as any,
      handleSelect,
      handleHover,
      handleClear,
      props.valuesByUf,
      options
    )
    if (props.munCode) {
      mapInstance.fitToView(1.1)
    }
    if (props.munCode && props.transformersCount) {
      const markers = buildSectorMarkers(geojson, props.transformersCount ?? null)
      mapInstance.setMarkers(markers, { color: '#2563eb', size: 1.1 })
    }
  } catch {
    // Keep canvas empty if GeoJSON fails to load.
  }
}

function buildSectorMarkers(geojson: any, total: number | null) {
  const features = geojson?.features || []
  const markers = []
  for (let i = 0; i < features.length; i += 1) {
    const feature = features[i]
    const centroid = geometryCentroid(feature?.geometry)
    if (!centroid) continue
    const count = 1 + (i % 3)
    markers.push({
      id: `TR-${String(i + 1).padStart(4, '0')}`,
      name: `Transformador ${String(i + 1).padStart(4, '0')}`,
      value: count,
      x: centroid.x,
      y: centroid.y,
    })
    if (typeof total === 'number' && total > 0 && markers.length >= total) break
  }
  return markers
}

function geometryCentroid(geometry: any) {
  if (!geometry) return null
  const type = geometry.type
  const coords = geometry.coordinates
  if (type === 'Polygon') return polygonCentroid(coords?.[0])
  if (type === 'MultiPolygon') {
    let totalArea = 0
    let cx = 0
    let cy = 0
    for (const polygon of coords || []) {
      const ring = polygon?.[0]
      const centroid = polygonCentroid(ring)
      const area = polygonArea(ring)
      if (!centroid) continue
      totalArea += area
      cx += centroid.x * area
      cy += centroid.y * area
    }
    if (!totalArea) return null
    return { x: cx / totalArea, y: cy / totalArea }
  }
  return null
}

function polygonArea(ring: number[][]) {
  if (!ring || ring.length < 3) return 0
  let area = 0
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[i + 1]
    area += x1 * y2 - x2 * y1
  }
  return Math.abs(area) / 2
}

function polygonCentroid(ring: number[][]) {
  if (!ring || ring.length < 3) return null
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
  if (area === 0) return { x: ring[0][0], y: ring[0][1] }
  return { x: cx / (6 * area), y: cy / (6 * area) }
}

function handleSelect(payload: StateSelect) {
  emit('select', { id: payload.sigla, name: payload.name, qty: payload.value, sigla: payload.sigla })
}

function handleHover(payload: StateSelect) {
  lastHover.value = payload
  emit('hover', payload)
}

function handleClear() {
  lastHover.value = null
  emit('hover', null)
}

function handleBackgroundClick() {
  if (lastHover.value) return
  emit('background')
}

function handleMouseMove(event: MouseEvent) {
  emit('move', { x: event.clientX, y: event.clientY })
}

onMounted(() => {
  loadMap()
})

watch(
  () => [props.dataset, props.munCode, props.transformersCount],
  () => {
    loadMap()
  }
)

onBeforeUnmount(() => {
  mapInstance?.dispose()
  mapInstance = null
})
</script>

<template>
  <div class="map" @click="handleBackgroundClick" @mousemove="handleMouseMove">
    <div ref="containerRef" class="map-canvas" aria-label="Mapa 3D do Brasil"></div>
  </div>
</template>

<style scoped>
.map{
  position: relative;
  width: 100%;
  height: 520px;
  display: grid;
  place-items: center;
  overflow: hidden;
  z-index: 1;
}

.map-canvas{
  width: 100%;
  height: 100%;
}

@media (max-width: 900px){
  .map{ height: 420px; }
}
</style>
