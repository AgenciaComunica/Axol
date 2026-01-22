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
    props.dataset === 'mg'
      ? new URL('../assets/states/MG_Municipios_2024.geojson', import.meta.url)
      : new URL('../assets/brasil-estados.geojson', import.meta.url)
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
      props.dataset === 'mg'
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
  } catch {
    // Keep canvas empty if GeoJSON fails to load.
  }
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
  () => props.dataset,
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
