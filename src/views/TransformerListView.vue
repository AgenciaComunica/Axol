<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import SideMenu from '@/components/SideMenu.vue'
import AppHeader from '@/components/AppHeader.vue'
import transformersData from '@/assets/transformadores.json'

const router = useRouter()
const rawSubstations = (transformersData as any)?.subestacoes || []

const baseTransformers: TableTransformer[] = [
  {
    id: 'MG-9701-A01',
    serial: 'MG-A01',
    tag: '9701',
    substation: 'SE VISCONDE DO RIO BRANCO',
    unit: '-',
    equipment: '-',
    commutator: 'SIM',
    oilFluid: 'NAO IDENTIFICADO',
    status: 'Normal',
    statusTr: 'Normal',
    analystStatus: 'Alerta',
    primaryVoltage: '-',
    secondaryVoltage: '-',
    power: '43 MVA',
    voltage: '69 kV',
    year: '1993',
    manufacturer: 'TRAFO',
    volume: '-',
    refrigeration: '-',
    load: '-',
    operating: '-',
    sealed: '-',
    location: 'SE VISCONDE DO RIO BRANCO',
    latitude: '-19.912998',
    longitude: '-43.940933',
    levels: makeLevels('9701-MG-A01'),
  },
  {
    id: 'MG-9701-A02',
    serial: 'MG-A02',
    tag: '9701',
    substation: 'SE SERENO',
    unit: '-',
    equipment: '-',
    commutator: 'CST',
    oilFluid: 'MINERAL',
    status: 'Alerta',
    statusTr: 'Alerta',
    analystStatus: 'Normal',
    primaryVoltage: '-',
    secondaryVoltage: '-',
    power: '2 MVA',
    voltage: '22 kV',
    year: '2013',
    manufacturer: 'WEG',
    volume: '-',
    refrigeration: '-',
    load: '-',
    operating: '-',
    sealed: '-',
    location: 'SE SERENO',
    latitude: '-21.316419',
    longitude: '-42.650596',
    levels: makeLevels('9701-MG-A02'),
  },
  {
    id: 'MG-A03',
    serial: 'MG-A03',
    tag: '',
    substation: 'SE CANARANA 138 KV',
    unit: '-',
    equipment: '-',
    commutator: 'SIM',
    oilFluid: 'MINERAL',
    status: 'Alerta',
    statusTr: 'Alerta',
    analystStatus: 'Alerta',
    primaryVoltage: '-',
    secondaryVoltage: '-',
    power: '30 MVA',
    voltage: '138 kV',
    year: '2015',
    manufacturer: 'NAO IDENTIFICADO',
    volume: '-',
    refrigeration: '-',
    load: '-',
    operating: '-',
    sealed: '-',
    location: 'SE CANARANA 138 KV',
    latitude: '-20.27848',
    longitude: '-40.30561',
    levels: makeLevels('MG-A03'),
  },
  {
    id: 'MG-2FTMTR01-A04',
    serial: 'MG-A04',
    tag: '2FTMTR01',
    substation: 'SE FATIMA',
    unit: '-',
    equipment: '-',
    commutator: 'SIM',
    oilFluid: 'MINERAL',
    status: 'Alerta',
    statusTr: 'Alerta',
    analystStatus: 'Normal',
    primaryVoltage: '-',
    secondaryVoltage: '-',
    power: '1.25 MVA',
    voltage: '36 kV',
    year: '1997',
    manufacturer: 'WEG',
    volume: '-',
    refrigeration: '-',
    load: '-',
    operating: '-',
    sealed: '-',
    location: 'SE FATIMA',
    latitude: '-20.663567',
    longitude: '-43.783096',
    levels: makeLevels('2FTMTR01-MG-A04'),
  },
  {
    id: 'MG-2CTMTR01-A05',
    serial: 'MG-A05',
    tag: '2CTMTR01',
    substation: 'SE COUTO MAGALHAES',
    unit: '-',
    equipment: '-',
    commutator: 'SIM',
    oilFluid: 'MINERAL',
    status: 'Alerta',
    statusTr: 'Alerta',
    analystStatus: 'Normal',
    primaryVoltage: '-',
    secondaryVoltage: '-',
    power: '1 MVA',
    voltage: '34.5 kV',
    year: '1994',
    manufacturer: 'GE',
    volume: '-',
    refrigeration: '-',
    load: '-',
    operating: '-',
    sealed: '-',
    location: 'SE COUTO MAGALHAES',
    latitude: '-19.8945',
    longitude: '-44.1377',
    levels: makeLevels('2CTMTR01-MG-A05'),
  },
]

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

function pickWorstStatus(primary?: string, secondary?: string) {
  const primaryNorm = normalizeStatus(primary) as keyof typeof statusRank
  const secondaryNorm = normalizeStatus(secondary) as keyof typeof statusRank
  const worst = statusRank[secondaryNorm] > statusRank[primaryNorm] ? secondaryNorm : primaryNorm
  return statusLabelMap[worst] || 'Normal'
}

function statusTone(status?: string) {
  if (status && status.toLowerCase().includes('pend')) return 'tone-neutral'
  const normalized = normalizeStatus(status)
  if (normalized === 'Critico') return 'tone-danger'
  if (normalized === 'Alerta') return 'tone-warning'
  return 'tone-normal'
}

type TableTransformer = {
  id: string
  tag?: string
  serial?: string
  substation?: string
  unit?: string
  equipment?: string
  commutator?: string
  oilFluid?: string
  status: string
  statusTr?: string
  analystStatus?: string
  power: string
  primaryVoltage?: string
  secondaryVoltage?: string
  voltage: string
  year?: string
  manufacturer?: string
  volume?: string
  refrigeration?: string
  load?: string
  operating?: string
  sealed?: string
  location?: string
  latitude?: string
  longitude?: string
  levels?: Record<'N1' | 'N2' | 'N3' | 'N4' | 'N5', number | null>
}

const levelKeys = ['N1', 'N2', 'N3', 'N4', 'N5'] as const
type LevelKey = (typeof levelKeys)[number]

function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

function makeLevels(seed: string): Record<LevelKey, number | null> {
  const base = hashString(seed || 'siaro')
  const mode = base % 5
  if (mode === 0) {
    return { N1: null, N2: null, N3: null, N4: null, N5: null }
  }
  if (mode === 1) {
    return { N1: 100, N2: 0, N3: 0, N4: 0, N5: 0 }
  }

  const indices: LevelKey[] = ['N1', 'N2', 'N3', 'N4', 'N5']
  const activeCount = 2 + (base % 3)
  const start = base % indices.length
  const active = Array.from({ length: activeCount }, (_, i) => indices[(start + i) % indices.length])

  const weights = active.map((_, i) => (base * (i + 3) + i * 17) % 100 + 1)
  const total = weights.reduce((sum, value) => sum + value, 0)

  const result: Record<LevelKey, number> = { N1: 0, N2: 0, N3: 0, N4: 0, N5: 0 }
  active.forEach((key, index) => {
    result[key] = Number(((weights[index] / total) * 100).toFixed(2))
  })
  return result
}

function levelText(item: TableTransformer, key: LevelKey) {
  const value = item.levels?.[key]
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value.toFixed(2)}%`
}

function levelClass(item: TableTransformer, key: LevelKey) {
  const value = item.levels?.[key]
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) return 'level-empty'
  if (value >= 80) return 'level-critical'
  if (value >= 60) return 'level-high'
  if (value >= 40) return 'level-medium'
  if (value >= 20) return 'level-low'
  return 'level-very-low'
}

const transformers = computed<TableTransformer[]>(() => {
  const jsonTransformers = rawSubstations.flatMap((substation: any) => {
    const name = substation?.NOME || substation?.SUBESTACAO || 'Subestação'
    const reference = substation?.REFERENCIA ? ` • ${substation.REFERENCIA}` : ''
    return (substation?.transformadores || []).map((trafo: any) => ({
      id: trafo?.TAG ? `${trafo.TAG}-${trafo.SERIAL}` : String(trafo?.SERIAL || ''),
      tag: trafo?.TAG,
      serial: trafo?.SERIAL,
      substation: trafo?.SUBESTACAO || name,
      unit: trafo?.UNIDADE,
      equipment: trafo?.EQUIPAMENTO,
      commutator: trafo?.COMUTADOR,
      oilFluid: trafo?.OLEO_FLUIDO,
      status: pickWorstStatus(trafo?.ESTADO, trafo?.ESTADO_ANALISTA),
      statusTr: trafo?.SERIAL === 'A01' ? 'Pendente' : pickWorstStatus(trafo?.ESTADO),
      analystStatus:
        trafo?.SERIAL === 'A01'
          ? 'Pendente'
          : trafo?.ESTADO_ANALISTA
            ? pickWorstStatus(trafo?.ESTADO_ANALISTA)
            : 'Normal',
      primaryVoltage: trafo?.T_PRIMARIA ? `${trafo.T_PRIMARIA}` : '-',
      secondaryVoltage: trafo?.T_SECUNDARIA ? `${trafo.T_SECUNDARIA}` : '-',
      power: trafo?.POTENCIA ? `${trafo.POTENCIA} MVA` : '-',
      voltage: trafo?.T_MAIOR ? `${trafo.T_MAIOR} kV` : '-',
      year: trafo?.ANO_FABRICACAO,
      manufacturer: trafo?.FABRICANTE,
      volume: trafo?.VOLUME,
      refrigeration: trafo?.REFRIGERACAO,
      load: trafo?.CARREGAMENTO,
      operating: trafo?.OPERANDO,
      sealed: trafo?.SELADO,
      location: `${name}${reference}`,
      latitude: trafo?.LATITUDE,
      longitude: trafo?.LONGITUDE,
      levels: makeLevels(`${trafo?.TAG || ''}-${trafo?.SERIAL || ''}`),
    }))
  })

  const merged = [...baseTransformers, ...jsonTransformers]
  const byId = new Map<string, TableTransformer>()
  merged.forEach((item) => {
    if (!item.id) return
    if (!byId.has(item.id)) byId.set(item.id, item)
  })
  return Array.from(byId.values()).map((item) => ({ ...item, ...(transformerEdits.value[item.id] || {}) }))
})

const searchQuery = ref('')

const filteredTransformers = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return transformers.value
  return transformers.value.filter((item) => {
    const values = Object.values(item)
    return values.some((value) => String(value ?? '').toLowerCase().includes(query))
  })
})

const orderedTransformers = computed(() => {
  return [...filteredTransformers.value].sort((a, b) => {
    const aRank = statusRank[normalizeStatus(a.status)] || 0
    const bRank = statusRank[normalizeStatus(b.status)] || 0
    if (aRank !== bRank) return bRank - aRank
    const aId = `${a.tag || ''}${a.serial || a.id}`
    const bId = `${b.tag || ''}${b.serial || b.id}`
    return aId.localeCompare(bId)
  })
})

const page = ref(1)
const rowsPerPage = ref(10)
const rowsPerPageOptions = [10, 20, 30, 50]
const totalPages = computed(() => Math.max(1, Math.ceil(orderedTransformers.value.length / rowsPerPage.value)))
const visibleTransformers = computed(() => {
  const start = (page.value - 1) * rowsPerPage.value
  const end = start + rowsPerPage.value
  return orderedTransformers.value.slice(start, end)
})
const pageRangeLabel = computed(() => {
  const total = orderedTransformers.value.length
  if (!total) return '0 de 0'
  const start = (page.value - 1) * rowsPerPage.value + 1
  const end = Math.min(page.value * rowsPerPage.value, total)
  return `${start}-${end} de ${total}`
})

const openActionId = ref<string | null>(null)
const exportMenuOpen = ref(false)
const exportWrapRef = ref<HTMLElement | null>(null)
const columnsMenuOpen = ref(false)
const columnsWrapRef = ref<HTMLElement | null>(null)
const newMenuOpen = ref(false)
const newWrapRef = ref<HTMLElement | null>(null)
const transformerEdits = ref<Record<string, Partial<TableTransformer>>>({})
const editModalOpen = ref(false)
const editForm = ref({
  id: '',
  serial: '',
  tag: '',
  substation: '',
  unit: '',
  power: '',
  voltage: '',
  manufacturer: '',
  year: '',
  latitude: '',
  longitude: '',
})

type ColumnConfig = {
  id: string
  label: string
  align?: 'left' | 'center' | 'right'
  defaultVisible: boolean
}

const columns: ColumnConfig[] = [
  { id: 'serial', label: 'No. Série', align: 'center', defaultVisible: true },
  { id: 'substation', label: 'Subestacao', align: 'center', defaultVisible: true },
  { id: 'unit', label: 'Unidade', align: 'center', defaultVisible: true },
  { id: 'tag', label: 'TAG', align: 'center', defaultVisible: true },
  { id: 'equipment', label: 'Equipamento', align: 'center', defaultVisible: false },
  { id: 'commutator', label: 'Comutador', align: 'center', defaultVisible: false },
  { id: 'oilFluid', label: 'Oleo fluido', align: 'center', defaultVisible: false },
  { id: 'primaryVoltage', label: 'T. Primária (kV)', align: 'center', defaultVisible: true },
  { id: 'secondaryVoltage', label: 'T. Secundária (kV)', align: 'center', defaultVisible: false },
  { id: 'year', label: 'Ano de fabricação', align: 'center', defaultVisible: false },
  { id: 'power', label: 'Potencia (kVA)', align: 'center', defaultVisible: true },
  { id: 'manufacturer', label: 'Fabricante', align: 'center', defaultVisible: false },
  { id: 'volume', label: 'Volume em litros', align: 'center', defaultVisible: false },
  { id: 'refrigeration', label: 'Refrigeração', align: 'center', defaultVisible: false },
  { id: 'load', label: 'Carregamento (%)', align: 'center', defaultVisible: false },
  { id: 'operating', label: 'Operando', align: 'center', defaultVisible: false },
  { id: 'sealed', label: 'Selado', align: 'center', defaultVisible: false },
  { id: 'statusTr', label: 'Status TR-Óleo', align: 'center', defaultVisible: true },
  { id: 'analystStatus', label: 'Status Analista', align: 'center', defaultVisible: true },
  { id: 'n1', label: 'N1', align: 'center', defaultVisible: true },
  { id: 'n2', label: 'N2', align: 'center', defaultVisible: true },
  { id: 'n3', label: 'N3', align: 'center', defaultVisible: true },
  { id: 'n4', label: 'N4', align: 'center', defaultVisible: true },
  { id: 'n5', label: 'N5', align: 'center', defaultVisible: true },
  { id: 'latitude', label: 'Latitude', align: 'center', defaultVisible: false },
  { id: 'longitude', label: 'Longitude', align: 'center', defaultVisible: false },
  { id: 'location', label: 'Localização', align: 'center', defaultVisible: true },
  { id: 'actions', label: 'Ações', align: 'center', defaultVisible: true },
]

const visibleColumnIds = ref<string[]>(
  columns.filter((col) => col.defaultVisible).map((col) => col.id)
)

const visibleColumns = computed(() => columns.filter((col) => visibleColumnIds.value.includes(col.id)))

function toggleActions(id: string) {
  openActionId.value = openActionId.value === id ? null : id
}

function locateOnMap(transformer: TableTransformer) {
  openActionId.value = null
  router.push({ name: 'dashboard', query: { transformer: transformer.id } })
}

function openReportSection(transformer: TableTransformer, section: string) {
  openActionId.value = null
  router.push({ name: 'transformer-report', params: { id: transformer.id }, query: { section } })
}

function closeActions() {
  openActionId.value = null
  exportMenuOpen.value = false
  columnsMenuOpen.value = false
  newMenuOpen.value = false
}

function goToPreviousPage() {
  page.value = Math.max(1, page.value - 1)
}

function goToNextPage() {
  page.value = Math.min(totalPages.value, page.value + 1)
}

function toggleExportMenu() {
  exportMenuOpen.value = !exportMenuOpen.value
}

function toggleNewMenu() {
  newMenuOpen.value = !newMenuOpen.value
}

function toggleColumnsMenu() {
  columnsMenuOpen.value = !columnsMenuOpen.value
}

function toggleColumn(id: string) {
  if (visibleColumnIds.value.includes(id)) {
    visibleColumnIds.value = visibleColumnIds.value.filter((item) => item !== id)
    return
  }
  visibleColumnIds.value = [...visibleColumnIds.value, id]
}

function openLocation(transformer: TableTransformer) {
  router.push({ name: 'dashboard', query: { transformer: transformer.id } })
}

function openEditModal(transformer: TableTransformer) {
  openActionId.value = null
  editForm.value = {
    id: transformer.id,
    serial: transformer.serial || '',
    tag: transformer.tag || '',
    substation: transformer.substation || '',
    unit: transformer.unit || '',
    power: transformer.power || '',
    voltage: transformer.voltage || '',
    manufacturer: transformer.manufacturer || '',
    year: transformer.year || '',
    latitude: transformer.latitude || '',
    longitude: transformer.longitude || '',
  }
  editModalOpen.value = true
}

function closeEditModal() {
  editModalOpen.value = false
}

function saveEditModal() {
  if (!editForm.value.id) return
  transformerEdits.value = {
    ...transformerEdits.value,
    [editForm.value.id]: {
      serial: editForm.value.serial || '-',
      tag: editForm.value.tag || '-',
      substation: editForm.value.substation || '-',
      unit: editForm.value.unit || '-',
      power: editForm.value.power || '-',
      voltage: editForm.value.voltage || '-',
      manufacturer: editForm.value.manufacturer || '-',
      year: editForm.value.year || '-',
      latitude: editForm.value.latitude || '-',
      longitude: editForm.value.longitude || '-',
    },
  }
  editModalOpen.value = false
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target) return
  const exportWrap = exportWrapRef.value
  if (exportWrap && !exportWrap.contains(target)) {
    exportMenuOpen.value = false
  }
  const columnsWrap = columnsWrapRef.value
  if (columnsWrap && !columnsWrap.contains(target)) {
    columnsMenuOpen.value = false
  }
  const newWrap = newWrapRef.value
  if (newWrap && !newWrap.contains(target)) {
    newMenuOpen.value = false
  }
  const inActionMenu = !!target.closest('.action-menu')
  const inActionTrigger = !!target.closest('.action-trigger')
  if (!inActionMenu && !inActionTrigger) {
    openActionId.value = null
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})

watch(searchQuery, () => {
  page.value = 1
})

watch(rowsPerPage, () => {
  page.value = 1
})
</script>

<template>
  <div class="transformer-list">
    <SideMenu />
    <AppHeader
      eyebrow="Gestão de Transformadores"
      title="Transformadores"
      subtitle="Ordenados por risco operacional (sem exposição de score)."
      :secondaryAction="{ label: 'Start Óleo', onClick: () => {} }"
      :action="{ label: 'Voltar ao Painel', onClick: () => router.push({ name: 'dashboard' }) }"
    />

    <section class="table-shell" @mouseleave="closeActions">
      <div class="table-head">
        <div class="table-head-left">
          <div class="search-wrap">
            <input
              v-model="searchQuery"
              type="search"
              placeholder="Pesquisar transformador..."
              aria-label="Pesquisar transformador"
            />
          </div>
          <div class="columns-wrap" ref="columnsWrapRef">
            <button type="button" class="ghost-btn columns-btn" @click="toggleColumnsMenu">
              Colunas
            </button>
            <div v-if="columnsMenuOpen" class="columns-menu">
              <label v-for="col in columns" :key="`col-${col.id}`" class="columns-option">
                <input
                  type="checkbox"
                  :checked="visibleColumnIds.includes(col.id)"
                  @change="toggleColumn(col.id)"
                />
                <span>{{ col.label }}</span>
              </label>
            </div>
          </div>
        </div>
        <div class="table-head-right">
          <div class="export-wrap" ref="newWrapRef">
            <button type="button" class="ghost-btn export-btn" @click="toggleNewMenu">
              <span class="btn-icon" aria-hidden="true">＋</span>
              Novo
            </button>
            <div v-if="newMenuOpen" class="export-menu">
              <button type="button">
                <span class="menu-icon" aria-hidden="true">＋</span>
                Novo Transformador
              </button>
              <button type="button">
                <span class="menu-icon" aria-hidden="true">⤴</span>
                Importar Transformadores
              </button>
            </div>
          </div>
          <div class="export-wrap" ref="exportWrapRef">
            <button type="button" class="ghost-btn export-btn" @click="toggleExportMenu">
              <span class="btn-icon" aria-hidden="true">⭳</span>
              Exportar
            </button>
            <div v-if="exportMenuOpen" class="export-menu">
              <button type="button">
                <span class="menu-icon" aria-hidden="true">📄</span>
                Transformadores
              </button>
              <button type="button">
                <span class="menu-icon" aria-hidden="true">📊</span>
                Níveis
              </button>
              <button type="button">
                <span class="menu-icon" aria-hidden="true">📈</span>
                Níveis Variáveis
              </button>
            </div>
          </div>
          <span class="count">{{ orderedTransformers.length }} itens</span>
        </div>
      </div>

      <div class="table-scroll">
        <table class="transformer-table">
          <thead>
            <tr>
              <th
                v-for="col in visibleColumns"
                :key="`head-${col.id}`"
                :class="`text-${col.align || 'center'}`"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in visibleTransformers" :key="item.id" :class="statusTone(item.status)">
              <td
                v-for="col in visibleColumns"
                :key="`${item.id}-${col.id}`"
                :class="`text-${col.align || 'center'}`"
              >
                <template v-if="col.id === 'serial'">{{ item.serial || '-' }}</template>
                <template v-else-if="col.id === 'substation'">{{ item.substation || '-' }}</template>
                <template v-else-if="col.id === 'unit'">{{ item.unit || '-' }}</template>
                <template v-else-if="col.id === 'tag'">{{ item.tag || '-' }}</template>
                <template v-else-if="col.id === 'equipment'">{{ item.equipment || '-' }}</template>
                <template v-else-if="col.id === 'commutator'">{{ item.commutator || '-' }}</template>
                <template v-else-if="col.id === 'oilFluid'">{{ item.oilFluid || '-' }}</template>
                <template v-else-if="col.id === 'primaryVoltage'">{{ item.primaryVoltage || '-' }}</template>
                <template v-else-if="col.id === 'secondaryVoltage'">{{ item.secondaryVoltage || '-' }}</template>
                <template v-else-if="col.id === 'year'">{{ item.year || '-' }}</template>
                <template v-else-if="col.id === 'power'">
                  {{ item.power === '-' ? '-' : item.power.replace('MVA', 'kVA') }}
                </template>
                <template v-else-if="col.id === 'manufacturer'">{{ item.manufacturer || '-' }}</template>
                <template v-else-if="col.id === 'volume'">{{ item.volume || '-' }}</template>
                <template v-else-if="col.id === 'refrigeration'">{{ item.refrigeration || '-' }}</template>
                <template v-else-if="col.id === 'load'">{{ item.load || '-' }}</template>
                <template v-else-if="col.id === 'operating'">{{ item.operating || '-' }}</template>
                <template v-else-if="col.id === 'sealed'">{{ item.sealed || '-' }}</template>
                <template v-else-if="col.id === 'location'">
                  <button type="button" class="ghost-btn locate-btn" @click="openLocation(item)">
                    <svg class="pin-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2c-3.31 0-6 2.69-6 6 0 4.5 6 12 6 12s6-7.5 6-12c0-3.31-2.69-6-6-6zm0 8.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 5.5 12 5.5s2.5 1.12 2.5 2.5S13.38 10.5 12 10.5z"></path>
                    </svg>
                    Localizar
                  </button>
                </template>
                <template v-else-if="col.id === 'statusTr'">
                  <span class="status-pill" :class="statusTone(item.statusTr)">{{ item.statusTr }}</span>
                </template>
                <template v-else-if="col.id === 'analystStatus'">
                  <span class="status-pill" :class="statusTone(item.analystStatus)">{{ item.analystStatus || '-' }}</span>
                </template>
                <template v-else-if="col.id === 'n1'">
                  <span class="level-pill" :class="levelClass(item, 'N1')">
                    {{ levelText(item, 'N1') }}
                  </span>
                </template>
                <template v-else-if="col.id === 'n2'">
                  <span class="level-pill" :class="levelClass(item, 'N2')">
                    {{ levelText(item, 'N2') }}
                  </span>
                </template>
                <template v-else-if="col.id === 'n3'">
                  <span class="level-pill" :class="levelClass(item, 'N3')">
                    {{ levelText(item, 'N3') }}
                  </span>
                </template>
                <template v-else-if="col.id === 'n4'">
                  <span class="level-pill" :class="levelClass(item, 'N4')">
                    {{ levelText(item, 'N4') }}
                  </span>
                </template>
                <template v-else-if="col.id === 'n5'">
                  <span class="level-pill" :class="levelClass(item, 'N5')">
                    {{ levelText(item, 'N5') }}
                  </span>
                </template>
                <template v-else-if="col.id === 'latitude'">{{ item.latitude || '-' }}</template>
                <template v-else-if="col.id === 'longitude'">{{ item.longitude || '-' }}</template>
                <template v-else-if="col.id === 'actions'">
                  <div class="actions-cell text-center">
                    <button class="action-trigger" type="button" @click.stop="toggleActions(item.id)">⋯</button>
                    <div v-if="openActionId === item.id" class="action-menu">
                      <button type="button" class="action-item action-report" @click="openReportSection(item, 'Avaliação Completa')">
                        <span class="action-icon" aria-hidden="true">📄</span>
                        Avaliação Completa
                      </button>
                      <button type="button" class="action-item action-analyze" @click="openReportSection(item, 'Histórico de Análises')">
                        <span class="action-icon" aria-hidden="true">🔍</span>
                        Análises
                      </button>
                      <button type="button" class="action-item action-collect" @click="openReportSection(item, 'Coletas')">
                        <span class="action-icon" aria-hidden="true">📅</span>
                        Coletas
                      </button>
                      <button type="button" class="action-item action-treatment" @click="openReportSection(item, 'Tratamento de Óleo')">
                        <span class="action-icon" aria-hidden="true">🛢</span>
                        Tratamento
                      </button>
                      <button type="button" class="action-item action-edit" @click="openEditModal(item)">
                        <span class="action-icon" aria-hidden="true">✎</span>
                        Editar
                      </button>
                      <button type="button" class="action-item action-remove">
                        <span class="action-icon" aria-hidden="true">🗑</span>
                        Remover
                      </button>
                    </div>
                  </div>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="table-pagination">
        <label class="rows-per-page">
          <span>Itens por página</span>
          <select v-model.number="rowsPerPage">
            <option v-for="size in rowsPerPageOptions" :key="`rows-${size}`" :value="size">
              {{ size }}
            </option>
          </select>
        </label>
        <span class="page-range">{{ pageRangeLabel }}</span>
        <button type="button" class="page-btn" :disabled="page <= 1" @click="goToPreviousPage">
          Anterior
        </button>
        <span class="page-current">Página {{ page }} de {{ totalPages }}</span>
        <button type="button" class="page-btn" :disabled="page >= totalPages" @click="goToNextPage">
          Próxima
        </button>
      </div>
    </section>

    <section class="mobile-cards">
      <article v-for="item in visibleTransformers" :key="`card-${item.id}`" class="card" :class="statusTone(item.status)">
        <div class="card-head">
          <div>
            <strong>{{ item.tag || 'Sem TAG' }}</strong>
            <span>{{ item.serial || item.id }}</span>
          </div>
          <span class="status-pill" :class="statusTone(item.status)">{{ item.status }}</span>
        </div>
        <div class="card-body">
          <div>
            <small>Subestação</small>
            <span>{{ item.substation || '-' }}</span>
          </div>
          <div>
            <small>Potência</small>
            <span>{{ item.power }}</span>
          </div>
          <div>
            <small>Tensão</small>
            <span>{{ item.voltage }}</span>
          </div>
        </div>
        <div class="card-actions">
          <button type="button" @click="locateOnMap(item)">Localizar no mapa</button>
          <button type="button" class="ghost" @click="openReportSection(item, 'Avaliação Completa')">Abrir relatório</button>
        </div>
      </article>
    </section>

    <div v-if="editModalOpen" class="modal-overlay" @click="closeEditModal">
      <div class="modal-card" @click.stop>
        <h4>Editar Transformador</h4>
        <div class="modal-grid">
          <label>
            <span>Serial</span>
            <input v-model="editForm.serial" type="text" />
          </label>
          <label>
            <span>TAG</span>
            <input v-model="editForm.tag" type="text" />
          </label>
          <label class="full">
            <span>Subestação</span>
            <input v-model="editForm.substation" type="text" />
          </label>
          <label>
            <span>Unidade</span>
            <input v-model="editForm.unit" type="text" />
          </label>
          <label>
            <span>Potência</span>
            <input v-model="editForm.power" type="text" />
          </label>
          <label>
            <span>Tensão</span>
            <input v-model="editForm.voltage" type="text" />
          </label>
          <label>
            <span>Fabricante</span>
            <input v-model="editForm.manufacturer" type="text" />
          </label>
          <label>
            <span>Ano</span>
            <input v-model="editForm.year" type="text" />
          </label>
          <label>
            <span>Latitude</span>
            <input v-model="editForm.latitude" type="text" />
          </label>
          <label>
            <span>Longitude</span>
            <input v-model="editForm.longitude" type="text" />
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="modal-btn secondary" @click="closeEditModal">Cancelar</button>
          <button type="button" class="modal-btn primary" @click="saveEditModal">Salvar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.transformer-list{
  min-height: 100vh;
  background: radial-gradient(circle at 20% 20%, #f5f7ff 0%, #f8fafc 45%, #ffffff 100%);
  padding: 32px 32px 60px 96px;
  color: #0f172a;
  overflow-x: hidden;
}


.table-shell{
  border-radius: 20px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: #ffffff;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
  padding: 18px 18px 8px;
}

.table-head{
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: rgba(15, 23, 42, 0.7);
  padding: 0 6px 12px;
}

.table-head-left{
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.table-head-right{
  display: inline-flex;
  align-items: center;
  gap: 12px;
  position: relative;
}

.search-wrap input{
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  padding: 0 14px;
  font-size: 13px;
  min-width: 240px;
  background: rgba(255,255,255,0.8);
}

.columns-wrap{
  position: relative;
}

.columns-btn{
  padding: 8px 16px;
  font-size: 13px;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 999px;
  color: rgba(15, 23, 42, 0.8);
  cursor: pointer;
  background: rgba(255,255,255,0.7);
}

.columns-menu{
  position: absolute;
  left: 0;
  top: 36px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 12px;
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.12);
  display: grid;
  gap: 8px;
  padding: 10px;
  z-index: 6;
  min-width: 220px;
  max-height: min(60vh, 420px);
  overflow: auto;
}

.columns-option{
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.75);
  cursor: pointer;
}

.columns-option input{
  accent-color: #1e4e8b;
}

.export-wrap{
  position: relative;
}

.export-btn{
  padding: 8px 16px;
  font-size: 13px;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 999px;
  color: rgba(15, 23, 42, 0.8);
  cursor: pointer;
  background: rgba(255,255,255,0.7);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-icon{
  font-size: 12px;
}

.locate-btn{
  padding: 8px 16px;
  font-size: 13px;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 999px;
  color: rgba(15, 23, 42, 0.8);
  cursor: pointer;
  background: rgba(255,255,255,0.7);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pin-icon{
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.export-menu{
  position: absolute;
  right: 0;
  top: 36px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 12px;
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.12);
  display: grid;
  gap: 6px;
  padding: 8px;
  z-index: 5;
  min-width: 180px;
}

.export-menu button{
  border: none;
  background: rgba(15, 23, 42, 0.04);
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.menu-icon{
  font-size: 12px;
}

.table-scroll{
  overflow-x: auto;
  overflow-y: visible;
}

.transformer-table{
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-weight: 500;
}

.transformer-table th,
.transformer-table td{
  padding: 12px 10px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  text-align: center;
  font-weight: 500;
}

.transformer-table .text-center{
  text-align: center;
}
.transformer-table .text-right{
  text-align: center;
}
.transformer-table .text-left{
  text-align: center;
}

.transformer-table th{
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(15, 23, 42, 0.6);
  background: rgba(15, 23, 42, 0.015);
  position: sticky;
  top: 0;
  z-index: 2;
}

.cell-main{
  display: grid;
  gap: 2px;
}

.cell-main span{
  font-size: 12px;
  color: rgba(15, 23, 42, 0.6);
}

.status-pill{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.level-pill{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 46px;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.7);
}

.level-empty{
  background: rgba(148, 163, 184, 0.18);
  color: rgba(15, 23, 42, 0.55);
}

.level-very-low{
  background: #22c55e;
  color: #ffffff;
}

.level-low{
  background: #84cc16;
  color: #365314;
}

.level-medium{
  background: #eab308;
  color: #78350f;
}

.level-high{
  background: #f97316;
  color: #ffffff;
}

.level-critical{
  background: #ef4444;
  color: #ffffff;
}

.tone-normal{
  background: rgba(34, 197, 94, 0.12);
  color: #166534;
}

.status-pill.tone-normal{
  background: #22c55e;
  color: #ffffff;
}

.tone-warning{
  background: rgba(234, 179, 8, 0.16);
  color: #854d0e;
}

.tone-danger{
  background: rgba(239, 68, 68, 0.12);
  color: #991b1b;
}

.tone-neutral{
  background: rgba(148, 163, 184, 0.18);
  color: #475569;
}

.status-pill.tone-warning{
  background: #eab308;
  color: #422006;
}

.status-pill.tone-danger{
  background: #ef4444;
  color: #ffffff;
}

.status-pill.tone-neutral{
  background: #94a3b8;
  color: #0f172a;
}

.transformer-table tr.tone-normal td:first-child,
.transformer-table tr.tone-warning td:first-child,
.transformer-table tr.tone-danger td:first-child,
.transformer-table tr.tone-neutral td:first-child{
  position: relative;
}

.transformer-table tr.tone-normal td:first-child::before,
.transformer-table tr.tone-warning td:first-child::before,
.transformer-table tr.tone-danger td:first-child::before,
.transformer-table tr.tone-neutral td:first-child::before{
  content: '';
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 3px;
  border-radius: 999px;
}

.transformer-table tr.tone-normal td:first-child::before{ background: #22c55e; }
.transformer-table tr.tone-warning td:first-child::before{ background: #f59f00; }
.transformer-table tr.tone-danger td:first-child::before{ background: #dc2626; }
.transformer-table tr.tone-neutral td:first-child::before{ background: #94a3b8; }

.actions-cell{
  position: relative;
}

.action-trigger{
  border: 1px solid rgba(15, 23, 42, 0.15);
  background: #fff;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  cursor: pointer;
}

.action-menu{
  position: absolute;
  right: 0;
  top: 40px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 12px;
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.12);
  display: grid;
  gap: 6px;
  padding: 8px;
  z-index: 5;
  min-width: 160px;
}

.action-menu button{
  border: none;
  background: rgba(15, 23, 42, 0.04);
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}

.action-item{
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.action-icon{
  font-size: 12px;
}

.action-edit{
  color: #1e4e8b;
}

.action-remove{
  color: #dc2626;
}

.action-report{
  color: rgba(15, 23, 42, 0.8);
}

.action-analyze{
  color: #1d4ed8;
}

.action-collect{
  color: #0f766e;
}

.action-treatment{
  color: #b45309;
}

.table-pagination{
  margin-top: 12px;
  padding: 8px 6px 6px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.rows-per-page{
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.rows-per-page span{
  font-size: 11px;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.72);
}

.rows-per-page select{
  height: 30px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  background: #fff;
  color: rgba(15, 23, 42, 0.8);
  font-size: 12px;
  padding: 0 8px;
}

.page-range,
.page-current{
  font-size: 12px;
  color: rgba(15, 23, 42, 0.75);
}

.page-btn{
  height: 30px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.9);
  color: rgba(15, 23, 42, 0.82);
  font-size: 12px;
  font-weight: 600;
  padding: 0 10px;
  cursor: pointer;
}

.page-btn:disabled{
  opacity: 0.5;
  cursor: not-allowed;
}

.mobile-cards{
  display: none;
}

.modal-overlay{
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.52);
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 20px;
}

.modal-card{
  width: min(760px, 100%);
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: #fff;
  box-shadow: 0 24px 50px rgba(15, 23, 42, 0.2);
  padding: 16px;
}

.modal-card h4{
  margin: 0 0 12px;
}

.modal-grid{
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.modal-grid label{
  display: grid;
  gap: 6px;
}

.modal-grid label span{
  font-size: 12px;
  color: rgba(15, 23, 42, 0.72);
  font-weight: 600;
}

.modal-grid input{
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  padding: 0 10px;
  font-size: 13px;
}

.modal-grid .full{
  grid-column: 1 / -1;
}

.modal-actions{
  margin-top: 14px;
  display: inline-flex;
  gap: 8px;
}

.modal-btn{
  height: 34px;
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 0 14px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.modal-btn.secondary{
  background: rgba(15, 23, 42, 0.06);
  color: rgba(15, 23, 42, 0.8);
  border-color: rgba(15, 23, 42, 0.12);
}

.modal-btn.primary{
  background: #1e4e8b;
  color: #fff;
}

@media (max-width: 900px){
  .transformer-list{
    padding: 90px 16px 40px;
  }
  .table-shell{
    display: none;
  }
  .mobile-cards{
    display: grid;
    gap: 14px;
  }
  .modal-grid{
    grid-template-columns: 1fr;
  }
  .modal-grid .full{
    grid-column: auto;
  }
  .card{
    border-radius: 16px;
    background: #fff;
    border: 1px solid rgba(15, 23, 42, 0.08);
    padding: 14px;
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
  }
  .card-head{
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .card-head span{
    color: rgba(15, 23, 42, 0.6);
    font-size: 12px;
  }
  .card-body{
    display: grid;
    gap: 8px;
  }
  .card-body small{
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.1em;
    color: rgba(15, 23, 42, 0.45);
  }
  .card-body span{
    font-size: 13px;
    font-weight: 600;
  }
  .card-actions{
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
  .card-actions button{
    flex: 1;
    border-radius: 10px;
    border: 1px solid rgba(15, 23, 42, 0.12);
    background: #1e4e8b;
    color: #fff;
    padding: 8px 10px;
    font-size: 12px;
  }
  .card-actions .ghost{
    background: #fff;
    color: #1e4e8b;
  }
}
</style>
