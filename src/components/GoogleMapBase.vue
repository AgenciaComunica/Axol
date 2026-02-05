<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Loader } from '@googlemaps/js-api-loader'
import { MarkerClusterer } from '@googlemaps/markerclusterer'

type LatLng = { lat: number; lng: number }
type MapMarker = { id: string; position: LatLng; label?: string }

declare const google: any

const transformerIconUrl = new URL('@/assets/power-transformer_1.svg', import.meta.url).toString()
const pinSvg = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <path fill="#1e4e8b" d="M20 2c-7.2 0-13 5.8-13 13 0 9.2 11 22 12.1 23.3.5.6 1.3.6 1.8 0C22 37 33 24.2 33 15 33 7.8 27.2 2 20 2z"/>
  </svg>`
)
const pinIconUrl = `data:image/svg+xml;utf8,${pinSvg}`

function createMarkerContent(onEnter: (event: MouseEvent) => void, onLeave: () => void) {
  const wrapper = document.createElement('div')
  wrapper.style.position = 'relative'
  wrapper.style.width = '34px'
  wrapper.style.height = '34px'

  const pin = document.createElement('div')
  pin.style.width = '34px'
  pin.style.height = '34px'
  pin.style.backgroundImage = `url('${pinIconUrl}')`
  pin.style.backgroundRepeat = 'no-repeat'
  pin.style.backgroundSize = 'contain'
  pin.style.backgroundPosition = 'center'
  pin.style.position = 'absolute'
  pin.style.left = '0'
  pin.style.top = '0'

  const icon = document.createElement('img')
  icon.src = transformerIconUrl
  icon.alt = ''
  icon.style.width = '16px'
  icon.style.height = '16px'
  icon.style.position = 'absolute'
  icon.style.left = '50%'
  icon.style.top = '38%'
  icon.style.transform = 'translate(-50%, -50%)'
  icon.style.filter = 'brightness(0) invert(1)'

  wrapper.appendChild(pin)
  wrapper.appendChild(icon)
  wrapper.addEventListener('mouseenter', onEnter)
  wrapper.addEventListener('mouseleave', onLeave)
  return wrapper
}

function createClusterContent(count: number) {
  const wrapper = document.createElement('div')
  wrapper.style.position = 'relative'
  wrapper.style.width = '34px'
  wrapper.style.height = '34px'
  wrapper.style.backgroundImage = `url('${pinIconUrl}')`
  wrapper.style.backgroundRepeat = 'no-repeat'
  wrapper.style.backgroundSize = 'contain'
  wrapper.style.backgroundPosition = 'center'
  wrapper.style.display = 'grid'
  wrapper.style.placeItems = 'center'
  wrapper.style.color = '#ffffff'
  wrapper.style.fontSize = '12px'
  wrapper.style.fontWeight = '700'
  wrapper.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.35)'
  wrapper.textContent = String(count)
  return wrapper
}
const props = defineProps<{
  center: LatLng
  zoom: number
  markers?: MapMarker[]
}>()

const emit = defineEmits<{
  (e: 'update:center', center: LatLng): void
  (e: 'update:zoom', zoom: number): void
  (e: 'update:bounds', bounds: { north: number; south: number; east: number; west: number } | null): void
  (e: 'markerClick', id: string): void
  (e: 'markerHover', payload: { id: string; clientX: number; clientY: number }): void
  (e: 'markerLeave', id: string): void
  (e: 'interaction'): void
  (e: 'ready', googleMaps: typeof google): void
}>()

const mapRef = ref<HTMLDivElement | null>(null)
let map: any = null
let markers: any[] = []
let clusterer: MarkerClusterer | null = null
let idleListener: any = null
let zoomListener: any = null
let dragListener: any = null
let projectionOverlay: any = null

function clearMarkers() {
  markers.forEach((marker) => marker.setMap(null))
  markers = []
  if (clusterer) {
    clusterer.clearMarkers()
    clusterer = null
  }
}

function getClientPosition(lat: number, lng: number) {
  if (!projectionOverlay || !mapRef.value) return null
  const projection = projectionOverlay.getProjection?.()
  if (!projection) return null
  const point = projection.fromLatLngToDivPixel(new (window as any).google.maps.LatLng(lat, lng))
  if (!point) return null
  const rect = mapRef.value.getBoundingClientRect()
  return { clientX: rect.left + point.x, clientY: rect.top + point.y }
}

function handleHover(marker: MapMarker, event?: any) {
  const domEvent = event?.domEvent
  if (domEvent?.clientX !== undefined && domEvent?.clientY !== undefined) {
    emit('markerHover', { id: marker.id, clientX: domEvent.clientX, clientY: domEvent.clientY })
    return
  }
  const fallback = getClientPosition(marker.position.lat, marker.position.lng)
  if (fallback) {
    emit('markerHover', { id: marker.id, clientX: fallback.clientX, clientY: fallback.clientY })
  }
}

function syncMarkers() {
  if (!map) return
  clearMarkers()
  if (!props.markers?.length) return
  const googleMaps = (window as any).google?.maps
  if (!googleMaps) return
  const mapId = import.meta.env.VITE_GOOGLE_MAP_ID
  markers = props.markers.map((marker) => {
    if (mapId && googleMaps.marker?.AdvancedMarkerElement) {
      const instance = new googleMaps.marker.AdvancedMarkerElement({
        map,
        position: marker.position,
        content: createMarkerContent(
          (event) => handleHover(marker, event),
          () => emit('markerLeave', marker.id)
        ),
      })
      instance.addListener('gmp-click', () => emit('markerClick', marker.id))
      return instance
    }
    const instance = new googleMaps.Marker({
      map,
      position: marker.position,
      icon: {
        url: pinIconUrl,
        scaledSize: new googleMaps.Size(34, 34),
      },
      clickable: true,
    })
    instance.addListener('click', () => emit('markerClick', marker.id))
    instance.addListener('mouseover', (event: any) => handleHover(marker, event))
    instance.addListener('mouseout', () => emit('markerLeave', marker.id))
    return instance
  })
  clusterer = new MarkerClusterer({
    map,
    markers,
    onClusterClick: (_event, cluster, mapInstance) => {
      const bounds = cluster.bounds
      if (!bounds) return
      const div = mapRef.value
      if (div) {
        const paddingX = Math.round(div.clientWidth * 0.2)
        const paddingY = Math.round(div.clientHeight * 0.2)
        mapInstance.fitBounds(bounds, {
          left: paddingX,
          right: paddingX,
          top: paddingY,
          bottom: paddingY,
        })
      } else {
        mapInstance.fitBounds(bounds, { top: 100, right: 100, bottom: 100, left: 100 })
      }
    },
    renderer: {
      render({ count, position }) {
        if (googleMaps.marker?.AdvancedMarkerElement) {
          return new googleMaps.marker.AdvancedMarkerElement({
            position,
            content: createClusterContent(count),
          })
        }
        return new googleMaps.Marker({
          position,
          icon: {
            url: pinIconUrl,
            scaledSize: new googleMaps.Size(34, 34),
          },
          label: {
            text: String(count),
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: '700',
          },
        })
      },
    },
  })
}

async function initMap() {
  if (!mapRef.value) return
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) return
  const loader = new Loader({ apiKey, version: 'weekly', libraries: ['places', 'marker', 'geometry'] })
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
    ...(import.meta.env.VITE_GOOGLE_MAP_ID
      ? { mapId: import.meta.env.VITE_GOOGLE_MAP_ID }
      : {}),
  })
  projectionOverlay = new googleMaps.maps.OverlayView()
  projectionOverlay.onAdd = () => {}
  projectionOverlay.draw = () => {}
  projectionOverlay.onRemove = () => {}
  projectionOverlay.setMap(map)
  ;(window as any).__gm_map = map
  emit('ready', googleMaps)
  idleListener = map.addListener('idle', () => {
    const center = map.getCenter()
    if (center) {
      emit('update:center', { lat: center.lat(), lng: center.lng() })
    }
    emit('update:zoom', map.getZoom() || props.zoom)
    const bounds = map.getBounds()
    if (!bounds) {
      emit('update:bounds', null)
    } else {
      const ne = bounds.getNorthEast()
      const sw = bounds.getSouthWest()
      emit('update:bounds', { north: ne.lat(), east: ne.lng(), south: sw.lat(), west: sw.lng() })
    }
  })
  zoomListener = map.addListener('zoom_changed', () => emit('interaction'))
  dragListener = map.addListener('dragstart', () => emit('interaction'))
  syncMarkers()
}

onMounted(() => {
  initMap()
})

onBeforeUnmount(() => {
  if (idleListener) idleListener.remove()
  if (zoomListener) zoomListener.remove()
  if (dragListener) dragListener.remove()
  clearMarkers()
  map = null
  projectionOverlay = null
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
