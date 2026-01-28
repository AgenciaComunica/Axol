<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Loader } from '@googlemaps/js-api-loader'

type LatLng = { lat: number; lng: number }
type MapMarker = { id: string; position: LatLng; label?: string }

const props = defineProps<{
  center: LatLng
  zoom: number
  markers?: MapMarker[]
}>()

const emit = defineEmits<{
  (e: 'update:center', center: LatLng): void
  (e: 'update:zoom', zoom: number): void
  (e: 'markerClick', id: string): void
  (e: 'ready', googleMaps: typeof google): void
}>()

const mapRef = ref<HTMLDivElement | null>(null)
let map: any = null
let markers: any[] = []
let idleListener: any = null

function clearMarkers() {
  markers.forEach((marker) => marker.setMap(null))
  markers = []
}

function syncMarkers() {
  if (!map) return
  clearMarkers()
  if (!props.markers?.length) return
  const googleMaps = (window as any).google?.maps
  if (!googleMaps) return
  markers = props.markers.map((marker) => {
    const instance = new googleMaps.Marker({
      map,
      position: marker.position,
      label: marker.label,
      clickable: true,
    })
    instance.addListener('click', () => emit('markerClick', marker.id))
    return instance
  })
}

async function initMap() {
  if (!mapRef.value) return
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) return
  const loader = new Loader({ apiKey, version: 'weekly', libraries: ['places'] })
  const googleMaps = await loader.load()
  if (!(window as any).google) {
    ;(window as any).google = googleMaps
  }
  map = new googleMaps.maps.Map(mapRef.value, {
    center: props.center,
    zoom: props.zoom,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    clickableIcons: false,
    gestureHandling: 'greedy',
  })
  ;(window as any).__gm_map = map
  emit('ready', googleMaps)
  idleListener = map.addListener('idle', () => {
    const center = map.getCenter()
    if (center) {
      emit('update:center', { lat: center.lat(), lng: center.lng() })
    }
    emit('update:zoom', map.getZoom() || props.zoom)
  })
  syncMarkers()
}

onMounted(() => {
  initMap()
})

onBeforeUnmount(() => {
  if (idleListener) idleListener.remove()
  clearMarkers()
  map = null
})

watch(
  () => props.center,
  (next) => {
    if (!map) return
    const current = map.getCenter()
    if (!current) return
    const deltaLat = Math.abs(current.lat() - next.lat)
    const deltaLng = Math.abs(current.lng() - next.lng)
    if (deltaLat > 1e-6 || deltaLng > 1e-6) {
      map.setCenter(next)
    }
  }
)

watch(
  () => props.zoom,
  (next) => {
    if (!map) return
    const current = map.getZoom()
    if (typeof current === 'number' && current !== next) {
      map.setZoom(next)
    }
  }
)

watch(
  () => props.markers,
  () => {
    syncMarkers()
  },
  { deep: true }
)
</script>

<template>
  <div class="google-map" ref="mapRef"></div>
</template>

<style scoped>
.google-map{
  width: 100%;
  height: 100%;
}
</style>
