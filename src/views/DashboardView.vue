<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, toRaw, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SideMenu from '@/components/SideMenu.vue'
import GoogleMapBase from '@/components/GoogleMapBase.vue'
import KpiCard from '@/components/KpiCard.vue'
import { usePrototypeScopeStore, type MapItem } from '@/stores/prototypeScope'
import transformersData from '@/assets/transformadores.json'
type StateSelect = { name: string; sigla: string; value: number; transformers?: any[] }
type KpiRow = {
  label: string
  value: string
  tone?: 'success' | 'warning' | 'danger' | 'info'
  tags?: { tone: 'success' | 'warning' | 'danger'; value: string }[]
  hover?: { columns: string[]; values: string[]; tones?: ('success' | 'warning' | 'danger')[] }
}
type KpiCard = {
  title: string
  value: string
  subtitle: string
  subtitleTone?: 'success' | 'warning' | 'danger' | 'info'
  chart?: { segments: { label: string; value: number; color: string }[] }
  rows: KpiRow[]
}

const store = usePrototypeScopeStore()
const router = useRouter()
const route = useRoute()
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
    regionId?: string
    stateId?: string
    cityId?: string
    contingencySerial?: string
    contingencyStatus?: string
    contingencySubstation?: string
    contingencyPower?: string
    contingencyLat?: number
    contingencyLng?: number
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
const mapBounds = ref<{ north: number; south: number; east: number; west: number } | null>(null)
const directionsService = ref<any | null>(null)
const routePolyline = shallowRef<any | null>(null)
const lastRouteKey = ref<string | null>(null)
const pinnedRouteKeys = ref<Set<string>>(new Set())
const pinnedRouteStorageKey = 'siaro:pinnedRouteKeys'
const pinnedRouteRestored = ref(false)
const pinnedRouteOverlays = ref<Map<string, any>>(new Map())
const lastMarkerHoverAt = ref(0)
const hoverLocked = ref(false)
const searchSuggestions = ref<
  {
    kind: 'transformer' | 'substation' | 'place'
    label: string
    transformer?: (typeof transformerOptions.value)[number]
    substation?: string
    place?: any
  }[]
>([])
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
])
const highlightRect = ref<any | null>(null)
const transformerQuery = ref('')
const pendingFocusSubstation = ref<string | null>(null)
const pendingFocusTransformer = ref<string | null>(null)
const selectedSubstation = ref<string | null>(null)
const searchPolygonActive = ref(false)
const searchPolygonGeojson = ref<any | null>(null)
const searchPolygons = ref<{ outer: { lat: number; lng: number }[]; holes: { lat: number; lng: number }[][] }[]>([])
const centralViewportFactor = 0.6
const substationZoomThreshold = 7
const logoHideZoom = 5

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

const regionByState: Record<string, string> = {
  AC: 'N',
  AP: 'N',
  AM: 'N',
  PA: 'N',
  RO: 'N',
  RR: 'N',
  TO: 'N',
  AL: 'NE',
  BA: 'NE',
  CE: 'NE',
  MA: 'NE',
  PB: 'NE',
  PE: 'NE',
  PI: 'NE',
  RN: 'NE',
  SE: 'NE',
  DF: 'CO',
  GO: 'CO',
  MS: 'CO',
  MT: 'CO',
  ES: 'SE',
  MG: 'SE',
  RJ: 'SE',
  SP: 'SE',
  PR: 'S',
  RS: 'S',
  SC: 'S',
}
const statusRank: Record<string, number> = { Normal: 1, Alerta: 2, Critico: 3 }
const statusLabelMap: Record<keyof typeof statusRank, string> = {
  Normal: 'Normal',
  Alerta: 'Alerta',
  Critico: 'Crítico',
}

function normalizeStatus(raw?: string) {
  if (!raw) return 'Normal'
  const value = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (value.includes('crit')) return 'Critico'
  if (value.includes('alert') || value.includes('manut') || value.includes('reclass')) return 'Alerta'
  if (value.includes('oper')) return 'Normal'
  if (value.includes('ainda')) return 'Alerta'
  return 'Normal'
}

function formatStatus(raw?: string) {
  const normalized = normalizeStatus(raw) as keyof typeof statusRank
  return statusLabelMap[normalized] || 'Normal'
}

function pickWorstStatus(primary?: string, secondary?: string) {
  const primaryNorm = normalizeStatus(primary) as keyof typeof statusRank
  const secondaryNorm = normalizeStatus(secondary) as keyof typeof statusRank
  const worst = statusRank[secondaryNorm] > statusRank[primaryNorm] ? secondaryNorm : primaryNorm
  return statusLabelMap[worst]
}

function getWorstStatusLabel(item: { status?: string; analystStatus?: string }) {
  return pickWorstStatus(item.status, item.analystStatus)
}

function parseNumeric(value?: string) {
  if (!value) return 0
  const cleaned = value.replace(/[^\d.,-]/g, '').replace(',', '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function clearSearchPolygon() {
  searchPolygonActive.value = false
  searchPolygonGeojson.value = null
  searchPolygons.value = []
}

function buildPolygonsFromGeojson(geojson: any) {
  if (!geojson) return []
  const polygons: { outer: { lat: number; lng: number }[]; holes: { lat: number; lng: number }[][] }[] = []
  const normalizeRing = (ring: any) =>
    ring.map(([lng, lat]: [number, number]) => ({ lat: Number(lat), lng: Number(lng) }))
  const buildPolygon = (coords: any) => {
    if (!Array.isArray(coords) || !coords.length) return
    const rings = coords.map((ring: any) => normalizeRing(ring))
    const [outer, ...holes] = rings
    if (outer?.length) polygons.push({ outer, holes })
  }
  if (geojson.type === 'Polygon') {
    buildPolygon(geojson.coordinates)
  } else if (geojson.type === 'MultiPolygon') {
    geojson.coordinates.forEach((poly: any) => buildPolygon(poly))
  }
  return polygons
}

function pointInRing(point: { lat: number; lng: number }, ring: { lat: number; lng: number }[]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lng
    const yi = ring[i].lat
    const xj = ring[j].lng
    const yj = ring[j].lat
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function isPointInsideSearchPolygon(lat: number, lng: number) {
  if (!searchPolygonActive.value || !searchPolygons.value.length) return false
  const point = { lat, lng }
  return searchPolygons.value.some((polygon) => {
    if (!pointInRing(point, polygon.outer)) return false
    if (!polygon.holes?.length) return true
    return !polygon.holes.some((hole) => pointInRing(point, hole))
  })
}

function getCentralBounds(bounds: { north: number; south: number; east: number; west: number }, factor: number) {
  const centerLat = (bounds.north + bounds.south) / 2
  const centerLng = (bounds.east + bounds.west) / 2
  const latSpan = (bounds.north - bounds.south) * factor
  const lngSpan = (bounds.east - bounds.west) * factor
  return {
    north: centerLat + latSpan / 2,
    south: centerLat - latSpan / 2,
    east: centerLng + lngSpan / 2,
    west: centerLng - lngSpan / 2,
  }
}

const scopeTransformers = computed(() => {
  const items = transformerOptions.value
  if (selectedTransformer.value?.id) {
    const match = items.find((item) => item.id === selectedTransformer.value?.id)
    return match ? [match] : items
  }
  if (selectedSubstation.value) {
    return items.filter((item) => item.substation?.toLowerCase() === selectedSubstation.value?.toLowerCase())
  }
  if (searchPolygonActive.value) {
    return items.filter(
      (item) =>
        typeof item.lat === 'number' &&
        typeof item.lng === 'number' &&
        isPointInsideSearchPolygon(item.lat, item.lng)
    )
  }
  if (store.level === 'regiao') {
    const regionId = store.current.id
    return items.filter((item) => item.regionId === regionId)
  }
  if (store.level === 'estado') {
    const stateId = stateNode.value?.id
    return items.filter((item) => item.stateId === stateId)
  }
  if (store.level === 'cidade') {
    const cityId = cityNode.value?.id
    return items.filter((item) => item.cityId === cityId)
  }
  if (!mapBounds.value || mapZoom.value <= 4) {
    return items
  }
  const central = getCentralBounds(mapBounds.value, centralViewportFactor)
  return items.filter(
    (item) =>
      typeof item.lat === 'number' &&
      typeof item.lng === 'number' &&
      item.lat <= central.north &&
      item.lat >= central.south &&
      item.lng <= central.east &&
      item.lng >= central.west
  )
})

const statusCounts = computed(() => {
  const counts = { Normal: 0, Alerta: 0, Critico: 0 }
  scopeTransformers.value.forEach((item) => {
    const normalized = normalizeStatus(item.status)
    counts[normalized as keyof typeof counts] += 1
  })
  return counts
})

const statusPercents = computed(() => {
  const total = scopeTransformers.value.length || 1
  return {
    Normal: (statusCounts.value.Normal / total) * 100,
    Alerta: (statusCounts.value.Alerta / total) * 100,
    Critico: (statusCounts.value.Critico / total) * 100,
  }
})

const worstStatus = computed(() => {
  const entries = Object.entries(statusCounts.value)
  if (!entries.length) return 'Normal'
  return entries.reduce((acc, [key, value]) => {
    if (value === 0) return acc
    return statusRank[key] > statusRank[acc] ? (key as keyof typeof statusRank) : acc
  }, 'Normal' as keyof typeof statusRank)
})
const worstStatusTone = computed(() => {
  switch (worstStatus.value) {
    case 'Critico':
      return 'danger'
    case 'Alerta':
      return 'warning'
    default:
      return 'success'
  }
})

const statusChart = computed(() => ({
  segments: [
    { label: 'Normal', value: statusPercents.value.Normal, color: 'var(--status-normal, #2f7f6c)' },
    { label: 'Alerta', value: statusPercents.value.Alerta, color: 'var(--status-alert, #f7cf29)' },
    { label: 'Crítico', value: statusPercents.value.Critico, color: 'var(--status-critical, #c85c5c)' },
  ],
}))

const kpiCards = computed<KpiCard[]>(() => {
  const total = scopeTransformers.value.length
  const powerValues = scopeTransformers.value.map((item) => parseNumeric(item.power)).filter((v) => v > 0)
  const voltageValues = scopeTransformers.value.map((item) => parseNumeric(item.voltage)).filter((v) => v > 0)
  const powerAvg = powerValues.length
    ? powerValues.reduce((acc, v) => acc + v, 0) / powerValues.length
    : 0
  const voltageAvg = voltageValues.length
    ? voltageValues.reduce((acc, v) => acc + v, 0) / voltageValues.length
    : 0

  const powerBands = { low: 0, mid: 0, high: 0 }
  powerValues.forEach((value) => {
    if (value <= 30) powerBands.low += 1
    else if (value < 50) powerBands.mid += 1
    else powerBands.high += 1
  })

  const powerStatusBands = {
    high: { Normal: 0, Alerta: 0, Critico: 0 },
    mid: { Normal: 0, Alerta: 0, Critico: 0 },
    low: { Normal: 0, Alerta: 0, Critico: 0 },
  }
  scopeTransformers.value.forEach((item) => {
    const power = parseNumeric(item.power)
    const status = normalizeStatus(item.status) as keyof typeof statusRank
    if (!power) return
    if (power >= 50) powerStatusBands.high[status] += 1
    else if (power > 30) powerStatusBands.mid[status] += 1
    else powerStatusBands.low[status] += 1
  })

  const voltageBands = { low: 0, mid: 0, high: 0 }
  voltageValues.forEach((value) => {
    if (value <= 69) voltageBands.low += 1
    else if (value < 230) voltageBands.mid += 1
    else voltageBands.high += 1
  })
  const voltageStatusBands = {
    high: { Normal: 0, Alerta: 0, Critico: 0 },
    mid: { Normal: 0, Alerta: 0, Critico: 0 },
    low: { Normal: 0, Alerta: 0, Critico: 0 },
  }
  scopeTransformers.value.forEach((item) => {
    const voltage = parseNumeric(item.voltage)
    const status = normalizeStatus(item.status) as keyof typeof statusRank
    if (!voltage) return
    if (voltage >= 230) voltageStatusBands.high[status] += 1
    else if (voltage > 69) voltageStatusBands.mid[status] += 1
    else voltageStatusBands.low[status] += 1
  })

  const oilBands = { adequado: 0, reclass: 0, regenera: 0 }
  scopeTransformers.value.forEach((item) => {
    const oil = item.oil?.toLowerCase() || ''
    if (oil.includes('adequ')) oilBands.adequado += 1
    else if (oil.includes('reclass')) oilBands.reclass += 1
    else if (oil.includes('regener')) oilBands.regenera += 1
  })

  const pct = (count: number) => (total ? Math.round((count / total) * 100) : 0)

  return [
    {
      title: 'Transformadores Status',
      value: total ? `Total: ${total}` : 'Total: 0',
      subtitle: `Pior status: ${worstStatus.value}`,
      chart: statusChart.value,
      rows: [
        { label: 'Total Normal', value: `${statusCounts.value.Normal}`, tone: 'success' },
        { label: 'Total Alerta', value: `${statusCounts.value.Alerta}`, tone: 'warning' },
        { label: 'Total Crítico', value: `${statusCounts.value.Critico}`, tone: 'danger' },
      ],
    },
    {
      title: 'Potência',
      value: powerAvg ? `${powerAvg.toFixed(1)} MVA` : '-',
      subtitle: 'Média do escopo',
      rows: [
        {
          label: '≥ 50 MVA',
          value: '',
          tags: [
            { tone: 'success', value: `${powerStatusBands.high.Normal}` },
            { tone: 'warning', value: `${powerStatusBands.high.Alerta}` },
            { tone: 'danger', value: `${powerStatusBands.high.Critico}` },
          ],
          hover: {
            columns: ['Normal', 'Alerta', 'Crítico'],
            tones: ['success', 'warning', 'danger'],
            values: [
              `${powerStatusBands.high.Normal}`,
              `${powerStatusBands.high.Alerta}`,
              `${powerStatusBands.high.Critico}`,
            ],
          },
        },
        {
          label: '30-50 MVA',
          value: '',
          tags: [
            { tone: 'success', value: `${powerStatusBands.mid.Normal}` },
            { tone: 'warning', value: `${powerStatusBands.mid.Alerta}` },
            { tone: 'danger', value: `${powerStatusBands.mid.Critico}` },
          ],
          hover: {
            columns: ['Normal', 'Alerta', 'Crítico'],
            tones: ['success', 'warning', 'danger'],
            values: [`${powerStatusBands.mid.Normal}`, `${powerStatusBands.mid.Alerta}`, `${powerStatusBands.mid.Critico}`],
          },
        },
        {
          label: '≤ 30 MVA',
          value: '',
          tags: [
            { tone: 'success', value: `${powerStatusBands.low.Normal}` },
            { tone: 'warning', value: `${powerStatusBands.low.Alerta}` },
            { tone: 'danger', value: `${powerStatusBands.low.Critico}` },
          ],
          hover: {
            columns: ['Normal', 'Alerta', 'Crítico'],
            tones: ['success', 'warning', 'danger'],
            values: [`${powerStatusBands.low.Normal}`, `${powerStatusBands.low.Alerta}`, `${powerStatusBands.low.Critico}`],
          },
        },
      ],
    },
    {
      title: 'Classe de Tensão',
      value: voltageAvg ? `${voltageAvg.toFixed(0)} kV` : '-',
      subtitle: 'Média do escopo',
      rows: [
        {
          label: '≥ 230 kV',
          value: '',
          tags: [
            { tone: 'success', value: `${voltageStatusBands.high.Normal}` },
            { tone: 'warning', value: `${voltageStatusBands.high.Alerta}` },
            { tone: 'danger', value: `${voltageStatusBands.high.Critico}` },
          ],
          hover: {
            columns: ['Normal', 'Alerta', 'Crítico'],
            tones: ['success', 'warning', 'danger'],
            values: [
              `${voltageStatusBands.high.Normal}`,
              `${voltageStatusBands.high.Alerta}`,
              `${voltageStatusBands.high.Critico}`,
            ],
          },
        },
        {
          label: '69 kV < u < 230',
          value: '',
          tags: [
            { tone: 'success', value: `${voltageStatusBands.mid.Normal}` },
            { tone: 'warning', value: `${voltageStatusBands.mid.Alerta}` },
            { tone: 'danger', value: `${voltageStatusBands.mid.Critico}` },
          ],
          hover: {
            columns: ['Normal', 'Alerta', 'Crítico'],
            tones: ['success', 'warning', 'danger'],
            values: [
              `${voltageStatusBands.mid.Normal}`,
              `${voltageStatusBands.mid.Alerta}`,
              `${voltageStatusBands.mid.Critico}`,
            ],
          },
        },
        {
          label: '≤ 69 kV',
          value: '',
          tags: [
            { tone: 'success', value: `${voltageStatusBands.low.Normal}` },
            { tone: 'warning', value: `${voltageStatusBands.low.Alerta}` },
            { tone: 'danger', value: `${voltageStatusBands.low.Critico}` },
          ],
          hover: {
            columns: ['Normal', 'Alerta', 'Crítico'],
            tones: ['success', 'warning', 'danger'],
            values: [
              `${voltageStatusBands.low.Normal}`,
              `${voltageStatusBands.low.Alerta}`,
              `${voltageStatusBands.low.Critico}`,
            ],
          },
        },
      ],
    },
    {
      title: 'Tratamento de Óleo',
      value: '36.240 L',
      subtitle: 'Volume total (litros)',
      rows: [
        { label: 'Volume Normal', value: '33.405 L', tone: 'success' },
        { label: 'Regeneração', value: '0 L', tone: 'info' },
        { label: 'Recondicionamento', value: '0 L', tone: 'warning' },
        { label: 'Volume em Alarme', value: '0 L', tone: 'danger' },
      ],
    },
  ]
})
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
const substationGroups = computed(() => {
  const groups: Record<string, { name: string; transformers: typeof transformerOptions.value; lat: number; lng: number }> =
    {}
  transformerOptions.value.forEach((item) => {
    if (!item.substation || typeof item.lat !== 'number' || typeof item.lng !== 'number') return
    if (!groups[item.substation]) {
      groups[item.substation] = { name: item.substation, transformers: [], lat: 0, lng: 0 }
    }
    groups[item.substation].transformers.push(item)
    groups[item.substation].lat += item.lat
    groups[item.substation].lng += item.lng
  })
  return Object.values(groups).map((group) => {
    const count = group.transformers.length || 1
    return {
      name: group.name,
      transformers: group.transformers,
      lat: group.lat / count,
      lng: group.lng / count,
    }
  })
})

const transformerMarkers = computed(() =>
  transformerOptions.value
    .filter((item) => typeof item.lat === 'number' && typeof item.lng === 'number')
    .map((item) => ({
      id: item.id,
      status: item.status,
      position: { lat: item.lat as number, lng: item.lng as number },
    }))
)

const substationMarkers = computed(() =>
  substationGroups.value
    .filter((group) => Number.isFinite(group.lat) && Number.isFinite(group.lng))
    .map((group) => ({
      id: `substation:${group.name}`,
      position: { lat: group.lat, lng: group.lng },
    }))
)

const activeMapMarkers = computed(() => transformerMarkers.value)

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
  lastMarkerHoverAt.value = Date.now()
  hoverLocked.value = true
  if (payload.id.startsWith('substation:')) {
    const name = payload.id.replace('substation:', '')
    const group = substationGroups.value.find((item) => item.name === name)
    if (!group) return
    const rect = mapShellRef.value?.getBoundingClientRect()
    if (!rect) return
    hoverPos.value = { x: payload.clientX - rect.left, y: payload.clientY - rect.top }
    mapShellOffset.value = { x: rect.left, y: rect.top }
    hoverInfo.value = {
      name: group.name,
      sigla: 'Subestação',
      value: group.transformers.length,
      transformers: group.transformers,
    }
    clearRoute()
    return
  }
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
  drawContingencyRoute(transformer)
}

function handleMapMouseMove() {
  if (pinnedInfo.value) return
  if (hoverLocked.value) return
  const elapsed = Date.now() - lastMarkerHoverAt.value
  if (elapsed < 120) return
  if (hoverInfo.value) {
    hoverInfo.value = null
    clearRoute()
  }
}

function handleMapMouseLeave() {
  if (pinnedInfo.value) return
  if (hoverLocked.value) return
  if (hoverInfo.value) {
    hoverInfo.value = null
    clearRoute()
  }
}

function handleMapInteraction() {
  if (pinnedInfo.value) return
  hoverLocked.value = false
  if (hoverInfo.value) {
    hoverInfo.value = null
    clearRoute()
  }
}

function handleMarkerLeave(id: string) {
  hoverLocked.value = false
  if (id.startsWith('substation:') && hoverInfo.value?.sigla === 'Subestação') {
    hoverInfo.value = null
    clearRoute()
    return
  }
  const current = hoverInfo.value?.transformers?.[0]?.id
  if (current === id) {
    hoverInfo.value = null
    clearRoute()
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
  clearRoute()
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
  clearRoute()
}

function focusOnTransformer(transformer: (typeof transformerOptions.value)[number]) {
  if (!transformer?.lat || !transformer?.lng) return
  if (!mapInstance.value && (window as any).__gm_map) {
    mapInstance.value = (window as any).__gm_map
  }
  if (!mapInstance.value || !googleMapsRef.value) {
    pendingFocusTransformer.value = transformer.id
    return
  }
  clearRoute()
  clearSearchPolygon()
  selectedSubstation.value = null
  const map = mapInstance.value
  map.panTo({ lat: transformer.lat, lng: transformer.lng })
  map.setZoom(12)
  openTransformerModal(transformer)
}

function focusOnSubstation(name: string) {
  clearRoute()
  clearSearchPolygon()
  selectedSubstation.value = name
  const items = transformerOptions.value.filter(
    (item) => item.substation?.toLowerCase() === name.toLowerCase()
  )
  if (!items.length) return false
  if (!mapInstance.value && (window as any).__gm_map) {
    mapInstance.value = (window as any).__gm_map
  }
  if (!mapInstance.value || !googleMapsRef.value) {
    pendingFocusSubstation.value = name
    return false
  }
  const map = mapInstance.value
  const googleMaps = googleMapsRef.value?.maps ?? googleMapsRef.value
  const bounds = new googleMaps.LatLngBounds()
  items.forEach((item) => {
    if (typeof item.lat === 'number' && typeof item.lng === 'number') {
      bounds.extend(new googleMaps.LatLng(item.lat, item.lng))
    }
  })
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds)
    window.setTimeout(() => {
      const currentZoom = map.getZoom?.()
      if (typeof currentZoom === 'number' && currentZoom > 17) {
        map.setZoom(17)
      }
    }, 0)
    if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
      const first = items.find((item) => typeof item.lat === 'number' && typeof item.lng === 'number')
      if (first) {
        map.panTo({ lat: first.lat as number, lng: first.lng as number })
        const nextZoom = Math.max(map.getZoom?.() || 17, 17)
        map.setZoom(nextZoom)
      }
    }
  }
  pinnedInfo.value = {
    name,
    sigla: 'Subestação',
    value: items.length,
    transformers: items,
  }
  return true
}

function handleSearch(override?: unknown) {
  const overrideQuery = typeof override === 'string' ? override : undefined
  searchSuggestSuppress.value = true
  clearSuggestions()
  const rawQuery = String(overrideQuery ?? searchQuery.value ?? '').trim()
  const normalized = rawQuery.toLowerCase()
  selectedSubstation.value = null
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

  const localTransformers = transformerOptions.value.filter((item) => {
    const haystack = `${item.id} ${item.serial ?? ''} ${item.tag ?? ''} ${item.substation ?? ''}`.toLowerCase()
    return haystack.includes(query.toLowerCase())
  })
  if (localTransformers.length === 1) {
    focusOnTransformer(localTransformers[0])
    return
  }
  const matchingSubstations = Array.from(
    new Set(
      transformerOptions.value
        .map((item) => item.substation)
        .filter((name): name is string => Boolean(name))
        .filter((name) => name.toLowerCase().includes(query.toLowerCase()))
    )
  )
  if (matchingSubstations.length === 1) {
    focusOnSubstation(matchingSubstations[0])
    return
  }
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
        clearSearchPolygon()
        return
      }
      const allowedTypes = new Set(['state', 'city', 'town', 'municipality'])
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
        closeTransformerModal()
        searchPolygonActive.value = true
        searchPolygonGeojson.value = result.geojson
        searchPolygons.value = buildPolygonsFromGeojson(result.geojson)
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
      clearSearchPolygon()

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
      clearSearchPolygon()
    })
}

function handleSearchBlur() {
  window.setTimeout(() => {
    searchSuggestOpen.value = false
  }, 120)
}

function clearSuggestions() {
  searchSuggestions.value = []
  searchSuggestOpen.value = false
}

function clearSearchOverlay() {
  const map = mapInstance.value
  if (map?.data) {
    map.data.forEach((feature: any) => map.data.remove(feature))
  }
  clearRoute()
  clearSearchPolygon()
}

function clearRoute() {
  if (routePolyline.value) {
    const raw = toRaw(routePolyline.value)
    raw?.setMap?.(null)
    routePolyline.value = null
  }
  lastRouteKey.value = null
}

function clearRouteForce() {
  pinnedRouteKeys.value.clear()
  window.localStorage.removeItem(pinnedRouteStorageKey)
  if (routePolyline.value) {
    const raw = toRaw(routePolyline.value)
    raw?.setMap?.(null)
    routePolyline.value = null
  }
  pinnedRouteOverlays.value.forEach((polyline) => {
    const raw = toRaw(polyline)
    raw?.setMap?.(null)
  })
  pinnedRouteOverlays.value.clear()
  lastRouteKey.value = null
}

function hasContingency(transformer: (typeof transformerOptions.value)[number]) {
  const hasForward =
    typeof transformer?.contingencyLat === 'number' && typeof transformer?.contingencyLng === 'number'
  const reverseMatch = transformerOptions.value.find(
    (item) =>
      item.contingencySerial &&
      (item.contingencySerial === transformer.id || item.contingencySerial === transformer.serial)
  )
  const hasReverse =
    reverseMatch && typeof reverseMatch.lat === 'number' && typeof reverseMatch.lng === 'number'
  return hasForward || hasReverse
}

function getRouteKey(transformer: (typeof transformerOptions.value)[number]) {
  const hasForward =
    typeof transformer?.contingencyLat === 'number' && typeof transformer?.contingencyLng === 'number'
  const reverseMatch = transformerOptions.value.find(
    (item) =>
      item.contingencySerial &&
      (item.contingencySerial === transformer.id || item.contingencySerial === transformer.serial)
  )
  if (hasForward) {
    return `${transformer.id}:${transformer.contingencyLat},${transformer.contingencyLng}`
  }
  if (reverseMatch) {
    return `${transformer.id}:${reverseMatch.id}`
  }
  return null
}

function findTransformerByRouteKey(key: string) {
  for (const item of transformerOptions.value) {
    const itemKey = getRouteKey(item)
    if (itemKey && itemKey === key) {
      return item
    }
  }
  return null
}

function isRoutePinnedFor(transformer: (typeof transformerOptions.value)[number]) {
  const key = getRouteKey(transformer)
  return Boolean(key && pinnedRouteKeys.value.has(key))
}

function toggleRoutePin(transformer: (typeof transformerOptions.value)[number]) {
  const key = getRouteKey(transformer)
  if (!key) return
  if (pinnedRouteKeys.value.has(key)) {
    pinnedRouteKeys.value.delete(key)
    const existing = pinnedRouteOverlays.value.get(key)
    if (existing) {
      const raw = toRaw(existing)
      raw?.setMap?.(null)
      pinnedRouteOverlays.value.delete(key)
    }
    window.localStorage.setItem(
      pinnedRouteStorageKey,
      JSON.stringify(Array.from(pinnedRouteKeys.value))
    )
    return
  }
  pinnedRouteKeys.value.add(key)
  window.localStorage.setItem(
    pinnedRouteStorageKey,
    JSON.stringify(Array.from(pinnedRouteKeys.value))
  )
  drawContingencyRoute(transformer, { pinned: true })
}

function drawContingencyRoute(
  transformer: (typeof transformerOptions.value)[number],
  options: { pinned?: boolean } = {}
) {
  const hasForward =
    typeof transformer?.contingencyLat === 'number' && typeof transformer?.contingencyLng === 'number'
  const reverseMatch = transformerOptions.value.find(
    (item) =>
      item.contingencySerial &&
      (item.contingencySerial === transformer.id || item.contingencySerial === transformer.serial)
  )
  const hasReverse =
    reverseMatch && typeof reverseMatch.lat === 'number' && typeof reverseMatch.lng === 'number'
  if (!hasForward && !hasReverse) {
    clearRoute()
    return
  }
  const map = mapInstance.value
  const googleMaps = googleMapsRef.value?.maps ?? googleMapsRef.value
  if (!map || !googleMaps) return
  if (!directionsService.value) {
    directionsService.value = new googleMaps.DirectionsService()
  }
  if (typeof transformer.lat !== 'number' || typeof transformer.lng !== 'number') {
    clearRoute()
    return
  }
  const routeOrigin = { lat: transformer.lat as number, lng: transformer.lng as number }
  const routeDestination = hasForward
    ? { lat: transformer.contingencyLat as number, lng: transformer.contingencyLng as number }
    : { lat: reverseMatch!.lat as number, lng: reverseMatch!.lng as number }
  const key = hasForward
    ? `${transformer.id}:${transformer.contingencyLat},${transformer.contingencyLng}`
    : `${transformer.id}:${reverseMatch!.id}`
  if (lastRouteKey.value === key && routePolyline.value) return
  lastRouteKey.value = key
  if (options.pinned && pinnedRouteOverlays.value.has(key)) {
    const existing = pinnedRouteOverlays.value.get(key)
    const raw = toRaw(existing)
    raw?.setMap?.(map)
    return
  }
  directionsService.value.route(
    {
      origin: routeOrigin,
      destination: routeDestination,
      travelMode: googleMaps.TravelMode.DRIVING,
    },
    (result: any, status: string) => {
      if (status !== 'OK' || !result?.routes?.length) {
        clearRoute()
        return
      }
      const path = result.routes[0].overview_path
      if (options.pinned) {
        const pinnedPolyline = new googleMaps.Polyline({
          path,
          strokeColor: '#1e4e8b',
          strokeOpacity: 0.9,
          strokeWeight: 4,
          map,
        })
        pinnedRouteOverlays.value.set(key, pinnedPolyline)
        return
      }
      if (routePolyline.value) {
        const raw = toRaw(routePolyline.value)
        raw?.setMap?.(null)
      }
      routePolyline.value = new googleMaps.Polyline({
        path,
        strokeColor: '#1e4e8b',
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map,
      })
    }
  )
}

function handleSuggestSelect(suggestion: any) {
  searchSuggestSuppress.value = true
  if (suggestion?.kind === 'transformer' && suggestion.transformer) {
    searchQuery.value = suggestion.label
    focusOnTransformer(suggestion.transformer)
    clearSuggestions()
    return
  }
  if (suggestion?.kind === 'substation' && suggestion.substation) {
    searchQuery.value = suggestion.label
    const focused = focusOnSubstation(suggestion.substation)
    if (!focused) handleSearch(suggestion.substation)
    clearSuggestions()
    return
  }
  const raw = searchQuery.value.trim()
  const normalized = raw.toLowerCase()
  if (normalized.startsWith('estado ') || normalized.startsWith('estado de ')) {
    handleSearch(raw)
  } else {
    searchQuery.value = suggestion.place?.display_name || suggestion.label || raw
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
  if (searchPolygonGeojson.value) {
    searchPolygons.value = buildPolygonsFromGeojson(searchPolygonGeojson.value)
  }
  if (pendingFocusTransformer.value) {
    const target = transformerOptions.value.find((item) => item.id === pendingFocusTransformer.value)
    if (target) {
      pendingFocusTransformer.value = null
      focusOnTransformer(target)
      return
    }
  }
  if (pendingFocusSubstation.value) {
    const target = pendingFocusSubstation.value
    pendingFocusSubstation.value = null
    focusOnSubstation(target)
  }
}

watch(
  () => route.query.transformer,
  (value) => {
    if (!value) return
    const id = Array.isArray(value) ? value[0] : String(value)
    const target = transformerOptions.value.find((item) => item.id === id)
    if (target) {
      focusOnTransformer(target)
    } else {
      pendingFocusTransformer.value = id
    }
  },
  { immediate: true }
)

watch(
  [transformerOptions, mapInstance, googleMapsRef, pendingFocusTransformer],
  ([options, map, googleMaps, pending]) => {
    if (!pending || !options.length || !map || !googleMaps) return
    const target = options.find((item) => item.id === pending)
    if (!target) return
    pendingFocusTransformer.value = null
    focusOnTransformer(target)
  }
)

function handleMove(payload: { x: number; y: number }) {
  const rect = mapShellRef.value?.getBoundingClientRect()
  if (!rect) return
  hoverPos.value = { x: payload.x - rect.left, y: payload.y - rect.top }
  mapShellOffset.value = { x: rect.left, y: rect.top }
}

function handleMapMarkerClick(id: string) {
  if (id.startsWith('substation:')) {
    const name = id.replace('substation:', '')
    if (name) focusOnSubstation(name)
    return
  }
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
const isLogoHidden = computed(() => mapZoom.value >= logoHideZoom)

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

function openTransformerReport() {
  if (!selectedTransformer.value) return
  router.push({ name: 'transformer-report', params: { id: selectedTransformer.value.id } })
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
const displayWorstStatus = computed(() => {
  const transformers = displayInfo.value?.transformers
  if (!transformers?.length) return ''
  return transformers.reduce((acc, item) => {
    const normalized = normalizeStatus(item.status)
    return statusRank[normalized] > statusRank[acc] ? normalized : acc
  }, 'Normal' as keyof typeof statusRank)
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
  const storedLocation = window.localStorage.getItem('axol.userLocation')
  if (storedLocation) {
    try {
      const parsed = JSON.parse(storedLocation)
      if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
        mapCenter.value = { lat: parsed.lat, lng: parsed.lng }
        mapZoom.value = typeof parsed?.zoom === 'number' ? parsed.zoom : 10
      }
    } catch (err) {
      console.warn('[map] invalid stored location', err)
    }
  }
  const rawSubstations = (transformersData as any)?.subestacoes || []
  const baseTransformers = [
    {
      id: 'MG-9701-A01',
      serial: 'MG-A01',
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
      regionId: 'SE',
      stateId: 'MG',
      cityId: 'BH',
      contingencySerial: 'MG-2CTMTR01-A05',
      contingencyStatus: 'Alerta',
      contingencySubstation: 'SE COUTO MAGALHAES',
      contingencyPower: '1 MVA',
      contingencyLat: normalizeCoordinate('-19.8945'),
      contingencyLng: normalizeCoordinate('-44.1377'),
    },
    {
      id: 'MG-9701-A02',
      serial: 'MG-A02',
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
      regionId: 'SE',
      stateId: 'MG',
      cityId: 'BH',
    },
    {
      id: 'MG-A03',
      serial: 'MG-A03',
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
      regionId: 'SE',
      stateId: 'ES',
    },
    {
      id: 'MG-2FTMTR01-A04',
      serial: 'MG-A04',
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
      regionId: 'SE',
      stateId: 'MG',
      cityId: 'BH',
    },
    {
      id: 'MG-2CTMTR01-A05',
      serial: 'MG-A05',
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
      regionId: 'SE',
      stateId: 'MG',
      cityId: 'BH',
    },
  ]
  const jsonTransformers = rawSubstations.flatMap((substation: any) => {
    const name = substation?.NOME || substation?.SUBESTACAO || 'Subestação'
    const reference = substation?.REFERENCIA ? ` • ${substation.REFERENCIA}` : ''
    return (substation?.transformadores || []).map((trafo: any) => ({
      id: trafo?.TAG ? `${trafo.TAG}-${trafo.SERIAL}` : String(trafo?.SERIAL || ''),
      serial: trafo?.SERIAL,
      tag: trafo?.TAG,
      substation: trafo?.SUBESTACAO || name,
      status: pickWorstStatus(trafo?.ESTADO, trafo?.ESTADO_ANALISTA),
      analystStatus: formatStatus(trafo?.ESTADO_ANALISTA),
      analystNote: trafo?.DESCRICAO_ANALISTA,
      analyst: trafo?.ANALISTA,
      power: trafo?.POTENCIA ? `${trafo.POTENCIA} MVA` : '-',
      voltage: trafo?.T_MAIOR ? `${trafo.T_MAIOR} kV` : '-',
      oil: trafo?.OLEO_FLUIDO || '-',
      manufacturer: trafo?.FABRICANTE,
      year: trafo?.ANO_FABRICACAO,
      commutator: trafo?.COMUTADOR,
      location: `${name}${reference}`,
      lat: normalizeCoordinate(trafo?.LATITUDE),
      lng: normalizeCoordinate(trafo?.LONGITUDE),
      regionId: 'SE',
      stateId: 'SP',
      cityId: 'SPC',
      contingencySerial: trafo?.CONTINGENCIA?.SERIAL,
      contingencyStatus: trafo?.CONTINGENCIA?.STATUS,
      contingencySubstation: trafo?.CONTINGENCIA?.SUBESTACAO,
      contingencyPower: trafo?.CONTINGENCIA?.POTENCIA ? `${trafo.CONTINGENCIA.POTENCIA} MVA` : undefined,
      contingencyLat: normalizeCoordinate(trafo?.CONTINGENCIA?.LATITUDE),
      contingencyLng: normalizeCoordinate(trafo?.CONTINGENCIA?.LONGITUDE),
    }))
  })
  transformerOptions.value = [...baseTransformers, ...jsonTransformers]
})

watch(
  [mapInstance, googleMapsRef, transformerOptions],
  ([map, googleMaps, transformers]) => {
    if (pinnedRouteRestored.value) return
    if (!map || !googleMaps || !transformers.length) return
    const stored = window.localStorage.getItem(pinnedRouteStorageKey)
    if (!stored) {
      pinnedRouteRestored.value = true
      return
    }
    const keys = (() => {
      try {
        return JSON.parse(stored) as string[]
      } catch {
        return [stored]
      }
    })()
    const restored: string[] = []
    keys.forEach((key) => {
      const transformer = findTransformerByRouteKey(key)
      if (!transformer) return
      pinnedRouteKeys.value.add(key)
      restored.push(key)
      drawContingencyRoute(transformer, { pinned: true })
    })
    if (!restored.length) {
      window.localStorage.removeItem(pinnedRouteStorageKey)
    } else {
      window.localStorage.setItem(pinnedRouteStorageKey, JSON.stringify(restored))
    }
    pinnedRouteRestored.value = true
  },
  { immediate: true }
)

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
    if (!searchQuery.value.trim()) {
      clearSearchOverlay()
      return
    }
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
          const localTransformers = transformerOptions.value
            .filter((item) => {
              const haystack = `${item.id} ${item.serial ?? ''} ${item.tag ?? ''}`.toLowerCase()
              return haystack.includes(q.toLowerCase())
            })
            .map((item) => ({
              kind: 'transformer' as const,
              label: `Transformador ${item.id}`,
              transformer: item,
            }))
          const localSubstations = Array.from(
            new Set(
              transformerOptions.value
                .map((item) => item.substation)
                .filter((name): name is string => Boolean(name))
                .filter((name) => name.toLowerCase().includes(q.toLowerCase()))
            )
          ).map((name) => ({
            kind: 'substation' as const,
            label: `Subestação ${name}`,
            substation: name,
          }))
          const placeSuggestions = filtered.map((item) => ({
            kind: 'place' as const,
            label: item.display_name,
            place: item,
          }))
          const merged = [...localTransformers, ...localSubstations, ...placeSuggestions]
          searchSuggestions.value = merged
          searchSuggestOpen.value = merged.length > 0
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
      <div class="brand-header" :class="{ hidden: isLogoHidden }">
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
                @blur="handleSearchBlur"
              />
              <div v-if="searchSuggestOpen" class="search-suggest">
                <div
                  v-for="suggestion in searchSuggestions"
                  :key="suggestion.label"
                  class="search-suggest-item"
                  @mousedown.prevent="handleSuggestSelect(suggestion)"
                >
                  {{ suggestion.label }}
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

      <section ref="mapShellRef" class="map-shell" @mousemove="handleMapMouseMove" @mouseleave="handleMapMouseLeave">
        <div class="kpi-stack">
          <div class="kpi-col">
            <KpiCard
              class="kpi"
              :title="kpiCards[0].title"
              :value="kpiCards[0].value"
              :subtitle="kpiCards[0].subtitle"
              :subtitleTone="worstStatusTone"
              :rows="kpiCards[0].rows"
              :chart="kpiCards[0].chart"
              :defaultOpen="true"
            />
            <KpiCard
              class="kpi"
              :title="kpiCards[3].title"
              :value="kpiCards[3].value"
              :subtitle="kpiCards[3].subtitle"
              :rows="kpiCards[3].rows"
              :defaultOpen="true"
            />
          </div>
          <div class="kpi-col">
            <KpiCard
              class="kpi"
              :title="kpiCards[1].title"
              :value="kpiCards[1].value"
              :subtitle="kpiCards[1].subtitle"
              :rows="kpiCards[1].rows"
              :defaultOpen="true"
            />
            <KpiCard
              class="kpi"
              :title="kpiCards[2].title"
              :value="kpiCards[2].value"
              :subtitle="kpiCards[2].subtitle"
              :rows="kpiCards[2].rows"
              :defaultOpen="true"
            />
          </div>
        </div>

        <div class="map-center">
          <div class="map-row">
            <GoogleMapBase
              :center="mapCenter"
              :zoom="mapZoom"
              :markers="activeMapMarkers"
              @update:center="mapCenter = $event"
              @update:zoom="mapZoom = $event"
              @update:bounds="mapBounds = $event"
              @markerClick="handleMapMarkerClick"
              @markerHover="handleMarkerHover"
              @markerLeave="handleMarkerLeave"
              @interaction="handleMapInteraction"
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
            <button
              v-if="displayInfo.transformers?.length === 1 && hasContingency(displayInfo.transformers[0])"
              type="button"
              class="map-hover-pin"
              :class="{ active: isRoutePinnedFor(displayInfo.transformers[0]) }"
              aria-label="Fixar rota de contingência"
              :aria-pressed="isRoutePinnedFor(displayInfo.transformers[0])"
              @click.stop="toggleRoutePin(displayInfo.transformers[0])"
            >
              <svg v-if="isRoutePinnedFor(displayInfo.transformers[0])" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M9.25 1.75a1.75 1.75 0 1 1 3.5 0V4a2.25 2.25 0 0 1-1.5 2.12V8l1.53 1.53a.75.75 0 0 1-.53 1.28H9.5V14a.5.5 0 0 1-1 0v-3.19H5.75a.75.75 0 0 1-.53-1.28L6.75 8V6.12A2.25 2.25 0 0 1 5.25 4V1.75a1.75 1.75 0 1 1 3.5 0V4a.75.75 0 0 0 .5.71V1.75Z"
                />
                <path
                  fill="currentColor"
                  d="M2.47 2.47a.75.75 0 0 1 1.06 0l10 10a.75.75 0 1 1-1.06 1.06l-10-10a.75.75 0 0 1 0-1.06Z"
                />
              </svg>
              <svg v-else viewBox="0 0 16 16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M9.25 1.75a1.75 1.75 0 1 1 3.5 0V4a2.25 2.25 0 0 1-1.5 2.12V8l1.53 1.53a.75.75 0 0 1-.53 1.28H9.5V14a.5.5 0 0 1-1 0v-3.19H5.75a.75.75 0 0 1-.53-1.28L6.75 8V6.12A2.25 2.25 0 0 1 5.25 4V1.75a1.75 1.75 0 1 1 3.5 0V4a.75.75 0 0 0 .5.71V1.75Z"
                />
              </svg>
            </button>
          </div>
          <template v-if="displayInfo.transformers?.length">
            <div v-if="displayInfo.transformers.length === 1" class="map-hover-table">
              <div class="map-hover-row">
                <span>Serial</span>
                <b>{{ displayInfo.transformers[0].serial || displayInfo.transformers[0].id }}</b>
              </div>
              <div class="map-hover-row">
                <span>Subestação</span>
                <b>{{ displayInfo.transformers[0].substation || '—' }}</b>
              </div>
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
              <div v-if="displayInfo.transformers[0].contingencySerial" class="map-hover-row">
                <span>Contingência</span>
                <b>
                  {{ displayInfo.transformers[0].contingencySerial }} •
                  {{ displayInfo.transformers[0].contingencyStatus || 'Normal' }}
                </b>
              </div>
            </div>
            <div v-else class="map-hover-list">
              <div class="map-hover-row">
                <span>Status (pior)</span>
                <b>{{ displayWorstStatus }}</b>
              </div>
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
        <button type="button" class="transformer-modal-action mobile-only" @click="openViewer3D">
          Ampliar 3D
        </button>
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
          <div class="transformer-modal-row" v-if="hasContingency(selectedTransformer)">
            <span>Fixar Rota de Contingência</span>
            <button
              type="button"
              class="transformer-modal-pin"
              :class="{ active: isRoutePinnedFor(selectedTransformer) }"
              aria-label="Fixar rota de contingência"
              :aria-pressed="isRoutePinnedFor(selectedTransformer)"
              @click.stop="toggleRoutePin(selectedTransformer)"
            >
              <svg v-if="isRoutePinnedFor(selectedTransformer)" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M9.25 1.75a1.75 1.75 0 1 1 3.5 0V4a2.25 2.25 0 0 1-1.5 2.12V8l1.53 1.53a.75.75 0 0 1-.53 1.28H9.5V14a.5.5 0 0 1-1 0v-3.19H5.75a.75.75 0 0 1-.53-1.28L6.75 8V6.12A2.25 2.25 0 0 1 5.25 4V1.75a1.75 1.75 0 1 1 3.5 0V4a.75.75 0 0 0 .5.71V1.75Z"
                />
                <path
                  fill="currentColor"
                  d="M2.47 2.47a.75.75 0 0 1 1.06 0l10 10a.75.75 0 1 1-1.06 1.06l-10-10a.75.75 0 0 1 0-1.06Z"
                />
              </svg>
              <svg v-else viewBox="0 0 16 16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M9.25 1.75a1.75 1.75 0 1 1 3.5 0V4a2.25 2.25 0 0 1-1.5 2.12V8l1.53 1.53a.75.75 0 0 1-.53 1.28H9.5V14a.5.5 0 0 1-1 0v-3.19H5.75a.75.75 0 0 1-.53-1.28L6.75 8V6.12A2.25 2.25 0 0 1 5.25 4V1.75a1.75 1.75 0 1 1 3.5 0V4a.75.75 0 0 0 .5.71V1.75Z"
                />
              </svg>
            </button>
          </div>
          <button type="button" class="transformer-modal-action" @click="openViewer3D">
            Ampliar 3D
          </button>
          <button type="button" class="transformer-modal-action secondary" @click="openTransformerReport">
            Ver relatório
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
  padding: 32px 24px 60px;
  display: grid;
  gap: 24px;
}

.brand-header{
  display: flex;
  justify-content: center;
  position: relative;
  z-index: 3;
  margin-top: -20px;
  transition: opacity 0.35s ease, transform 0.35s ease;
}
.brand-logo{
  width: 150px;
  height: auto;
  object-fit: contain;
  padding: 0.5px;
}
.brand-header.hidden{
  opacity: 0;
  transform: translateY(-10px);
  pointer-events: none;
}

@media (max-width: 700px){
  .brand-header{
    justify-content: flex-end;
    margin-top: -20px;
  }
  .brand-logo{
    width: 90px;
  }
  .brand-header.hidden{
    opacity: 1;
    transform: none;
    pointer-events: auto;
  }
}

.search-wrap{
  display: grid;
  justify-items: end;
  gap: 6px;
}

body.menu-open{
  overflow: hidden;
  touch-action: none;
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
  margin-top: -10px;
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

.map-hover-pin{
  width: 26px;
  height: 26px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: transparent;
  color: #1e4e8b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  transition: transform 150ms ease, background 150ms ease, color 150ms ease;
}

.map-hover-pin svg{
  width: 14px;
  height: 14px;
}

.map-hover-pin:hover{
  background: rgba(30, 78, 139, 0.08);
  transform: translateY(-1px);
}

.map-hover-pin.active{
  background: #1e4e8b;
  border-color: #1e4e8b;
  color: #ffffff;
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
  grid-template-columns: repeat(2, 250px);
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
  width: 250px;
  pointer-events: auto;
}
.kpi:has(.card.open){
  min-height: 320px;
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
    top: 220px;
    left: 140px;
    right: 140px;
  }
  .map-hover{
    position: fixed;
  }
}

@media (max-width: 1100px){
  .map-shell{ padding: 50px 40px; }
  .kpi{ width: 220px; }
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

.transformer-modal-pin{
  width: 26px;
  height: 26px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: transparent;
  color: #1e4e8b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  transition: transform 150ms ease, background 150ms ease, color 150ms ease;
}

.transformer-modal-pin svg{
  width: 14px;
  height: 14px;
}

.transformer-modal-pin:hover{
  background: rgba(30, 78, 139, 0.08);
  transform: translateY(-1px);
}

.transformer-modal-pin.active{
  background: #1e4e8b;
  border-color: #1e4e8b;
  color: #ffffff;
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
.transformer-modal-action.secondary{
  background: #ffffff;
  color: var(--color-accent, #2a364d);
  border: 1px solid rgba(30, 78, 139, 0.35);
}

.transformer-modal-action.mobile-only{
  display: none;
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
    position: static;
    top: auto;
    z-index: 2;
    margin-bottom: -8px;
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
  .map-center{
    order: 1;
  }
  .kpi-stack{
    position: static;
    width: 100%;
    grid-template-columns: 1fr;
    justify-content: stretch;
    order: 2;
  }
  .kpi-col{
    width: 100%;
  }
  .kpi{
    position: static;
    width: 100%;
    order: 2;
  }
  .map-center{ width: 100%; }
  .map-row{
    grid-template-columns: 1fr;
    min-height: 55vh;
  }
  .map-hover-overlay{
    display: none;
  }
  .map-hover-transformer{
    grid-template-columns: 1fr;
  }
  .transformer-modal-card{
    grid-template-columns: 1fr;
    max-height: 82vh;
    overflow: auto;
  }
  .transformer-modal-media{
    order: 1;
  }
  .transformer-modal-action.mobile-only{
    display: block;
    width: 100%;
    order: 2;
  }
  .transformer-modal-info{
    order: 3;
  }
  .transformer-modal-info .transformer-modal-action{
    display: none;
  }
  .transformer-modal-media{
    min-height: 180px;
  }
}
</style>
