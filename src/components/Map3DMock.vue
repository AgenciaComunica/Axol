<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { BrazilMap3D, type StateSelect, type TransformerInfo } from '@/lib/BrazilMap3D'

type MapItem = { id: string; name: string; qty: number; sigla?: string }

const props = defineProps<{
  level: string
  items: unknown[]
  title: string
  valuesByUf: Record<string, number>
  dataset: 'br' | 'mg'
  munCode?: string | null
  munFile?: string | null
}>()

const emit = defineEmits<{
  (e: 'select', item: MapItem): void
  (e: 'hover', payload: StateSelect | null): void
  (e: 'background'): void
  (e: 'move', payload: { x: number; y: number }): void
  (e: 'marker', payload: StateSelect): void
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
    const isMobile = window.matchMedia('(max-width: 900px)').matches
    if (props.munCode) {
      mapInstance.fitToView(1.1)
      mapInstance.setZoomLimits(isMobile ? 8 : 20, isMobile ? 200 : 180)
    } else {
      mapInstance.fitToView(1.35)
      if (props.dataset === 'mg') {
        mapInstance.setZoomLimits(isMobile ? 30 : 50, isMobile ? 240 : 220)
      } else if (isMobile) {
        mapInstance.setZoomLimits(24, 260)
      }
    }
    if (props.munCode === '3106200') {
      const bounds = geojsonBounds(geojson)
      if (bounds) {
        const iconUrl = new URL('../assets/img/transformer_8265902.svg', import.meta.url).toString()
        const maxDim = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)
        const size = Math.min(0.06, Math.max(0.004, maxDim * 0.001))
        const posA = {
          x: bounds.minX + (bounds.maxX - bounds.minX) * 0.32,
          y: bounds.minY + (bounds.maxY - bounds.minY) * 0.58,
        }
        const posB = {
          x: bounds.minX + (bounds.maxX - bounds.minX) * 0.68,
          y: bounds.minY + (bounds.maxY - bounds.minY) * 0.42,
        }
        const single = createTransformer(
          'TR-0001',
          'Operacional',
          '18 MVA',
          '138 kV',
          'Adequado',
          'R. Monte Líbano, 121 - Padre Eustáquio, Belo Horizonte - MG, 30730-450'
        )
        const cluster = [
          createTransformer(
            'TR-0002',
            'Operacional',
            '12 MVA',
            '69 kV',
            'Adequado',
            'Praça Bagatelle, 204 - Aeroporto, Belo Horizonte - MG, 31270-705'
          ),
          createTransformer(
            'TR-0003',
            'Manutencao',
            '22 MVA',
            '138 kV',
            'Reclassificacao',
            'Praça Bagatelle, 204 - Aeroporto, Belo Horizonte - MG, 31270-705'
          ),
        ]
        mapInstance.setMarkers(
          [
            {
              id: 'BH',
              name: 'Transformadores',
              value: cluster.length,
              x: posA.x,
              y: posA.y,
              transformers: cluster,
            },
            {
              id: 'TR-0001',
              name: 'Transformador',
              value: 1,
              x: posB.x,
              y: posB.y,
              transformers: [single],
            },
          ],
          { color: '#2a364d', size, iconUrl }
        )
      }
    }
  } catch {
    // Keep canvas empty if GeoJSON fails to load.
  }
}

function handleSelect(payload: StateSelect) {
  if (payload.transformers?.length) {
    emit('marker', payload)
    return
  }
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

function createTransformer(
  id: string,
  status: string,
  power: string,
  voltage: string,
  oil: string,
  location: string
): TransformerInfo {
  return { id, status, power, voltage, oil, location }
}

function geojsonBounds(geojson: any) {
  const features = geojson?.features || []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const pushCoord = (coord: number[]) => {
    if (coord.length < 2) return
    const [x, y] = coord
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  const walk = (coords: any) => {
    if (!coords) return
    if (typeof coords[0] === 'number') {
      pushCoord(coords)
      return
    }
    for (const item of coords) walk(item)
  }
  features.forEach((feature: any) => walk(feature?.geometry?.coordinates))
  if (!isFinite(minX) || !isFinite(minY)) return null
  return { minX, minY, maxX, maxY }
}

onMounted(() => {
  loadMap()
})

watch(
  () => [props.dataset, props.munCode, props.munFile],
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
  .map{ height: 340px; }
}

@media (min-width: 901px){
  .map{
    width: 100vw;
    height: 100vh;
  }
}
</style>
