<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import SideMenu from '@/components/SideMenu.vue'
import GoogleMapBase from '@/components/GoogleMapBase.vue'
import KpiCard from '@/components/KpiCard.vue'
import { usePrototypeScopeStore, type MapItem } from '@/stores/prototypeScope'
type StateSelect = { name: string; sigla: string; value: number; transformers?: any[] }

const store = usePrototypeScopeStore()
const hoverInfo = ref<StateSelect | null>(null)
const pinnedInfo = ref<StateSelect | null>(null)
const pinnedItem = ref<MapItem | null>(null)
const hoverPos = ref({ x: 0, y: 0 })
const pinnedPos = ref<{ x: number; y: number } | null>(null)
const mapShellRef = ref<HTMLElement | null>(null)
const mapShellOffset = ref({ x: 0, y: 0 })
const mapCenter = ref({ lat: -14.235, lng: -51.925 })
const mapZoom = ref(4)
const transformerOptions = ref<
  {
    id: string
    serial?: string
    tag?: string
    substation?: string
    status: string
    analystStatus?: string
    analystNote?: string
    analyst?: string
    power: string
    voltage: string
    oil: string
    manufacturer?: string
    year?: string
    commutator?: string
    location: string
    lat?: number
    lng?: number
  }[]
>([])
const selectedTransformer = ref<
  {
    id: string
    serial?: string
    tag?: string
    substation?: string
    status: string
    analystStatus?: string
    analystNote?: string
    analyst?: string
    power: string
    voltage: string
    oil: string
    manufacturer?: string
    year?: string
    commutator?: string
    location: string
    lat?: number
    lng?: number
  } | null
>(null)
const transformerModalOpen = ref(false)
const viewerOpen = ref(false)
const viewerFrameRef = ref<HTMLIFrameElement | null>(null)
const viewerReady = ref(false)
const searchQuery = ref('')
const searchError = ref('')
const searchLoading = ref(false)
const searchInputRef = ref<HTMLInputElement | null>(null)
const mapInstance = ref<any | null>(null)
const googleMapsRef = ref<any | null>(null)
const mapsReady = ref(false)
const searchSuggestions = ref<any[]>([])
const searchSuggestOpen = ref(false)
const searchSuggestLoading = ref(false)
const searchSuggestSuppress = ref(false)
let searchSuggestTimer: number | null = null
let searchSuggestAbort: AbortController | null = null
const searchSuggestAllowedTypes = new Set([
  'country',
  'state',
  'city',
  'town',
  'municipality',
  'village',
  'suburb',
  'neighbourhood',
  'quarter',
  'road',
  'street',
  'residential',
  'living_street',
  'hamlet',
])
const highlightRect = ref<any | null>(null)
const transformerQuery = ref('')

const stateOptions: MapItem[] = [
  { id: 'AC', name: 'Acre', qty: 1 },
  { id: 'AL', name: 'Alagoas', qty: 1 },
  { id: 'AP', name: 'Amapa', qty: 1 },
  { id: 'AM', name: 'Amazonas', qty: 1 },
  { id: 'BA', name: 'Bahia', qty: 1 },
  { id: 'CE', name: 'Ceara', qty: 1 },
  { id: 'DF', name: 'Distrito Federal', qty: 1 },
  { id: 'ES', name: 'Espirito Santo', qty: 1 },
  { id: 'GO', name: 'Goias', qty: 1 },
  { id: 'MA', name: 'Maranhao', qty: 1 },
  { id: 'MT', name: 'Mato Grosso', qty: 1 },
  { id: 'MS', name: 'Mato Grosso do Sul', qty: 1 },
  { id: 'MG', name: 'Minas Gerais', qty: 1 },
  { id: 'PA', name: 'Para', qty: 1 },
  { id: 'PB', name: 'Paraiba', qty: 1 },
  { id: 'PR', name: 'Parana', qty: 1 },
  { id: 'PE', name: 'Pernambuco', qty: 1 },
  { id: 'PI', name: 'Piaui', qty: 1 },
  { id: 'RJ', name: 'Rio de Janeiro', qty: 1 },
  { id: 'RN', name: 'Rio Grande do Norte', qty: 1 },
  { id: 'RS', name: 'Rio Grande do Sul', qty: 1 },
  { id: 'RO', name: 'Rondonia', qty: 1 },
  { id: 'RR', name: 'Roraima', qty: 1 },
  { id: 'SC', name: 'Santa Catarina', qty: 1 },
  { id: 'SP', name: 'Sao Paulo', qty: 1 },
  { id: 'SE', name: 'Sergipe', qty: 1 },
  { id: 'TO', name: 'Tocantins', qty: 1 },
]

const kpis = computed(() => store.getKpisForScope())
const stateNode = computed(() => store.path.find((node) => node.level === 'estado') || null)
const cityNode = computed(() => store.path.find((node) => node.level === 'cidade') || null)
const filteredTransformers = computed(() => {
  const q = transformerQuery.value.trim().toLowerCase()
  if (!q) return transformerOptions.value
  return transformerOptions.value.filter((item) => item.id.toLowerCase().includes(q))
})
const mapFocusByState: Record<string, { center: { lat: number; lng: number }; zoom: number }> = {
  MG: { center: { lat: -18.9, lng: -44.0 }, zoom: 6 },
  SP: { center: { lat: -23.55, lng: -46.64 }, zoom: 6 },
  RJ: { center: { lat: -22.9, lng: -43.2 }, zoom: 7 },
  ES: { center: { lat: -19.2, lng: -40.2 }, zoom: 7 },
}
const mapFocusByCity: Record<string, { center: { lat: number; lng: number }; zoom: number }> = {
  BH: { center: { lat: -19.912998, lng: -43.940933 }, zoom: 11 },
}
const transformerMarkers = computed(() =>
  transformerOptions.value
    .filter((item) => typeof item.lat === 'number' && typeof item.lng === 'number')
    .map((item) => ({
      id: item.id,
      position: { lat: item.lat as number, lng: item.lng as number },
    }))
)

function handleSelect(item: MapItem) {
  pinnedInfo.value = { name: item.name, sigla: item.sigla || '', value: item.qty }
  pinnedItem.value = item
  pinnedPos.value = { ...hoverPos.value }
}

function handleMarker(payload: StateSelect) {
  pinnedInfo.value = payload
  pinnedItem.value = null
  pinnedPos.value = { ...hoverPos.value }
}

function handleHover(payload: StateSelect | null) {
  hoverInfo.value = payload
}

function handleMarkerHover(payload: { id: string; clientX: number; clientY: number }) {
  const transformer = transformerOptions.value.find((item) => item.id === payload.id)
  if (!transformer) return
  const rect = mapShellRef.value?.getBoundingClientRect()
  if (!rect) return
  const isLocal = payload.clientX <= rect.width && payload.clientY <= rect.height
  const clientX = isLocal ? rect.left + payload.clientX : payload.clientX
  const clientY = isLocal ? rect.top + payload.clientY : payload.clientY
  hoverPos.value = { x: clientX - rect.left, y: clientY - rect.top }
  mapShellOffset.value = { x: rect.left, y: rect.top }
  hoverInfo.value = {
    name: transformer.substation || transformer.location || transformer.id,
    sigla: transformer.id,
    value: 0,
    transformers: [transformer],
  }
  hoverPos.value = { x: payload.clientX - rect.left, y: payload.clientY - rect.top }
  mapShellOffset.value = { x: rect.left, y: rect.top }
}

function handleMarkerLeave(id: string) {
  const current = hoverInfo.value?.transformers?.[0]?.id
  if (current === id) {
    hoverInfo.value = null
  }
}

function handleBackground() {
  pinnedInfo.value = null
  pinnedItem.value = null
  pinnedPos.value = null
}

function handleCloseCard() {
  pinnedInfo.value = null
  pinnedItem.value = null
  pinnedPos.value = null
}

function openTransformerModal(transformer: {
  id: string
  serial?: string
  status: string
  power: string
  voltage: string
  oil: string
  location: string
  lat?: number
  lng?: number
}) {
  selectedTransformer.value = transformer
  transformerModalOpen.value = true
  pinnedInfo.value = null
  pinnedItem.value = null
  pinnedPos.value = null
}

function transformerMapsLink(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

function closeTransformerModal() {
  transformerModalOpen.value = false
  selectedTransformer.value = null
}

function handleSearch(override?: unknown) {
  const overrideQuery = typeof override === 'string' ? override : undefined
  searchSuggestSuppress.value = true
  clearSuggestions()
  const rawQuery = String(overrideQuery ?? searchQuery.value ?? '').trim()
  const normalized = rawQuery.toLowerCase()
  const queryParts = rawQuery.split(',').map((part) => part.trim()).filter(Boolean)
  const filteredParts = queryParts.filter(
    (part) => !/regi[aã]o/i.test(part) && !/brasil/i.test(part)
  )
  const baseQuery = (filteredParts[0] || queryParts[0] || rawQuery).trim()
  const statePrefix = normalized.startsWith('estado ')
    ? rawQuery.slice(7).trim()
    : normalized.startsWith('estado de ')
      ? rawQuery.slice(10).trim()
      : rawQuery
  const query = (normalized.startsWith('estado ') || normalized.startsWith('estado de '))
    ? statePrefix.trim()
    : baseQuery
  const normalizedQuery = query.toLowerCase()
  const isBrazilQuery =
    normalizedQuery === 'brasil' || normalizedQuery === 'brazil' || normalizedQuery === 'br'
  if (!query) return
  let googleMaps = googleMapsRef.value || (window as any).google?.maps
  if (!googleMaps?.Geocoder && (window as any).google?.maps?.Geocoder) {
    googleMaps = (window as any).google.maps
  }
  if (!googleMaps || !mapInstance.value) {
    searchError.value = 'Mapa indisponível. Recarregue a página.'
    return
  }
  console.info('[search] start', query)
  searchLoading.value = true
  searchError.value = ''
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('polygon_geojson', '1')
  if (isBrazilQuery) {
    url.searchParams.set('country', 'Brazil')
  } else if (normalized.startsWith('estado ')) {
    url.searchParams.set('state', query)
    url.searchParams.set('country', 'Brazil')
  } else if (normalized.startsWith('estado de ')) {
    url.searchParams.set('state', query)
    url.searchParams.set('country', 'Brazil')
  } else {
    url.searchParams.set('q', `${query}, Brazil`)
  }
  url.searchParams.set('limit', '1')
  url.searchParams.set('addressdetails', '1')
  fetch(url.toString(), { headers: { Accept: 'application/json' } })
    .then((res) => res.json())
    .then((results) => {
      searchLoading.value = false
      if (!Array.isArray(results) || results.length === 0) {
        searchError.value = 'Endereço não encontrado.'
        return
      }
      const allowedTypes = new Set([
        'state',
        'city',
        'town',
        'municipality',
        'village',
        'suburb',
        'neighbourhood',
        'quarter',
        'road',
        'street',
        'residential',
        'living_street',
        'hamlet',
      ])
      if (isBrazilQuery) {
        allowedTypes.add('country')
      }
      const result =
        results.find((item) =>
          allowedTypes.has(String(item?.addresstype || item?.type || '').toLowerCase())
        ) || results[0]
      const map = mapInstance.value
      map.data.forEach((feature: any) => map.data.remove(feature))
      if (result?.geojson) {
        const geojson = {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: {}, geometry: result.geojson }],
        }
        map.data.addGeoJson(geojson)
        map.data.setStyle({
          fillColor: '#f7cf29',
          fillOpacity: 0.1,
          strokeColor: '#f7cf29',
          strokeWeight: 2,
        })
        const bounds = new googleMaps.LatLngBounds()
        const extendCoords = (coords: any) => {
          if (!coords) return
          if (typeof coords[0] === 'number') {
            bounds.extend(new googleMaps.LatLng(coords[1], coords[0]))
            return
          }
          coords.forEach((c: any) => extendCoords(c))
        }
        extendCoords(result.geojson.coordinates)
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds)
        }
        return
      }

      const bbox = result?.boundingbox
      if (Array.isArray(bbox) && bbox.length === 4) {
        const bounds = new googleMaps.LatLngBounds(
          new googleMaps.LatLng(Number(bbox[0]), Number(bbox[2])),
          new googleMaps.LatLng(Number(bbox[1]), Number(bbox[3]))
        )
        map.fitBounds(bounds)
        searchError.value = ''
        return
      }

      searchError.value = 'Limites administrativos indisponíveis.'
    })
    .catch((err) => {
      searchLoading.value = false
      console.warn('[search] nominatim failed', err)
      searchError.value = 'Erro ao consultar limites.'
    })
}

function clearSuggestions() {
  searchSuggestions.value = []
  searchSuggestOpen.value = false
}

function handleSuggestSelect(suggestion: any) {
  searchSuggestSuppress.value = true
  const raw = searchQuery.value.trim()
  const normalized = raw.toLowerCase()
  if (normalized.startsWith('estado ') || normalized.startsWith('estado de ')) {
    handleSearch(raw)
  } else {
    searchQuery.value = suggestion.display_name || raw
    handleSearch(searchQuery.value)
  }
  clearSuggestions()
}

async function handleMapReady(googleMaps: any) {
  googleMapsRef.value = googleMaps
  mapsReady.value = true
  if (!(window as any).google) {
    ;(window as any).google = googleMaps
  }
  if (!(mapInstance.value) && (window as any).__gm_map) {
    mapInstance.value = (window as any).__gm_map
  }
}

function handleMove(payload: { x: number; y: number }) {
  const rect = mapShellRef.value?.getBoundingClientRect()
  if (!rect) return
  hoverPos.value = { x: payload.x - rect.left, y: payload.y - rect.top }
  mapShellOffset.value = { x: rect.left, y: rect.top }
}

function handleMapMarkerClick(id: string) {
  const match = transformerOptions.value.find((item) => item.id === id)
  if (!match) return
  openTransformerModal(match)
}

function highlightViewport(viewport: any, types: string[]) {
  const map = mapInstance.value
  const googleMaps = googleMapsRef.value
  if (!map || !googleMaps) return
  if (highlightRect.value) {
    highlightRect.value.setMap(null)
    highlightRect.value = null
  }
  const isCity = types.includes('locality') || types.includes('administrative_area_level_2')
  const stroke = '#f7cf29'
  highlightRect.value = new googleMaps.Rectangle({
    bounds: viewport,
    strokeColor: stroke,
    strokeOpacity: 0.9,
    strokeWeight: 2,
    fillColor: stroke,
    fillOpacity: isCity ? 0.08 : 0.04,
    map,
    clickable: false,
  })
}

function syncMapToBreadcrumb() {
  if (store.level === 'brasil') {
    mapCenter.value = { lat: -14.235, lng: -51.925 }
    mapZoom.value = 4
    return
  }
  if (store.level === 'estado' && stateNode.value?.id) {
    const focus = mapFocusByState[stateNode.value.id]
    if (focus) {
      mapCenter.value = focus.center
      mapZoom.value = focus.zoom
    }
    return
  }
  if (store.level === 'cidade' && cityNode.value?.id) {
    const focus = mapFocusByCity[cityNode.value.id]
    if (focus) {
      mapCenter.value = focus.center
      mapZoom.value = focus.zoom
    }
  }
}

const displayInfo = computed(() => pinnedInfo.value ?? hoverInfo.value)
const displayPos = computed(() =>
  pinnedInfo.value && pinnedPos.value ? pinnedPos.value : hoverPos.value
)
const mapHoverStyle = computed(() => {
  return {
    left: '50%',
    right: 'auto',
    top: 'auto',
    bottom: '32px',
    transform: 'translateX(-50%)',
  }
})

const viewerSrc = computed(() => {
  if (!selectedTransformer.value) return ''
  const params = new URLSearchParams()
  params.set('trafoId', selectedTransformer.value.id)
  if (selectedTransformer.value.lat && selectedTransformer.value.lng) {
    params.set('lat', String(selectedTransformer.value.lat))
    params.set('lng', String(selectedTransformer.value.lng))
  }
  params.set('munCode', '3106200')
  return `${import.meta.env.BASE_URL}viewer-3d?${params.toString()}`
})

function openViewer3D() {
  if (!selectedTransformer.value) return
  viewerOpen.value = true
  viewerReady.value = false
  transformerModalOpen.value = false
}

function closeViewer3D() {
  viewerOpen.value = false
  viewerReady.value = false
}

function sendViewerTrafo() {
  const frame = viewerFrameRef.value
  if (!frame?.contentWindow || !selectedTransformer.value) return
  frame.contentWindow.postMessage(
    {
      type: 'SET_TRAFO',
      payload: {
        id: selectedTransformer.value.id,
        lat: selectedTransformer.value.lat,
        lng: selectedTransformer.value.lng,
        munCode: '3106200',
      },
    },
    window.location.origin
  )
}

function handleViewerMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin) return
  const data = event.data
  if (!data || typeof data !== 'object') return
  if (data.type === 'READY') {
    viewerReady.value = true
    sendViewerTrafo()
  }
  if (data.type === 'CLOSE_VIEWER') {
    closeViewer3D()
  }
}

function handleExpand() {
  if (!pinnedItem.value) return
  if (store.level === 'brasil') {
    store.jumpToState(pinnedItem.value)
  } else {
    store.drillDown(pinnedItem.value)
  }
  pinnedInfo.value = null
  pinnedItem.value = null
  pinnedPos.value = null
}

function selectTransformer(transformer: {
  id: string
  status: string
  power: string
  voltage: string
  oil: string
  location: string
}) {
  pinnedInfo.value = {
    name: 'Transformador',
    sigla: transformer.id,
    value: 1,
    transformers: [transformer],
  }
  pinnedItem.value = null
  pinnedPos.value = { ...hoverPos.value }
}

function normalizeCoordinate(value?: string) {
  if (!value) return undefined
  const cleaned = value.replace(/[^0-9.-]/g, '')
  if (!cleaned) return undefined
  const parts = cleaned.split('.')
  if (parts.length > 2) {
    const first = parts.shift() || ''
    const last = parts.pop() || ''
    const middle = parts.join('')
    const merged = `${first}.${middle}${last}`
    const num = Number(merged)
    return Number.isFinite(num) ? num : undefined
  }
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : undefined
}
const displayTension = computed(() => {
  if (!displayInfo.value) return ''
  const base = 69 + (displayInfo.value.value % 4) * 23
  return `${base} kV`
})
const displayPower = computed(() => {
  if (!displayInfo.value) return ''
  const base = 8 + (displayInfo.value.value % 7)
  return `${base.toFixed(1)} MVA`
})

function goBrasil() {
  store.goToLevel(0)
}

function selectState(state: MapItem) {
  store.jumpToState(state)
}

function selectMunicipio(municipio: MapItem) {
  store.jumpToCity(municipio)
}

watch(
  () => [store.level, stateNode.value?.id, cityNode.value?.id],
  () => {
    syncMapToBreadcrumb()
  }
)

onMounted(async () => {
  transformerOptions.value = [
    {
      id: '9701-A01',
      serial: 'A01',
      tag: '9701',
      substation: 'SE VISCONDE DO RIO BRANCO',
      status: 'Normal',
      analystStatus: 'Alerta',
      analystNote: 'qwerqwerqwerwqeqwe\nqweqerqwreqweqwrewe',
      analyst: 'alex.fabiano@axol.eng.br',
      power: '43 MVA',
      voltage: '69 kV',
      oil: 'NAO IDENTIFICADO',
      manufacturer: 'TRAFO',
      year: '1993',
      commutator: 'SIM',
      location: 'SE VISCONDE DO RIO BRANCO',
      lat: normalizeCoordinate('-19.912998'),
      lng: normalizeCoordinate('-43.940933'),
    },
    {
      id: '9701-A02',
      serial: 'A02',
      tag: '9701',
      substation: 'SE SERENO',
      status: 'Alerta',
      analystStatus: 'Normal',
      analystNote: 'sdkfasdjfaslkdjfaslkdjfaslkdjfslkdfjlskdf',
      analyst: 'alexsandro.oliveira@axol.eng.br',
      power: '2 MVA',
      voltage: '22 kV',
      oil: 'MINERAL',
      manufacturer: 'WEG',
      year: '2013',
      commutator: 'CST',
      location: 'SE SERENO',
      lat: normalizeCoordinate('-21.316.419'),
      lng: normalizeCoordinate('-42.650.596'),
    },
    {
      id: 'A03',
      serial: 'A03',
      tag: '',
      substation: 'SE CANARANA 138 KV',
      status: 'Ainda nao Analisado',
      analystStatus: 'Ainda nao Analisado',
      analystNote: '',
      analyst: '',
      power: '30 MVA',
      voltage: '138 kV',
      oil: 'MINERAL',
      manufacturer: 'NAO IDENTIFICADO',
      year: '2015',
      commutator: 'SIM',
      location: 'SE CANARANA 138 KV',
      lat: normalizeCoordinate('-20.27848'),
      lng: normalizeCoordinate('-40.30561'),
    },
    {
      id: '2FTMTR01-A04',
      serial: 'A04',
      tag: '2FTMTR01',
      substation: 'SE FATIMA',
      status: 'Alerta',
      analystStatus: 'Normal',
      analystNote: 'Teste agora',
      analyst: 'alex.fabiano@axol.eng.br',
      power: '1.25 MVA',
      voltage: '36 kV',
      oil: 'MINERAL',
      manufacturer: 'WEG',
      year: '1997',
      commutator: 'SIM',
      location: 'SE FATIMA',
      lat: normalizeCoordinate('-20.663567'),
      lng: normalizeCoordinate('-43.783096'),
    },
    {
      id: '2CTMTR01-A05',
      serial: 'A05',
      tag: '2CTMTR01',
      substation: 'SE COUTO MAGALHAES',
      status: 'Alerta',
      analystStatus: 'Normal',
      analystNote: 'Descricao do analista',
      analyst: 'alex.fabiano@axol.eng.br',
      power: '1 MVA',
      voltage: '34.5 kV',
      oil: 'MINERAL',
      manufacturer: 'GE',
      year: '1994',
      commutator: 'SIM',
      location: 'SE COUTO MAGALHAES',
      lat: normalizeCoordinate('-19.8945'),
      lng: normalizeCoordinate('-44.1377'),
    },
  ]
})

watch(
  () => viewerOpen.value,
  (open) => {
    if (open) {
      window.addEventListener('message', handleViewerMessage)
    } else {
      window.removeEventListener('message', handleViewerMessage)
    }
  }
)

watch(
  () => searchQuery.value,
  () => {
    if (searchError.value) searchError.value = ''
    if (searchSuggestSuppress.value) {
      searchSuggestSuppress.value = false
      return
    }
    if (searchSuggestTimer) window.clearTimeout(searchSuggestTimer)
    const q = searchQuery.value.trim()
    if (q.length < 3) {
      clearSuggestions()
      return
    }
    searchSuggestTimer = window.setTimeout(() => {
      if (searchSuggestAbort) searchSuggestAbort.abort()
      searchSuggestAbort = new AbortController()
      searchSuggestLoading.value = true
      const url = new URL('https://nominatim.openstreetmap.org/search')
      url.searchParams.set('format', 'jsonv2')
      url.searchParams.set('q', q)
      url.searchParams.set('limit', '5')
      url.searchParams.set('addressdetails', '1')
      url.searchParams.set('countrycodes', 'br')
      fetch(url.toString(), { signal: searchSuggestAbort.signal, headers: { Accept: 'application/json' } })
        .then((res) => res.json())
        .then((results) => {
          searchSuggestLoading.value = false
          if (!Array.isArray(results)) {
            clearSuggestions()
            return
          }
          const filtered = results.filter((item) => {
            const type = String(item?.addresstype || item?.type || '').toLowerCase()
            return searchSuggestAllowedTypes.has(type)
          })
          searchSuggestions.value = filtered
          searchSuggestOpen.value = filtered.length > 0
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return
          searchSuggestLoading.value = false
          clearSuggestions()
        })
    }, 250)
  }
)

</script>

<template>
  <div class="prototype">
    <SideMenu />

    <div class="content">
      <div class="brand-header">
        <img src="@/assets/logo_siaro.png" alt="Siaro" class="brand-logo" />
      </div>
      <div class="search-under-logo">
        <div class="search-wrap">
          <form class="search-bar" @submit.prevent="handleSearch">
            <div class="search-input-wrap">
              <input
                v-model="searchQuery"
                ref="searchInputRef"
                type="search"
                placeholder="Pesquisar endereço"
                aria-label="Pesquisar endereço"
                @focus="searchSuggestOpen = searchSuggestions.length > 0"
                @blur="globalThis.setTimeout(() => (searchSuggestOpen = false), 120)"
              />
              <div v-if="searchSuggestOpen" class="search-suggest">
                <div
                  v-for="suggestion in searchSuggestions"
                  :key="suggestion.place_id"
                  class="search-suggest-item"
                  @mousedown.prevent="handleSuggestSelect(suggestion)"
                >
                  {{ suggestion.display_name }}
                </div>
                <div v-if="searchSuggestLoading" class="search-suggest-loading">Carregando...</div>
              </div>
            </div>
            <button type="submit" :disabled="searchLoading || !mapsReady">
              {{ !mapsReady ? 'Carregando...' : searchLoading ? 'Buscando...' : 'Buscar' }}
            </button>
          </form>
          <span v-if="searchError" class="search-error">{{ searchError }}</span>
        </div>
      </div>

      <section ref="mapShellRef" class="map-shell">
        <div class="kpi-stack">
          <div class="kpi-col">
            <KpiCard
              class="kpi"
              :title="stateNode?.label || 'Brasil'"
              value="Estado geral"
              :subtitle="kpis.cards[0].subtitle"
              :rows="kpis.cards[0].rows"
            />
            <KpiCard
              class="kpi"
              :title="kpis.cards[2].title"
              :value="kpis.cards[2].value"
              :subtitle="kpis.cards[2].subtitle"
              :rows="kpis.cards[2].rows"
            />
          </div>
          <div class="kpi-col">
            <KpiCard
              class="kpi"
              :title="kpis.cards[1].title"
              :value="kpis.cards[1].value"
              :subtitle="kpis.cards[1].subtitle"
              :rows="kpis.cards[1].rows"
            />
            <KpiCard
              class="kpi"
              :title="kpis.cards[3].title"
              :value="kpis.cards[3].value"
              :subtitle="kpis.cards[3].subtitle"
              :rows="kpis.cards[3].rows"
            />
          </div>
        </div>

        <div class="map-center">
          <div class="map-row">
            <GoogleMapBase
              :center="mapCenter"
              :zoom="mapZoom"
              :markers="transformerMarkers"
              @update:center="mapCenter = $event"
              @update:zoom="mapZoom = $event"
              @markerClick="handleMapMarkerClick"
              @markerHover="handleMarkerHover"
              @markerLeave="handleMarkerLeave"
              @ready="handleMapReady"
            />
          </div>
        </div>
      </section>

      <div v-if="displayInfo" class="map-hover-overlay">
        <div
          class="map-hover"
          :class="{ pinned: pinnedInfo, interactive: displayInfo.transformers?.length }"
          :style="mapHoverStyle"
        >
          <button
            v-if="pinnedInfo"
            type="button"
            class="map-hover-close"
            aria-label="Fechar"
            @click.stop="handleCloseCard"
          >
            ✕
          </button>
          <div class="map-hover-head">
            <div>
              <strong>{{ displayInfo.name }} - {{ displayInfo.sigla }}</strong>
            </div>
          </div>
          <template v-if="displayInfo.transformers?.length">
            <div v-if="displayInfo.transformers.length === 1" class="map-hover-table">
              <div class="map-hover-row">
                <span>Status</span>
                <b>{{ displayInfo.transformers[0].status }}</b>
              </div>
              <div class="map-hover-row">
                <span>Potência</span>
                <b>{{ displayInfo.transformers[0].power }}</b>
              </div>
              <div class="map-hover-row">
                <span>Nível de tensão</span>
                <b>{{ displayInfo.transformers[0].voltage }}</b>
              </div>
              <div class="map-hover-row">
                <span>Óleo</span>
                <b>{{ displayInfo.transformers[0].oil }}</b>
              </div>
            </div>
            <div v-else class="map-hover-list">
              <div class="map-hover-list-head">Transformadores</div>
              <button
                v-for="transformer in displayInfo.transformers"
                :key="transformer.id"
                type="button"
                class="map-hover-list-item"
                @click.stop="selectTransformer(transformer)"
              >
                <span>{{ transformer.id }}</span>
                <span class="map-hover-plus">+</span>
              </button>
            </div>
          </template>
          <template v-else>
            <div class="map-hover-table">
              <div class="map-hover-row">
                <span>Status</span>
                <b>Operacional</b>
              </div>
              <div class="map-hover-row">
                <span>Potência</span>
                <b>18 MVA</b>
              </div>
              <div class="map-hover-row">
                <span>Nível de tensão</span>
                <b>138 kV</b>
              </div>
              <div class="map-hover-row">
                <span>Óleo</span>
                <b>Adequado</b>
              </div>
            </div>
            <button v-if="pinnedInfo" type="button" class="map-hover-action" @click.stop="handleExpand">
              Ampliar
            </button>
          </template>
        </div>
      </div>
    </div>

    <div v-if="transformerModalOpen && selectedTransformer" class="transformer-modal">
      <div class="transformer-modal-card">
        <button type="button" class="transformer-modal-close" @click="closeTransformerModal">✕</button>
        <div class="transformer-modal-media">
          <img class="transformer-modal-image" src="@/assets/Trafo_3D.svg" alt="Transformador 3D" />
        </div>
        <div class="transformer-modal-info">
          <h3>{{ selectedTransformer.id }}</h3>
          <div class="transformer-modal-row" v-if="selectedTransformer.tag">
            <span>TAG</span>
            <b>{{ selectedTransformer.tag }}</b>
          </div>
          <div class="transformer-modal-row" v-if="selectedTransformer.serial">
            <span>Serial</span>
            <b>{{ selectedTransformer.serial }}</b>
          </div>
          <div class="transformer-modal-row">
            <span>Status</span>
            <b>{{ selectedTransformer.status }}</b>
          </div>
          <div class="transformer-modal-row" v-if="selectedTransformer.analystStatus">
            <span>Status (Analista)</span>
            <b>{{ selectedTransformer.analystStatus }}</b>
          </div>
          <div class="transformer-modal-row">
            <span>Potência</span>
            <b>{{ selectedTransformer.power }}</b>
          </div>
          <div class="transformer-modal-row">
            <span>Nível de tensão</span>
            <b>{{ selectedTransformer.voltage }}</b>
          </div>
          <div class="transformer-modal-row">
            <span>Óleo</span>
            <b>{{ selectedTransformer.oil }}</b>
          </div>
          <div class="transformer-modal-row" v-if="selectedTransformer.substation">
            <span>Subestação</span>
            <b>{{ selectedTransformer.substation }}</b>
          </div>
          <div class="transformer-modal-row" v-if="selectedTransformer.manufacturer">
            <span>Fabricante</span>
            <b>{{ selectedTransformer.manufacturer }}</b>
          </div>
          <div class="transformer-modal-row" v-if="selectedTransformer.year">
            <span>Ano</span>
            <b>{{ selectedTransformer.year }}</b>
          </div>
          <div class="transformer-modal-row" v-if="selectedTransformer.commutator">
            <span>Comutador</span>
            <b>{{ selectedTransformer.commutator }}</b>
          </div>
          <div class="transformer-modal-note" v-if="selectedTransformer.analystNote">
            <span>Descrição (Analista)</span>
            <p>{{ selectedTransformer.analystNote }}</p>
          </div>
          <div class="transformer-modal-row">
            <span>Localização</span>
            <b>
              <a
                :href="transformerMapsLink(selectedTransformer.location)"
                target="_blank"
                rel="noopener"
              >
                {{ selectedTransformer.location }}
              </a>
            </b>
          </div>
          <button type="button" class="transformer-modal-action" @click="openViewer3D">
            Ampliar 3D
          </button>
        </div>
      </div>
    </div>

    <div v-if="viewerOpen" class="viewer-overlay">
      <div class="viewer-frame">
        <button type="button" class="viewer-close" @click="closeViewer3D">✕</button>
        <img class="viewer-placeholder" src="@/assets/Trafo_3D.svg" alt="Transformador 3D" />
        <img class="viewer-watermark" src="@/assets/logo_siaro.png" alt="Siaro" />
        <iframe
          v-if="false"
          ref="viewerFrameRef"
          class="viewer-iframe"
          title="Viewer 3D"
          :src="viewerSrc"
          @load="sendViewerTrafo"
        ></iframe>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prototype{
  min-height: 100vh;
  background: radial-gradient(1200px 800px at 20% 0%, #ffffff 0%, #f4f5f7 48%, #f2f3f5 100%);
  color: var(--color-text, #0f172a);
}

.content{
  max-width: 1300px;
  margin: 0 auto;
  padding: 45px 24px 60px;
  display: grid;
  gap: 24px;
}

.brand-header{
  display: flex;
  justify-content: center;
  position: relative;
  z-index: 3;
  margin-top: -8px;
}

.brand-logo{
  width: 180px;
  height: auto;
  object-fit: contain;
  padding: 0.5px;
}

.search-wrap{
  display: grid;
  justify-items: end;
  gap: 6px;
}

.search-bar{
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
  min-width: 320px;
}

.search-input-wrap{
  position: relative;
  flex: 1;
  min-width: 0;
}

.search-under-logo{
  display: flex;
  justify-content: center;
  position: relative;
  z-index: 6;
}

.search-bar input{
  border: none;
  background: transparent;
  padding: 6px 10px;
  font-size: 12px;
  width: 100%;
  min-width: 0;
  color: rgba(15, 23, 42, 0.8);
}

.search-bar input:focus{
  outline: none;
}

.search-bar button{
  border: none;
  background: var(--color-accent, #1e4e8b);
  color: #ffffff;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  min-width: 88px;
}

.search-bar button:disabled{
  opacity: 0.6;
  cursor: default;
}

.search-error{
  font-size: 11px;
  color: rgba(180, 20, 20, 0.8);
}

.search-suggest{
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  width: 100%;
  box-sizing: border-box;
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 12px;
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.12);
  padding: 4px;
  display: grid;
  gap: 4px;
  max-height: 240px;
  overflow: auto;
  z-index: 10;
}

.search-suggest-item{
  background: transparent;
  text-align: left;
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.8);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.search-suggest-item:hover{
  background: rgba(15, 23, 42, 0.06);
}

.search-suggest-loading{
  padding: 6px 10px;
  font-size: 11px;
  color: rgba(15, 23, 42, 0.5);
}

.map-shell{
  position: relative;
  min-height: 560px;
  border-radius: 28px;
  border: none;
  background: transparent;
  box-shadow: none;
  padding: 60px 80px;
  z-index: 1;
}

.map-center{
  width: 100%;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.map-row{
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: center;
}

.map-hover{
  position: fixed;
  top: 0;
  left: 0;
  transform: none;
  min-width: 260px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255,255,255,0.96);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.16);
  display: grid;
  gap: 12px;
  pointer-events: none;
  z-index:20;
}

.map-hover-overlay{
  position: fixed;
  inset: 0;
  z-index: 200;
  pointer-events: none;
}

.map-hover-close{
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255,255,255,0.95);
  color: rgba(15, 23, 42, 0.7);
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.map-hover-close:hover{
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
}

.map-hover.pinned{
  pointer-events: auto;
}

.map-hover.interactive{
  pointer-events: auto;
}

.map-hover-head{
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.map-hover strong{
  font-size: 13px;
  color: rgba(15, 23, 42, 0.78);
}

.map-hover-value{
  font-size: 22px;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.95);
}

.map-hover small{
  font-size: 11px;
  color: rgba(15, 23, 42, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.map-hover-table{
  display: grid;
  gap: 6px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.04);
  padding: 10px 12px;
}

.map-hover-list{
  display: grid;
  gap: 6px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.04);
  padding: 10px 12px;
}

.map-hover-list-head{
  font-size: 12px;
  color: rgba(15, 23, 42, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.map-hover-list-item{
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: #ffffff;
  border-radius: 10px;
  padding: 6px 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.75);
}

.map-hover-plus{
  width: 18px;
  height: 18px;
  border-radius: 6px;
  background: rgba(42, 54, 77, 0.12);
  display: grid;
  place-items: center;
  font-weight: 700;
  color: rgba(42, 54, 77, 0.8);
}

.map-hover-transformer{
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.map-hover-iframe{
  border-radius: 12px;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.08);
  min-height: 160px;
}

.map-hover-iframe iframe{
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.map-hover-row{
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
}

.map-hover-row span{
  font-size: 12px;
  color: rgba(15, 23, 42, 0.6);
}

.map-hover-row b{
  font-size: 13px;
  color: rgba(15, 23, 42, 0.9);
}

.map-hover-action{
  border: none;
  background: var(--color-accent, #1e4e8b);
  color: #ffffff;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  box-shadow: 0 10px 20px rgba(42, 54, 77, 0.25);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.map-hover-action:hover{
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(42, 54, 77, 0.32);
}


.kpi-stack{
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  display: grid;
  grid-template-columns: repeat(2, 220px);
  justify-content: space-between;
  gap: 16px;
  z-index: 3;
  align-items: start;
  pointer-events: none;
}

.kpi-col{
  display: grid;
  gap: 16px;
  align-content: start;
  pointer-events: none;
}

.kpi{
  width: 220px;
  pointer-events: auto;
}

@media (min-width: 901px){
  .map-shell{
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    padding: 0;
    border-radius: 0;
    min-height: 100vh;
  }
  .map-center,
  .map-row{
    width: 100%;
    height: 100%;
  }
  .kpi-stack{
    top: 250px;
    left: 250px;
    right: 250px;
  }
  .map-hover{
    position: fixed;
  }
}

@media (max-width: 1100px){
  .map-shell{ padding: 50px 40px; }
  .kpi{ width: 200px; }
}

@media (max-width: 700px){
  .kpi-stack{
    grid-template-columns: 1fr;
    justify-content: center;
    left: 16px;
    right: 16px;
  }
  .kpi{
    width: 100%;
  }
}

.transformer-modal{
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  display: grid;
  place-items: center;
  z-index: 50;
  padding: 24px;
}

.transformer-modal-card{
  width: min(820px, 92vw);
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25);
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  padding: 20px;
  position: relative;
}

.transformer-modal-close{
  position: absolute;
  top: 12px;
  right: 12px;
  border: none;
  background: rgba(15, 23, 42, 0.08);
  border-radius: 999px;
  width: 28px;
  height: 28px;
  cursor: pointer;
}

.transformer-modal-media{
  border-radius: 12px;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.06);
  min-height: 220px;
  display: grid;
  place-items: center;
}

.transformer-modal-image{
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.transformer-modal-info{
  display: grid;
  gap: 10px;
}

.transformer-modal-info h3{
  margin: 0;
  font-size: 16px;
  color: rgba(15, 23, 42, 0.9);
}

.transformer-modal-row{
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: rgba(15, 23, 42, 0.7);
}

.transformer-modal-row b{
  color: rgba(15, 23, 42, 0.9);
}

.transformer-modal-note{
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.7);
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.04);
}

.transformer-modal-note p{
  margin: 0;
  white-space: pre-wrap;
  color: rgba(15, 23, 42, 0.9);
  font-size: 12px;
}

.transformer-modal-action{
  border: none;
  background: var(--color-accent, #2a364d);
  color: #ffffff;
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  margin-top: 8px;
}

.viewer-overlay{
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 0;
}

.viewer-frame{
  width: 100%;
  height: 100%;
  background: #ffffff;
  border-radius: 0;
  overflow: hidden;
  position: relative;
  display: grid;
  place-items: center;
}

.viewer-close{
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  border: 1px solid rgba(15, 23, 42, 0.14);
  background: rgba(255,255,255,0.9);
  border-radius: 999px;
  padding: 6px 12px;
  cursor: pointer;
}

.viewer-iframe{
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.viewer-placeholder{
  width: min(900px, 92%);
  height: auto;
  object-fit: contain;
}

.viewer-watermark{
  position: absolute;
  right: 24px;
  bottom: 24px;
  width: 120px;
  height: auto;
  opacity: 0.35;
  pointer-events: none;
}

@media (max-width: 900px){
  .search-under-logo{
    padding: 0 16px;
  }
  .search-wrap{
    width: 100%;
    justify-items: stretch;
  }
  .search-bar{
    width: 100%;
    justify-content: space-between;
  }
  .search-bar input{
    min-width: 0;
    flex: 1;
  }
  .map-shell{
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: relative;
    z-index: 1;
  }
  .kpi{
    position: static;
    width: 100%;
    order: 2;
  }
  .map-center{ width: 100%; }
  .map-row{ grid-template-columns: 1fr; }
  .map-center{ order: 1; }
  .map-hover{
    position: fixed;
    top: 170px !important;
    left: 50% !important;
    transform: translate(-50%, 0) !important;
    margin: 0;
    max-width: min(320px, 90vw);
  }
  .map-hover-transformer{
    grid-template-columns: 1fr;
  }
  .transformer-modal-card{
    grid-template-columns: 1fr;
  }
}
</style>
