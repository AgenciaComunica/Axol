<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SideMenu from '@/components/SideMenu.vue'
import AppHeader from '@/components/AppHeader.vue'
import transformersData from '@/assets/transformadores.json'
import oltcData from '../../ArquivoExtRef/oltc.json'
import cromatografiasRaw from '../../ArquivoExtRef/cromatografias.json?raw'
import fisicoQuimicosRaw from '../../ArquivoExtRef/fisicoquimicos.json?raw'
import fisicoQuimicosOltcRaw from '../../ArquivoExtRef/fisicoquimicos_oltc.json?raw'
import VueApexCharts from 'vue3-apexcharts'
import type { ApexOptions } from 'apexcharts'

type BaseRow = Record<string, unknown>
type Transformer = {
  id: string
  serial: string
  tag: string
  substation: string
  reference: string
  unit: string
  status: string
  statusAnalyst: string
  oilStatus: string
  treatment: string
  power: string
  voltage: string
  equipment: string
  commutator: string
  oilFluid: string
  year: string
  manufacturer: string
  volume: string
  refrigeration: string
  load: string
  operating: string
  sealed: string
  analyst: string
  analystNote: string
  failureMode: string
  latitude: string
  longitude: string
}

type SpecialistOverride = {
  statusAnalyst: string
  analystNote: string
  failureMode: string
}

const route = useRoute()
const router = useRouter()
const rawSubstations = (transformersData as any)?.subestacoes || []

function normalizeStatus(raw?: string) {
  if (!raw) return 'Normal'
  const value = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (value.includes('crit')) return 'Crítico'
  if (value.includes('alert') || value.includes('ainda')) return 'Alerta'
  return 'Normal'
}

function toUiDate(value: string) {
  if (!value) return '-'
  if (value.includes('/')) return value
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('pt-BR')
}

function parseLooseJson<T = BaseRow[]>(raw: string): T {
  const safe = raw.replace(/\bNULL\b/g, 'null')
  return JSON.parse(safe) as T
}

function parseBrDate(value: unknown) {
  const text = String(value || '')
  const parts = text.split('/')
  if (parts.length !== 3) return 0
  const day = Number(parts[0])
  const month = Number(parts[1])
  const year = Number(parts[2])
  if (!day || !month || !year) return 0
  return new Date(year, month - 1, day).getTime()
}

const tabs = [
  'Avaliação Completa',
  'Histórico de Análises',
  'Avaliação IEEE',
  'Próximas Coletas',
  'Tratamento de Óleo',
  'Cadastro OLTC',
  'Cromatografias',
  'Físicos Químicos',
  'Ensaios Especiais',
] as const

type ReportTab = (typeof tabs)[number]

function toValidTab(value: unknown): ReportTab {
  const text = String(value || '')
  return (tabs.find((tab) => tab === text) as ReportTab) || 'Avaliação Completa'
}

const activeTab = ref<ReportTab>(toValidTab(route.query.section))

const transformerOptions = computed<Transformer[]>(() => {
  return rawSubstations.flatMap((substation: any) => {
    const name = substation?.NOME || substation?.SUBESTACAO || 'Subestação'
    const reference = substation?.REFERENCIA || '-'
    return (substation?.transformadores || []).map((trafo: any) => ({
      id: trafo?.TAG ? `${trafo.TAG}-${trafo.SERIAL}` : String(trafo?.SERIAL || ''),
      serial: String(trafo?.SERIAL || '-'),
      tag: String(trafo?.TAG || '-'),
      substation: String(trafo?.SUBESTACAO || name),
      reference: String(reference),
      unit: String(trafo?.UNIDADE || '-'),
      status: normalizeStatus(trafo?.ESTADO),
      statusAnalyst: normalizeStatus(trafo?.ESTADO_ANALISTA),
      oilStatus: String(trafo?.ESTADO_TRATAMENTO || '-'),
      treatment: String(trafo?.ESTADO_TRATAMENTO || '-'),
      power: trafo?.POTENCIA ? `${trafo.POTENCIA} MVA` : '-',
      voltage: trafo?.T_MAIOR ? `${trafo.T_MAIOR} kV` : '-',
      equipment: String(trafo?.EQUIPAMENTO || '-'),
      commutator: String(trafo?.COMUTADOR || '-'),
      oilFluid: String(trafo?.OLEO_FLUIDO || '-'),
      year: String(trafo?.ANO_FABRICACAO || '-'),
      manufacturer: String(trafo?.FABRICANTE || '-'),
      volume: String(trafo?.VOLUME || '-'),
      refrigeration: String(trafo?.REFRIGERACAO || '-'),
      load: String(trafo?.CARREGAMENTO || '-'),
      operating: String(trafo?.OPERANDO || '-'),
      sealed: String(trafo?.SELADO || '-'),
      analyst: String(trafo?.ANALISTA || '-'),
      analystNote: String(trafo?.DESCRICAO_ANALISTA || '-'),
      failureMode: String(trafo?.MODO_FALHA || '-'),
      latitude: String(trafo?.LATITUDE || '-'),
      longitude: String(trafo?.LONGITUDE || '-'),
    }))
  })
})

const selectedId = ref(String(route.params.id || ''))

watch(
  transformerOptions,
  (items) => {
    if (!items.length) return
    if (!selectedId.value || !items.some((item) => item.id === selectedId.value)) {
      selectedId.value = items[0].id
    }
  },
  { immediate: true }
)

watch(
  () => route.params.id,
  (value) => {
    if (!value) return
    selectedId.value = String(value)
  }
)

watch(
  () => route.query.section,
  (value) => {
    activeTab.value = toValidTab(value)
  }
)

watch(selectedId, (value) => {
  if (!value || String(route.params.id || '') === value) return
  router.replace({ name: 'transformer-report', params: { id: value }, query: { section: activeTab.value } })
})

watch(activeTab, (value) => {
  if (String(route.query.section || '') === value) return
  router.replace({
    name: 'transformer-report',
    params: { id: selectedId.value || String(route.params.id || '') },
    query: { section: value },
  })
})

const selectedTransformer = computed(
  () => transformerOptions.value.find((item) => item.id === selectedId.value) || null
)

const specialistEdits = ref<Record<string, SpecialistOverride>>({})
const specialistModalOpen = ref(false)
const analystStatusOptions = ['Normal', 'Alerta', 'Crítico', 'Pendente']
const failureModeOptions = [
  'Degradação por pirólise do Óleo Isolante do Transformador',
  'Descargas parciais',
  'Falha térmica de baixa energia',
  'Falha térmica de alta energia',
  'Sem modo de falha definido',
]
const specialistForm = ref<SpecialistOverride>({
  statusAnalyst: 'Pendente',
  analystNote: '',
  failureMode: '',
})

const specialistView = computed<SpecialistOverride>(() => {
  const base = selectedTransformer.value
  const override = selectedId.value ? specialistEdits.value[selectedId.value] : undefined
  return {
    statusAnalyst: override?.statusAnalyst || base?.statusAnalyst || 'Pendente',
    analystNote: override?.analystNote || base?.analystNote || 'Sem observações registradas.',
    failureMode:
      override?.failureMode ||
      base?.failureMode ||
      'Degradação por pirólise do Óleo Isolante do Transformador',
  }
})

function openSpecialistModal() {
  if (!selectedTransformer.value) return
  specialistForm.value = {
    statusAnalyst: specialistView.value.statusAnalyst,
    analystNote:
      specialistView.value.analystNote === 'Sem observações registradas.'
        ? ''
        : specialistView.value.analystNote,
    failureMode: specialistView.value.failureMode,
  }
  specialistModalOpen.value = true
}

function closeSpecialistModal() {
  specialistModalOpen.value = false
}

function saveSpecialistModal() {
  if (!selectedId.value) return
  specialistEdits.value[selectedId.value] = {
    statusAnalyst: specialistForm.value.statusAnalyst || 'Pendente',
    analystNote: specialistForm.value.analystNote?.trim() || 'Sem observações registradas.',
    failureMode:
      specialistForm.value.failureMode || 'Degradação por pirólise do Óleo Isolante do Transformador',
  }
  specialistModalOpen.value = false
}

const cromatografiasRows = computed(() => {
  const data = parseLooseJson<BaseRow[]>(cromatografiasRaw)
  return [...data]
    .sort((a, b) => parseBrDate(b.DATA_COLETA) - parseBrDate(a.DATA_COLETA))
    .slice(0, 8)
})

const latestCromatografiaRow = computed<BaseRow | null>(() => {
  const data = parseLooseJson<BaseRow[]>(cromatografiasRaw)
  return [...data].sort((a, b) => parseBrDate(b.DATA_COLETA) - parseBrDate(a.DATA_COLETA))[0] || null
})

const fisicoRows = computed(() => {
  const data = parseLooseJson<BaseRow[]>(fisicoQuimicosRaw)
  return [...data]
    .sort((a, b) => parseBrDate(b.DATA_COLETA) - parseBrDate(a.DATA_COLETA))
    .slice(0, 8)
})

const fisicoOltcRows = computed(() => {
  const data = parseLooseJson<BaseRow[]>(fisicoQuimicosOltcRaw)
  return [...data]
    .sort((a, b) => parseBrDate(b.DATA_COLETA) - parseBrDate(a.DATA_COLETA))
    .slice(0, 8)
})

const historyRows = computed(() => {
  const byYear = new Map<number, { year: number; cromatografias: number; fisicoQuimicos: number; fisicoOltc: number }>()

  const add = (year: number, field: 'cromatografias' | 'fisicoQuimicos' | 'fisicoOltc') => {
    if (!year) return
    if (!byYear.has(year)) {
      byYear.set(year, { year, cromatografias: 0, fisicoQuimicos: 0, fisicoOltc: 0 })
    }
    byYear.get(year)![field] += 1
  }

  parseLooseJson<BaseRow[]>(cromatografiasRaw).forEach((row) => {
    const time = parseBrDate(row.DATA_COLETA)
    if (!time) return
    add(new Date(time).getFullYear(), 'cromatografias')
  })

  parseLooseJson<BaseRow[]>(fisicoQuimicosRaw).forEach((row) => {
    const time = parseBrDate(row.DATA_COLETA)
    if (!time) return
    add(new Date(time).getFullYear(), 'fisicoQuimicos')
  })

  parseLooseJson<BaseRow[]>(fisicoQuimicosOltcRaw).forEach((row) => {
    const time = parseBrDate(row.DATA_COLETA)
    if (!time) return
    add(new Date(time).getFullYear(), 'fisicoOltc')
  })

  return [...byYear.values()].sort((a, b) => a.year - b.year)
})

type HistorySeriesDef = { key: string; label: string; color: string }
type HistoryChartSeries = { name: string; data: number[] }
type HistoryChartData = { max: number; categories: string[]; series: HistoryChartSeries[]; colors: string[] }
type HistoryChartTab = 'cromatografia' | 'fisicoquimica' | 'ensaiosespeciais'
type HistoryDisplayMode = 'base' | 'historico'

const historyActiveTab = ref<HistoryChartTab>('cromatografia')
const historyCromDisplayMode = ref<HistoryDisplayMode>('base')
const historyFisicoDisplayMode = ref<HistoryDisplayMode>('base')

const cromatografiaSeriesDefs: HistorySeriesDef[] = [
  { key: 'MONOX_CARBONO', label: 'CO', color: '#008ffb' },
  { key: 'HIDROGENIO', label: 'H2', color: '#00e396' },
  { key: 'OXIGENIO', label: 'O2', color: '#feb019' },
  { key: 'NITROGENIO', label: 'N2', color: '#ff4560' },
  { key: 'METANO', label: 'CH4', color: '#775dd0' },
  { key: 'DIOX_CARBONO', label: 'CO2', color: '#546e7a' },
  { key: 'ETILENO', label: 'C2H4', color: '#1e88e5' },
  { key: 'ETANO', label: 'C2H6', color: '#f9a825' },
  { key: 'ACETILENO', label: 'C2H2', color: '#ef5350' },
  { key: 'TOTAL_GASES_COMB', label: 'TGC', color: '#3949ab' },
]

const fisicoSeriesDefs: HistorySeriesDef[] = [
  { key: 'TEOR_AGUA', label: 'Água', color: '#0ea5e9' },
  { key: 'RD', label: 'RD', color: '#22c55e' },
  { key: 'TENSAO_INTERFACIAL', label: 'TIF', color: '#f59e0b' },
  { key: 'IND_NEUTRALIZACAO ', label: 'IN', color: '#ef4444' },
  { key: 'COR', label: 'Cor', color: '#8b5cf6' },
]

const ensaiosSeriesDefs: HistorySeriesDef[] = [
  { key: 'TEOR_AGUA', label: 'Água', color: '#0ea5e9' },
  { key: 'RD', label: 'RD', color: '#22c55e' },
  { key: 'TENSAO_INTERFACIAL', label: 'TIF', color: '#f59e0b' },
  { key: 'FATOR_POT_100', label: 'FP100', color: '#ef4444' },
]

const cromatografiasChartRows = computed(() => {
  const data = parseLooseJson<BaseRow[]>(cromatografiasRaw)
  return [...data]
    .sort((a, b) => parseBrDate(a.DATA_COLETA) - parseBrDate(b.DATA_COLETA))
    .slice(-40)
})

const fisicoChartRows = computed(() => {
  const data = parseLooseJson<BaseRow[]>(fisicoQuimicosRaw)
  return [...data]
    .sort((a, b) => parseBrDate(a.DATA_COLETA) - parseBrDate(b.DATA_COLETA))
    .slice(-40)
})

const ensaiosChartRows = computed(() => {
  const data = parseLooseJson<BaseRow[]>(fisicoQuimicosOltcRaw)
  return [...data]
    .sort((a, b) => parseBrDate(a.DATA_COLETA) - parseBrDate(b.DATA_COLETA))
    .slice(-40)
})

function toSeriesValues(rows: BaseRow[], key: string) {
  return rows.map((row) => {
    const raw = row[key]
    const value = Number(raw ?? 0)
    return Number.isFinite(value) ? value : 0
  })
}

function buildHistoryChartData(rows: BaseRow[], defs: HistorySeriesDef[], mode: HistoryDisplayMode): HistoryChartData {
  const categories = rows.map((row) => toUiDate(String(row.DATA_COLETA || '')))
  const transformedByKey = new Map<string, number[]>()
  defs.forEach((def) => {
    const values = toSeriesValues(rows, def.key)
    if (mode === 'base') {
      transformedByKey.set(def.key, values)
      return
    }
    const peak = Math.max(1, ...values)
    transformedByKey.set(
      def.key,
      values.map((value) => Number(((value / peak) * 100).toFixed(1)))
    )
  })

  const globalMax = Math.max(1, ...defs.flatMap((def) => transformedByKey.get(def.key) || [0]))
  const series = defs.map((def) => {
    const values = transformedByKey.get(def.key) || []
    return { name: def.label, data: values }
  })

  return { max: globalMax, categories, series, colors: defs.map((def) => def.color) }
}

const historyCromMultiModel = computed(() =>
  buildHistoryChartData(cromatografiasChartRows.value, cromatografiaSeriesDefs, historyCromDisplayMode.value)
)
const historyFisicoMultiModel = computed(() =>
  buildHistoryChartData(fisicoChartRows.value, fisicoSeriesDefs, historyFisicoDisplayMode.value)
)
const historyEnsaiosMultiModel = computed(() =>
  buildHistoryChartData(ensaiosChartRows.value, ensaiosSeriesDefs, 'base')
)

const activeHistoryModel = computed(() => {
  if (historyActiveTab.value === 'fisicoquimica') return historyFisicoMultiModel.value
  if (historyActiveTab.value === 'ensaiosespeciais') return historyEnsaiosMultiModel.value
  return historyCromMultiModel.value
})

const historyChartOptions = computed<ApexOptions>(() => ({
  chart: {
    type: 'line',
    animations: { enabled: true },
    toolbar: { show: true },
    zoom: { enabled: true },
    foreColor: '#334155',
    redrawOnParentResize: true,
    redrawOnWindowResize: true,
  },
  stroke: {
    curve: 'straight',
    width: 2,
  },
  colors: activeHistoryModel.value.colors,
  legend: {
    show: true,
    position: 'bottom',
    horizontalAlign: 'center',
    fontSize: '12px',
  },
  dataLabels: { enabled: false },
  markers: { size: 0, hover: { sizeOffset: 3 } },
  grid: { borderColor: 'rgba(15, 23, 42, 0.12)' },
  xaxis: {
    categories: activeHistoryModel.value.categories,
    labels: {
      rotate: -45,
      hideOverlappingLabels: true,
      trim: true,
    },
  },
  yaxis: {
    min: 0,
    max: activeHistoryModel.value.max > 0 ? Math.ceil(activeHistoryModel.value.max * 1.1) : 1,
    forceNiceScale: true,
  },
  tooltip: {
    shared: true,
    intersect: false,
  },
}))

const historyChartKey = computed(() => {
  const mode =
    historyActiveTab.value === 'cromatografia'
      ? historyCromDisplayMode.value
      : historyActiveTab.value === 'fisicoquimica'
        ? historyFisicoDisplayMode.value
        : 'base'
  return `${activeTab.value}-${historyActiveTab.value}-${mode}-${activeHistoryModel.value.series.length}-${activeHistoryModel.value.categories.length}`
})

const showHistorySwitch = computed(() => historyActiveTab.value !== 'ensaiosespeciais')
const historySwitchLabel = computed(() =>
  historyActiveTab.value === 'cromatografia' ? 'Histórico de Gases Combustíveis (un)' : 'Histórico (un)'
)
const historySwitchEnabled = computed({
  get() {
    if (historyActiveTab.value === 'cromatografia') return historyCromDisplayMode.value === 'historico'
    if (historyActiveTab.value === 'fisicoquimica') return historyFisicoDisplayMode.value === 'historico'
    return false
  },
  set(enabled: boolean) {
    if (historyActiveTab.value === 'cromatografia') {
      historyCromDisplayMode.value = enabled ? 'historico' : 'base'
      return
    }
    if (historyActiveTab.value === 'fisicoquimica') {
      historyFisicoDisplayMode.value = enabled ? 'historico' : 'base'
    }
  },
})

function ieeeCondition(value: number, c1: number, c2: number, c3: number) {
  if (value <= c1) return 'Condição 01'
  if (value <= c2) return 'Condição 02'
  if (value <= c3) return 'Condição 03'
  return 'Condição 04'
}

function numericValue(row: BaseRow | null, key: string) {
  if (!row) return 0
  const value = Number(row[key] ?? 0)
  return Number.isFinite(value) ? value : 0
}

const cromatografiaConditions = computed(() => {
  const row = latestCromatografiaRow.value
  const h2 = numericValue(row, 'HIDROGENIO')
  const ch4 = numericValue(row, 'METANO')
  const c2h2 = numericValue(row, 'ACETILENO')
  const c2h4 = numericValue(row, 'ETILENO')
  const c2h6 = numericValue(row, 'ETANO')
  const co = numericValue(row, 'MONOX_CARBONO')
  const co2 = numericValue(row, 'DIOX_CARBONO')
  const tgc = numericValue(row, 'TOTAL_GASES_COMB')
  return {
    h2: ieeeCondition(h2, 100, 700, 1800),
    ch4: ieeeCondition(ch4, 120, 400, 1000),
    c2h2: ieeeCondition(c2h2, 1, 9, 35),
    c2h4: ieeeCondition(c2h4, 50, 100, 200),
    c2h6: ieeeCondition(c2h6, 65, 100, 150),
    co: ieeeCondition(co, 350, 570, 1400),
    co2: ieeeCondition(co2, 2500, 4000, 10000),
    tgc: ieeeCondition(tgc, 720, 1920, 4630),
  }
})

const oltcRows = computed(() => {
  const serial = selectedTransformer.value?.serial
  if (!serial) return []
  const rows = ((oltcData as any)?.oltc || []).filter(
    (row: any) => String(row.SERIAL_TRANSFORMADOR || '') === serial
  )
  return rows
})

const nextCollections = computed(() => {
  if (!selectedTransformer.value) return []
  const base = new Date()
  const status = selectedTransformer.value.status
  const offsets =
    status === 'Crítico' ? [3, 7, 15] : status === 'Alerta' ? [7, 15, 30] : [15, 30, 60]
  return offsets.map((days, index) => {
    const date = new Date(base)
    date.setDate(base.getDate() + days)
    return {
      id: `${selectedTransformer.value?.id}-next-${index}`,
      type: index === 0 ? 'Cromatografia' : index === 1 ? 'Físico-Químico' : 'Inspeção Especial',
      scheduledAt: date.toISOString(),
      priority: index === 0 ? 'Alta' : index === 1 ? 'Média' : 'Planejada',
      responsible: selectedTransformer.value?.analyst || 'Equipe SIARO',
    }
  })
})

const oilTreatments = computed(() => {
  if (!selectedTransformer.value) return []
  const now = new Date()
  return [
    {
      title: selectedTransformer.value.treatment || 'Sem tratamento informado',
      at: new Date(now.getFullYear(), now.getMonth() - 2, 10).toISOString(),
      status: selectedTransformer.value.status,
      notes:
        selectedTransformer.value.status === 'Crítico'
          ? 'Acompanhamento intensivo recomendado.'
          : 'Monitoramento de rotina com validação do analista.',
    },
    {
      title: 'Revisão de parâmetros de óleo',
      at: new Date(now.getFullYear(), now.getMonth() - 6, 21).toISOString(),
      status: 'Concluído',
      notes: 'Parâmetros dentro do intervalo de referência da equipe técnica.',
    },
  ]
})

const specialTests = computed(() => {
  if (!selectedTransformer.value) return []
  const failure = selectedTransformer.value.failureMode
  return [
    {
      name: 'Descarga parcial',
      result: selectedTransformer.value.status === 'Crítico' ? 'Acima do limite' : 'Dentro do limite',
      recommendation:
        selectedTransformer.value.status === 'Crítico'
          ? 'Executar intervenção imediata e nova coleta em curto prazo.'
          : 'Manter frequência padrão de inspeção.',
    },
    {
      name: 'Termografia',
      result: selectedTransformer.value.statusAnalyst === 'Alerta' ? 'Ponto de atenção' : 'Estável',
      recommendation:
        failure && failure !== '-'
          ? failure
          : 'Sem observações críticas adicionais no cenário atual.',
    },
  ]
})

const riskProbabilities = computed(() => {
  const status = normalizeStatus(selectedTransformer.value?.statusAnalyst || selectedTransformer.value?.status || '')
  if (status === 'Crítico') return [8.5, 12.2, 19.8, 27.5, 32.0]
  if (status === 'Alerta') return [0, 0, 85.14, 14.86, 0]
  return [100, 0, 0, 0, 0]
})

const oilVariablesByLevel = computed(() => {
  const base = riskProbabilities.value
  const labels = ['TEMP', 'H2O', 'TIF', 'RD', 'EC', 'H2', 'DBDS', 'CARRE', 'GP', 'DGAF', 'CO', 'CO2', 'C2h4', 'C2H2']
  return base.map((value, index) => {
    const scale = Math.max(value, 8)
    const vars = labels.map((_, labelIndex) => {
      const ratio = 0.15 + ((labelIndex % 7) * 0.06) + index * 0.015
      return Number((scale * ratio).toFixed(2))
    })
    return {
      title: `Nível-${index + 1}`,
      labels,
      vars,
      max: Math.max(...vars, 1),
    }
  })
})

function statusClass(value: string) {
  const text = (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (text.includes('crit')) return 'tone-danger'
  if (text.includes('alert') || text.includes('alta')) return 'tone-warning'
  if (text.includes('pend')) return 'tone-neutral'
  return 'tone-normal'
}

function statusOptionStyle(value: string) {
  const tone = statusClass(value)
  if (tone === 'tone-danger') return { color: '#b91c1c', backgroundColor: 'rgba(220, 38, 38, 0.12)', fontWeight: '700' }
  if (tone === 'tone-warning') return { color: '#b45309', backgroundColor: 'rgba(245, 158, 11, 0.14)', fontWeight: '700' }
  if (tone === 'tone-neutral') return { color: '#475569', backgroundColor: 'rgba(148, 163, 184, 0.16)', fontWeight: '700' }
  return { color: '#15803d', backgroundColor: 'rgba(22, 163, 74, 0.12)', fontWeight: '700' }
}

function enhanceMobileTables() {
  if (typeof window === 'undefined') return
  const tables = Array.from(document.querySelectorAll('.report-shell table.table')) as HTMLTableElement[]
  const isMobile = window.innerWidth <= 900

  tables.forEach((table) => {
    if (!isMobile) {
      table.classList.remove('mobile-card-table')
      table.querySelectorAll('tbody td').forEach((cell) => {
        cell.removeAttribute('data-label')
      })
      return
    }

    table.classList.add('mobile-card-table')
    const headerRows = Array.from(table.querySelectorAll('thead tr'))
    let headerTexts: string[] = []
    headerRows.forEach((row) => {
      const ths = Array.from(row.querySelectorAll('th'))
      const normalized = ths
        .filter((th) => (Number(th.getAttribute('colspan') || '1') === 1))
        .map((th) => (th.textContent || '').trim())
        .filter(Boolean)
      if (normalized.length > headerTexts.length) headerTexts = normalized
    })

    table.querySelectorAll('tbody tr').forEach((row) => {
      const tds = Array.from(row.querySelectorAll('td'))
      tds.forEach((cell, index) => {
        const label = headerTexts[index] || `Campo ${index + 1}`
        cell.setAttribute('data-label', label)
      })
    })
  })
}

onMounted(async () => {
  await nextTick()
  enhanceMobileTables()
  window.addEventListener('resize', enhanceMobileTables)
})

onUnmounted(() => {
  window.removeEventListener('resize', enhanceMobileTables)
})

watch([activeTab, selectedId], async () => {
  await nextTick()
  enhanceMobileTables()
  if (activeTab.value === 'Histórico de Análises' && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('resize'))
  }
})
</script>

<template>
  <div class="report-view">
    <SideMenu />
    <AppHeader
      eyebrow="Relatórios de Transformadores"
      title="Relatório Consolidado"
      subtitle="Visualização única com dados do transformador e módulos técnicos."
      :secondaryAction="{ label: 'Start Óleo', onClick: () => {} }"
      :action="{ label: 'Voltar ao Painel', onClick: () => router.push({ name: 'dashboard' }) }"
    />

    <section class="report-shell">
      <div class="report-toolbar">
        <div class="selector">
          <label for="trafo-select">Selecionar transformador</label>
          <select id="trafo-select" v-model="selectedId">
            <option v-for="item in transformerOptions" :key="item.id" :value="item.id">
              {{ item.id }} • {{ item.substation }}
            </option>
          </select>
        </div>
        <button
          type="button"
          class="locate-btn"
          :disabled="!selectedTransformer"
          @click="selectedTransformer && router.push({ name: 'dashboard', query: { transformer: selectedTransformer.id } })"
        >
          <svg class="pin-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2c-3.31 0-6 2.69-6 6 0 4.5 6 12 6 12s6-7.5 6-12c0-3.31-2.69-6-6-6zm0 8.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 5.5 12 5.5s2.5 1.12 2.5 2.5S13.38 10.5 12 10.5z"></path>
          </svg>
          Localizar
        </button>
      </div>

      <div v-if="selectedTransformer" class="summary-grid">
        <article class="summary-card">
          <h3>{{ selectedTransformer.id }}</h3>
          <p>{{ selectedTransformer.substation }} • {{ selectedTransformer.reference }}</p>
          <div class="pill-row">
            <span class="pill" :class="statusClass(selectedTransformer.status)">
              Status TR-Óleo: {{ selectedTransformer.status }}
            </span>
            <span class="pill" :class="statusClass(selectedTransformer.statusAnalyst)">
              Status Analista: {{ selectedTransformer.statusAnalyst }}
            </span>
          </div>
        </article>

        <article class="summary-card">
          <h4>Dados principais</h4>
          <div class="info-grid">
            <div><small>Serial</small><b>{{ selectedTransformer.serial }}</b></div>
            <div><small>TAG</small><b>{{ selectedTransformer.tag }}</b></div>
            <div><small>Potência</small><b>{{ selectedTransformer.power }}</b></div>
            <div><small>Tensão</small><b>{{ selectedTransformer.voltage }}</b></div>
            <div><small>Fabricante</small><b>{{ selectedTransformer.manufacturer }}</b></div>
            <div><small>Ano</small><b>{{ selectedTransformer.year }}</b></div>
            <div><small>Comutador</small><b>{{ selectedTransformer.commutator }}</b></div>
            <div><small>Óleo fluido</small><b>{{ selectedTransformer.oilFluid }}</b></div>
            <div><small>Volume</small><b>{{ selectedTransformer.volume }}</b></div>
            <div><small>Refrigeração</small><b>{{ selectedTransformer.refrigeration }}</b></div>
            <div><small>Latitude</small><b>{{ selectedTransformer.latitude }}</b></div>
            <div><small>Longitude</small><b>{{ selectedTransformer.longitude }}</b></div>
          </div>
        </article>
      </div>

      <nav class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab"
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === tab }"
          @click="activeTab = tab"
        >
          {{ tab }}
        </button>
      </nav>

      <section v-if="activeTab === 'Histórico de Análises'" class="panel table-panel history-panel">
        <article class="history-block-card">
          <p class="history-conditions-title">Condições: IEEE Std C57.104™-2008</p>
          <table class="table">
            <thead>
              <tr>
                <th class="text-center">H2</th>
                <th class="text-center">CH4</th>
                <th class="text-center">C2H2</th>
                <th class="text-center">C2H4</th>
                <th class="text-center">C2H6</th>
                <th class="text-center">CO</th>
                <th class="text-center">CO2</th>
                <th class="text-center">TGC</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="text-center">{{ cromatografiaConditions.h2 }}</td>
                <td class="text-center">{{ cromatografiaConditions.ch4 }}</td>
                <td class="text-center">{{ cromatografiaConditions.c2h2 }}</td>
                <td class="text-center">{{ cromatografiaConditions.c2h4 }}</td>
                <td class="text-center">{{ cromatografiaConditions.c2h6 }}</td>
                <td class="text-center">{{ cromatografiaConditions.co }}</td>
                <td class="text-center">{{ cromatografiaConditions.co2 }}</td>
                <td class="text-center">{{ cromatografiaConditions.tgc }}</td>
              </tr>
            </tbody>
          </table>
        </article>
        <article v-if="activeHistoryModel.categories.length" class="history-block-card">
          <div class="history-single">
          <div class="history-line-head">
            <div class="history-tabs-inline history-tabs-main">
              <button
                type="button"
                class="history-tab-btn"
                :class="{ active: historyActiveTab === 'cromatografia' }"
                @click="historyActiveTab = 'cromatografia'"
              >
                Cromotografia
              </button>
              <button
                type="button"
                class="history-tab-btn"
                :class="{ active: historyActiveTab === 'fisicoquimica' }"
                @click="historyActiveTab = 'fisicoquimica'"
              >
                Físico Químico
              </button>
              <button
                type="button"
                class="history-tab-btn"
                :class="{ active: historyActiveTab === 'ensaiosespeciais' }"
                @click="historyActiveTab = 'ensaiosespeciais'"
              >
                Ensaios Especiais
              </button>
            </div>
          </div>
          <article class="history-line-card history-line-card-wide">
            <div v-if="showHistorySwitch" class="history-switch-wrap history-switch-wrap-top">
              <label class="history-switch">
                <input v-model="historySwitchEnabled" type="checkbox" />
                <span class="history-switch-track">
                  <i class="history-switch-thumb"></i>
                </span>
                <b>{{ historySwitchLabel }}</b>
              </label>
            </div>
            <div class="history-chart-host">
              <VueApexCharts
                :key="historyChartKey"
                type="line"
                height="100%"
                :options="historyChartOptions"
                :series="activeHistoryModel.series"
              />
            </div>
          </article>
          </div>
        </article>
        <p v-else class="empty">Sem histórico suficiente para gráfico.</p>
      </section>

      <section v-else-if="activeTab === 'Avaliação Completa'" class="panel panel-eval">
        <article class="tile eval-card-1">
          <h4>1 - Resultado das avaliações</h4>
          <p><b>Avaliação do risco operacional do transformador:</b></p>
          <p>
            Transformador encontra-se com status de normal conforme avaliações realizadas nos históricos das variáveis
            de entrada da plataforma.
          </p>
          <p>
            Inspeções periódicas devem ser realizadas normalmente de acordo com as frequências estabelecidas nas normas
            vigentes e nas políticas de manutenção da Energisa. Verificar se existe alguma variável fora da condição
            normal estabelecida pela tabela de condições definida no documento de requisitos funcionais da plataforma e
            continuar o monitoramento.
          </p>
          <p><b>Resultado da concentração de gases combustíveis (TGC) segundo o Guia IEEE Std C57.104™- 2008:</b></p>
          <p>
            “Condição 02: Quando o total de gases combustíveis (TGC) está fora do normal. Se há algum gás excedendo
            esse limite, deve ser investigado.”
          </p>
          <p>
            <b>Resultado do método de identificação de falhas: triângulos e pentágonos de DUVAL, segundo o Guia IEEE
              Std C57.104™- 2019:</b>
          </p>
          <p>Triângulo de DUVAL 1: DT - Ocorrência simultânea de falta térmica e arco elétrico.</p>
          <p>Triângulo de DUVAL 4: C - Possível carbonização do papel.</p>
          <p>Triângulo de DUVAL 5: T3 - Falha térmica, t &gt; 700 ºC.</p>
          <p>Pentágono 1: D2 - Descargas de alta energia.</p>
          <p>Pentágono 2: D2 - Descargas de alta energia.</p>
          <p><b>Tratamento do óleo isolante:</b></p>
          <p>Óleo isolante em condições normais, nenhuma atividade recomendada.</p>
        </article>
        <article class="tile eval-card-2">
          <div class="tile-head-actions">
            <h4>2 - Avaliação do Especialista</h4>
            <button type="button" class="edit-specialist-btn" @click="openSpecialistModal">
              <svg class="edit-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l8.06-8.06.92.92L5.92 19.58zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/>
              </svg>
              Editar avaliação
            </button>
          </div>
          <p>
            <b>Status:</b>
            <span class="pill eval-status" :class="statusClass(specialistView.statusAnalyst)">
              {{ specialistView.statusAnalyst }}
            </span>
          </p>
          <p><b>Observações:</b> {{ specialistView.analystNote }}</p>
          <p>
            <b>Modo de falha selecionado:</b>
            {{ specialistView.failureMode }}
          </p>
        </article>
        <article class="tile eval-card-3">
          <h4>3 - Última Coleta</h4>
          <p><b>Guia IEEE Std C57.104™- 2008 para a Interpretação de gases dissolvidos no óleo isolante dos transformadores</b></p>
          <p>
            Foi desenvolvido um critério de quatro níveis para classificar os riscos aos transformadores, quando não há
            histórico de gás dissolvido, para operação contínua em vários níveis de gás combustível. O critério usa
            ambos, concentrações para gases separados e a concentração total de todos os gases combustíveis (TGC).
          </p>
          <div class="mini-table-wrap">
            <table class="table compact mini-table">
              <thead>
                <tr>
                  <th class="text-center">Status</th>
                  <th class="text-center">H2</th>
                  <th class="text-center">CH4</th>
                  <th class="text-center">C2H2</th>
                  <th class="text-center">C2H4</th>
                  <th class="text-center">C2H6</th>
                  <th class="text-center">CO</th>
                  <th class="text-center">CO2</th>
                  <th class="text-center">TGC</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="text-center">Condição 01</td>
                  <td class="text-center">100</td>
                  <td class="text-center">120</td>
                  <td class="text-center">1</td>
                  <td class="text-center">50</td>
                  <td class="text-center">65</td>
                  <td class="text-center">350</td>
                  <td class="text-center">2500</td>
                  <td class="text-center">720</td>
                </tr>
                <tr>
                  <td class="text-center">Condição 02</td>
                  <td class="text-center">101-700</td>
                  <td class="text-center">121-400</td>
                  <td class="text-center">2-9</td>
                  <td class="text-center">51-100</td>
                  <td class="text-center">66-100</td>
                  <td class="text-center">351-570</td>
                  <td class="text-center">2500-4000</td>
                  <td class="text-center">721-1920</td>
                </tr>
                <tr>
                  <td class="text-center">Condição 03</td>
                  <td class="text-center">701-1800</td>
                  <td class="text-center">401-1000</td>
                  <td class="text-center">10-35</td>
                  <td class="text-center">101-200</td>
                  <td class="text-center">101-150</td>
                  <td class="text-center">571-1400</td>
                  <td class="text-center">4001-10000</td>
                  <td class="text-center">1921-4630</td>
                </tr>
                <tr>
                  <td class="text-center">Condição 04</td>
                  <td class="text-center">&gt;1800</td>
                  <td class="text-center">&gt;1000</td>
                  <td class="text-center">&gt;35</td>
                  <td class="text-center">&gt;200</td>
                  <td class="text-center">&gt;150</td>
                  <td class="text-center">&gt;1400</td>
                  <td class="text-center">&gt;10000</td>
                  <td class="text-center">&gt;4630</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p><b>Resultados da última coleta:</b></p>
          <div class="mini-table-wrap">
            <table class="table compact mini-table">
              <thead>
                <tr>
                  <th class="text-center">Data da coleta</th>
                  <th class="text-center">H2</th>
                  <th class="text-center">CH4</th>
                  <th class="text-center">C2H2</th>
                  <th class="text-center">C2H4</th>
                  <th class="text-center">C2H6</th>
                  <th class="text-center">CO</th>
                  <th class="text-center">CO2</th>
                  <th class="text-center">TGC</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td rowspan="2">25-03-2024</td>
                  <td>Condição 01</td>
                  <td>Condição 01</td>
                  <td>Condição 02</td>
                  <td>Condição 01</td>
                  <td>Condição 01</td>
                  <td>Condição 01</td>
                  <td>Condição 01</td>
                  <td>Condição 02</td>
                </tr>
                <tr>
                  <td>10</td>
                  <td>7</td>
                  <td>3</td>
                  <td>10</td>
                  <td>1</td>
                  <td>81</td>
                  <td>908</td>
                  <td>1020</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            <b>Observação:</b>
            O operador do transformador pode decidir em usar diferentes concentrações de gás dissolvido para os
            gases individuais (particularmente acetileno) e o TGC (total de gases combustíveis) é baseado em
            julgamento de engenharia e experiência com outros transformadores similares. O critério usa ambos,
            concentrações para gases separados e a concentração total de todos os gases combustíveis (TGC).
          </p>
        </article>
        <article class="tile eval-card-4">
          <h4>4 - Avaliação do risco operacional do transformador</h4>
          <p>
            As probabilidades calculadas representam as probabilidades de residência nos cinco níveis de estados
            operativos do transformador para no ano seguinte ao histórico.
          </p>
          <p><b>Probabilidade (%) de operação em risco para o próximo ano</b></p>

          <div class="risk-pies">
            <article v-for="(probability, index) in riskProbabilities" :key="`risk-${index}`" class="risk-pie-card">
              <h5>Nível-{{ index + 1 }}</h5>
              <div class="risk-pie" :style="{ '--pct': `${probability}%` }"></div>
              <b>{{ probability.toFixed(2) }} %</b>
            </article>
          </div>

          <p><b>Variáveis do óleo que levaram o transformador aos estados de risco:</b></p>
          <p>
            A seguir são apresentadas as variáveis do óleo isolante que levaram o transformador a operar nas regiões
            de risco (N1 a N5).
          </p>

          <div class="risk-bars-grid">
            <article v-for="(level, idx) in oilVariablesByLevel" :key="`bar-${idx}`" class="risk-bar-card">
              <h5>{{ level.title }}</h5>
              <div class="risk-bars">
                <div v-for="(value, varIdx) in level.vars" :key="`${level.title}-${varIdx}`" class="risk-bar-item">
                  <span class="risk-bar-label">{{ level.labels[varIdx] }}</span>
                  <div class="risk-bar-track">
                    <div class="risk-bar-fill" :style="{ width: `${(value / level.max) * 100}%` }"></div>
                  </div>
                  <span class="risk-bar-value">{{ value }}</span>
                </div>
              </div>
            </article>
          </div>
        </article>
        <article class="tile eval-card-5">
          <h4>5 - Métodos de identificação de falhas: Triângulos e Pentágonos de Duval.</h4>
          <div class="duval-grid">
            <article class="duval-table-card">
              <table class="table compact mini-table">
                <thead>
                  <tr>
                    <th colspan="2" class="text-center">Resultado da última amostra - 25-03-2024</th>
                  </tr>
                  <tr>
                    <th class="text-left">Gás</th>
                    <th class="text-left">Valores</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Hidrogênio (H2)</td><td class="text-center">10.000</td></tr>
                  <tr><td>Metano (CH4)</td><td class="text-center">7.000</td></tr>
                  <tr><td>Etano (C2H6)</td><td class="text-center">1.000</td></tr>
                  <tr><td>Etileno (C2H4)</td><td class="text-center">10.000</td></tr>
                  <tr><td>Aceliteno (C2H2)</td><td class="text-center">3.000</td></tr>
                  <tr><td>Mon. Carbono (CO)</td><td class="text-center">81.000</td></tr>
                  <tr><td>Dióx. Carbono (CO2)</td><td class="text-center">908.000</td></tr>
                </tbody>
              </table>
            </article>

            <article class="duval-table-card">
              <table class="table compact mini-table">
                <thead>
                  <tr>
                    <th colspan="3" class="text-center">Tabela 1 IEEE C57.104-2019 (ppm)</th>
                  </tr>
                  <tr>
                    <th class="text-left">Gás</th>
                    <th class="text-left">O2/N2 razão ≤ 0.2</th>
                    <th class="text-left">O2/N2 razão ≥ 0.2</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Hidrogênio (H2)</td><td class="text-center">80</td><td class="text-center">40</td></tr>
                  <tr><td>Metano (CH4)</td><td class="text-center">90</td><td class="text-center">20</td></tr>
                  <tr><td>Etano (C2H6)</td><td class="text-center">90</td><td class="text-center">15</td></tr>
                  <tr><td>Etileno (C2H4)</td><td class="text-center">50</td><td class="text-center">50</td></tr>
                  <tr><td>Aceliteno (C2H2)</td><td class="text-center">20</td><td class="text-center">20</td></tr>
                  <tr><td>Mon. Carbono (CO)</td><td class="text-center">900</td><td class="text-center">500</td></tr>
                  <tr><td>Dióx. Carbono (CO2)</td><td class="text-center">9000</td><td class="text-center">5000</td></tr>
                </tbody>
              </table>
            </article>
          </div>
        </article>
        <article class="tile eval-card-6">
          <h4>6 - Tratamentos no óleo isolante</h4>
          <p>
            Devem ser realizados de acordo com os resultados dos ensaios físico-químicos do óleo isolante, observando
            os limites mínimos e máximos estabelecidos para cada variável de interesse, conforme orientações da norma
            NBR 10576/2017.
          </p>
          <div class="mini-table-wrap desktop-only">
            <table class="table compact mini-table">
              <thead>
                <tr>
                  <th class="text-center">Data Coleta</th>
                  <th class="text-center">Teor de Água (ppm)</th>
                  <th class="text-center">RD (kV)</th>
                  <th class="text-center">TIF (Dyan/cm)</th>
                  <th class="text-center">Índ. Neutr. (mgKH0/g)</th>
                  <th class="text-center">F. Pot. 25ºC</th>
                  <th class="text-center">F. Pot. 90ºC</th>
                  <th class="text-center">F. Pot. 100ºC</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="text-center">17-01-2024</td>
                  <td class="text-center">17.000</td>
                  <td class="text-center">54.000</td>
                  <td class="text-center">34.400</td>
                  <td class="text-center">0.0300</td>
                  <td class="text-center"></td>
                  <td class="text-center"></td>
                  <td class="text-center"></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="mobile-only mobile-kv-card">
            <h5>Coleta 17-01-2024</h5>
            <div class="mobile-kv-list">
              <div><span>Teor de Água (ppm)</span><b>17.000</b></div>
              <div><span>RD (kV)</span><b>54.000</b></div>
              <div><span>TIF (Dyan/cm)</span><b>34.400</b></div>
              <div><span>Índ. Neutr. (mgKH0/g)</span><b>0.0300</b></div>
              <div><span>F. Pot. 25ºC</span><b>-</b></div>
              <div><span>F. Pot. 90ºC</span><b>-</b></div>
              <div><span>F. Pot. 100ºC</span><b>-</b></div>
            </div>
          </div>
        </article>
      </section>

      <section v-else-if="activeTab === 'Avaliação IEEE'" class="panel table-panel">
        <article class="tile tile-wide">
          <h4>Guia IEEE Std C57.104™- 2008 para a Interpretação de gases dissolvidos no óleo isolante dos transformadores</h4>
          <p>
            Foi desenvolvido um critério de quatro níveis para classificar os riscos aos transformadores, quando não há histórico de gás dissolvido,
            para operação contínua em vários níveis de gás combustível. O critério usa ambos, concentrações para gases separados e a concentração
            total de todos os gases combustíveis (TGC).
          </p>
          <p class="section-strong">DEFINIÇÃO DAS QUATRO CONDIÇÕES DE CLASSIFICAÇÃO DO GUIA:</p>
          <ul class="ieee-conditions">
            <li><b>Condição 01:</b> Quando o total de gases combustíveis (TGC) está em condições satisfatórias de operação. Se há algum gás excedendo esse limite, deve ser investigado.</li>
            <li><b>Condição 02:</b> Quando o total de gases combustíveis (TGC) está fora do normal. Se há algum gás excedendo esse limite, deve ser investigado.</li>
            <li><b>Condição 03:</b> Quando o total de gases combustíveis (TGC) está dentro desta faixa indica um alto nível de decomposição. Se há algum gás excedendo esse limite, deve ser feita uma investigação adicional.</li>
            <li><b>Condição 04:</b> Quando o total de gases combustíveis (TGC) está com provável nível de decomposição excessiva, pode indicar falha na operação do transformador.</li>
          </ul>
          <p>
            A Tabela 1 lista as concentrações de gases dissolvidos individuais e as concentrações de TGC (total de gases combustíveis), para as
            condições de 1 até 4. Esta tabela é usada para fazer a avaliação de uma condição de gaseificação em um transformador novo ou
            recentemente reparado. Pode ser utilizada quando não houver ensaios prévios no transformador para gases dissolvidos ou quando não há
            histórico recente das análises cromatográficas.
          </p>
          <div class="mini-table-wrap">
            <table class="table compact mini-table">
              <thead>
                <tr>
                  <th class="text-center">Status</th>
                  <th class="text-center">H2</th>
                  <th class="text-center">CH4</th>
                  <th class="text-center">C2H2</th>
                  <th class="text-center">C2H4</th>
                  <th class="text-center">C2H6</th>
                  <th class="text-center">CO</th>
                  <th class="text-center">CO2</th>
                  <th class="text-center">TGC</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="text-center">Condição 01</td>
                  <td class="text-center">100</td>
                  <td class="text-center">120</td>
                  <td class="text-center">1</td>
                  <td class="text-center">50</td>
                  <td class="text-center">65</td>
                  <td class="text-center">350</td>
                  <td class="text-center">2500</td>
                  <td class="text-center">720</td>
                </tr>
                <tr>
                  <td class="text-center">Condição 02</td>
                  <td class="text-center">101-700</td>
                  <td class="text-center">121-400</td>
                  <td class="text-center">2-9</td>
                  <td class="text-center">51-100</td>
                  <td class="text-center">66-100</td>
                  <td class="text-center">351-570</td>
                  <td class="text-center">2500-4000</td>
                  <td class="text-center">721-1920</td>
                </tr>
                <tr>
                  <td class="text-center">Condição 03</td>
                  <td class="text-center">701-1800</td>
                  <td class="text-center">401-1000</td>
                  <td class="text-center">10-35</td>
                  <td class="text-center">101-200</td>
                  <td class="text-center">101-150</td>
                  <td class="text-center">571-1400</td>
                  <td class="text-center">4001-10000</td>
                  <td class="text-center">1921-4630</td>
                </tr>
                <tr>
                  <td class="text-center">Condição 04</td>
                  <td class="text-center">&gt;1800</td>
                  <td class="text-center">&gt;1000</td>
                  <td class="text-center">&gt;35</td>
                  <td class="text-center">&gt;200</td>
                  <td class="text-center">&gt;150</td>
                  <td class="text-center">&gt;1400</td>
                  <td class="text-center">&gt;10000</td>
                  <td class="text-center">&gt;4630</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="table-legend">Tabela 1 – Principais limites de concentração de gases dissolvidos (ppm)</p>
          <div class="mini-table-wrap">
            <table class="table compact mini-table">
              <thead>
                <tr>
                  <th class="text-center" colspan="9">Resultados da última amostra (ppm)</th>
                </tr>
                <tr>
                  <th class="text-center">Data Coleta</th>
                  <th class="text-center">H2</th>
                  <th class="text-center">CH4</th>
                  <th class="text-center">C2H2</th>
                  <th class="text-center">C2H4</th>
                  <th class="text-center">C2H6</th>
                  <th class="text-center">CO</th>
                  <th class="text-center">CO2</th>
                  <th class="text-center">TGC</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="text-center" rowspan="2">25-03-2024</td>
                  <td class="text-center">Condição 01</td>
                  <td class="text-center">Condição 01</td>
                  <td class="text-center">Condição 02</td>
                  <td class="text-center">Condição 01</td>
                  <td class="text-center">Condição 01</td>
                  <td class="text-center">Condição 01</td>
                  <td class="text-center">Condição 01</td>
                  <td class="text-center">Condição 02</td>
                </tr>
                <tr>
                  <td class="text-center">10</td>
                  <td class="text-center">7</td>
                  <td class="text-center">3</td>
                  <td class="text-center">10</td>
                  <td class="text-center">1</td>
                  <td class="text-center">81</td>
                  <td class="text-center">908</td>
                  <td class="text-center">1020</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="table-legend">Concentração de gases dissolvidos da última amostra (ppm)</p>
          <p>
            <b class="label-strong">Observação:</b> Os usuários do guia IEEE Std C57.104™- 2008 são avisados de que as concentrações de gases dissolvidos contidas na
            Tabela 1 apresenta valores de consenso baseados nas experiências de muitas empresas. O operador do transformador pode decidir em usar
            diferentes concentrações de gás dissolvido para os gases individuais (particularmente acetileno) e o TGC (total de gases combustíveis)
            é baseado em julgamento de engenharia de manutenção e experiência com outros transformadores similares.
          </p>
        </article>
      </section>

      <section v-else-if="activeTab === 'Próximas Coletas'" class="panel">
        <article v-for="item in nextCollections" :key="item.id" class="tile">
          <h4>{{ item.type }}</h4>
          <p><b>Data prevista:</b> {{ toUiDate(item.scheduledAt) }}</p>
          <p><b>Prioridade:</b> {{ item.priority }}</p>
          <p><b>Responsável:</b> {{ item.responsible }}</p>
        </article>
      </section>

      <section v-else-if="activeTab === 'Tratamento de Óleo'" class="panel">
        <article v-for="item in oilTreatments" :key="item.title + item.at" class="tile">
          <h4>{{ item.title }}</h4>
          <p><b>Data:</b> {{ toUiDate(item.at) }}</p>
          <p><b>Status:</b> {{ item.status }}</p>
          <p><b>Observação:</b> {{ item.notes }}</p>
        </article>
      </section>

      <section v-else-if="activeTab === 'Cadastro OLTC'" class="panel table-panel">
        <table v-if="oltcRows.length" class="table">
          <thead>
            <tr>
              <th>Tag OLTC</th>
              <th>Serial OLTC</th>
              <th>Modelo</th>
              <th>Fabricante</th>
              <th>Ano</th>
              <th>Filtro</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in oltcRows" :key="row.ID">
              <td>{{ row.TAG }}</td>
              <td>{{ row.SERIAL_OLTC }}</td>
              <td>{{ row.MODELO }}</td>
              <td>{{ row.FABRICANTE }}</td>
              <td>{{ row.ANO_FABRICACAO }}</td>
              <td>{{ row.FILTRO }}</td>
              <td><span class="pill" :class="statusClass(String(row.ESTADO || ''))">{{ row.ESTADO }}</span></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">Sem cadastro OLTC vinculado para este transformador.</p>
      </section>

      <section v-else-if="activeTab === 'Cromatografias'" class="panel table-panel">
        <table class="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Laboratório</th>
              <th>H2</th>
              <th>CH4</th>
              <th>C2H4</th>
              <th>Total Gases</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in cromatografiasRows" :key="String(row.DATA_COLETA) + String(row.LAB)">
              <td>{{ row.DATA_COLETA }}</td>
              <td>{{ row.LAB || '-' }}</td>
              <td>{{ row.HIDROGENIO ?? '-' }}</td>
              <td>{{ row.METANO ?? '-' }}</td>
              <td>{{ row.ETILENO ?? '-' }}</td>
              <td>{{ row.TOTAL_GASES ?? '-' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-else-if="activeTab === 'Físicos Químicos'" class="panel table-panel split">
        <article>
          <h4>Físico-Químico do transformador</h4>
          <table class="table compact">
            <thead>
              <tr>
                <th>Data</th>
                <th>Teor água</th>
                <th>RD</th>
                <th>Tensão interf.</th>
                <th>Cor</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in fisicoRows" :key="String(row.DATA_COLETA) + String(row.LAB)">
                <td>{{ row.DATA_COLETA }}</td>
                <td>{{ row.TEOR_AGUA ?? '-' }}</td>
                <td>{{ row.RD ?? '-' }}</td>
                <td>{{ row.TENSAO_INTERFACIAL ?? '-' }}</td>
                <td>{{ row.COR ?? '-' }}</td>
              </tr>
            </tbody>
          </table>
        </article>

        <article>
          <h4>Físico-Químico OLTC</h4>
          <table class="table compact">
            <thead>
              <tr>
                <th>Data</th>
                <th>Nº Série</th>
                <th>Teor água</th>
                <th>RD</th>
                <th>Lab</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in fisicoOltcRows" :key="String(row.DATA_COLETA) + String(row.NUM_SERIE)">
                <td>{{ row.DATA_COLETA }}</td>
                <td>{{ row.NUM_SERIE }}</td>
                <td>{{ row.TEOR_AGUA ?? '-' }}</td>
                <td>{{ row.RD ?? '-' }}</td>
                <td>{{ row.LAB ?? '-' }}</td>
              </tr>
            </tbody>
          </table>
        </article>
      </section>

      <section v-else class="panel">
        <article v-for="test in specialTests" :key="test.name" class="tile">
          <h4>{{ test.name }}</h4>
          <p><b>Resultado:</b> {{ test.result }}</p>
          <p><b>Recomendação:</b> {{ test.recommendation }}</p>
        </article>
      </section>

      <div v-if="specialistModalOpen" class="modal-overlay" @click="closeSpecialistModal">
        <div class="modal-card" @click.stop>
          <h4>Editar avaliação do especialista</h4>
          <div class="modal-grid">
            <label>
              <span>Status</span>
              <select
                v-model="specialistForm.statusAnalyst"
                :style="statusOptionStyle(specialistForm.statusAnalyst)"
              >
                <option
                  v-for="item in analystStatusOptions"
                  :key="item"
                  :value="item"
                  :style="statusOptionStyle(item)"
                >
                  {{ item }}
                </option>
              </select>
            </label>
            <label>
              <span>Modo de falha selecionado</span>
              <select v-model="specialistForm.failureMode">
                <option v-for="item in failureModeOptions" :key="item" :value="item">{{ item }}</option>
              </select>
            </label>
            <label class="full">
              <span>Observações</span>
              <textarea
                v-model="specialistForm.analystNote"
                rows="4"
                placeholder="Digite as observações do especialista"
              ></textarea>
            </label>
          </div>
          <div class="modal-actions">
            <button type="button" class="secondary-btn" @click="closeSpecialistModal">Cancelar</button>
            <button type="button" class="primary-btn" @click="saveSpecialistModal">Salvar</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.report-view{
  min-height: 100vh;
  background: radial-gradient(circle at 20% 10%, #f4f7ff 0%, #f8fafc 45%, #ffffff 100%);
  padding: 32px 32px 60px 96px;
  color: #0f172a;
  overflow-x: hidden;
}

.report-shell{
  border-radius: 20px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: #fff;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
  padding: 18px;
  min-width: 0;
}

.report-toolbar{
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 16px;
  margin-bottom: 14px;
}

.selector{
  display: grid;
  gap: 6px;
}

.selector label{
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(15, 23, 42, 0.55);
}

.selector select{
  min-width: 340px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: #fff;
  padding: 0 12px;
}

.locate-btn{
  height: 38px;
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

.locate-btn:hover{
  background: rgba(15, 23, 42, 0.06);
}

.locate-btn:disabled{
  opacity: 0.5;
  cursor: not-allowed;
}

.pin-icon{
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.summary-grid{
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 12px;
  margin-bottom: 14px;
}

.summary-grid > *{
  min-width: 0;
}

.summary-card{
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  padding: 14px;
  background: rgba(248, 250, 252, 0.9);
}

.summary-card h3,
.summary-card h4{
  margin: 0 0 6px;
}

.summary-card p{
  margin: 0;
  color: rgba(15, 23, 42, 0.75);
  font-size: 13px;
}

.info-grid{
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.info-grid small{
  display: block;
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: rgba(15, 23, 42, 0.5);
}

.info-grid b{
  font-size: 13px;
}

.pill-row{
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.tone-normal{
  background: rgba(22, 163, 74, 0.2);
  color: #15803d;
}

.tone-warning{
  background: rgba(245, 158, 11, 0.22);
  color: #b45309;
}

.tone-danger{
  background: rgba(220, 38, 38, 0.2);
  color: #b91c1c;
}

.tone-neutral{
  background: rgba(148, 163, 184, 0.2);
  color: #475569;
}

.tabs{
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.tab-btn{
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.9);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
}

.tab-btn.active{
  background: #1e4e8b;
  color: #fff;
  border-color: #1e4e8b;
}

.panel{
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.panel > *{
  min-width: 0;
}

.tile-wide{
  grid-column: 1 / -1;
}

.panel-eval .eval-card-1{
  grid-column: 1;
  grid-row: 1;
}

.panel-eval .eval-card-2{
  grid-column: 1;
  grid-row: 2;
}

.panel-eval .eval-card-3{
  grid-column: 2;
  grid-row: 1 / span 2;
}

.panel-eval .eval-card-4{
  grid-column: 1 / -1;
  grid-row: 3;
}

.panel-eval .eval-card-5{
  grid-column: 1;
  grid-row: 4;
}

.panel-eval .eval-card-6{
  grid-column: 2;
  grid-row: 4;
}

.panel.table-panel{
  display: block;
}

.panel.table-panel.split{
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.tile{
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 14px;
  padding: 12px;
  background: #ffffff;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
}

.tile h4{
  margin: 0 0 10px;
  font-size: 15px;
  color: #123a6d;
}

.tile-head-actions{
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.tile-head-actions h4{
  margin: 0;
}

.tile p{
  margin: 6px 0;
  font-size: 13px;
  color: rgba(15, 23, 42, 0.82);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.tile h5{
  margin: 0 0 8px;
  font-size: 13px;
  color: #123a6d;
}

.table{
  width: 100%;
  border: 1px solid rgba(30, 78, 139, 0.16);
  border-radius: 12px;
  border-collapse: collapse;
  font-size: 12px;
  overflow: hidden;
}

.table th,
.table td{
  border-bottom: 1px solid rgba(15, 23, 42, 0.07);
  padding: 10px 8px;
  text-align: left;
}

.table th{
  color: #ffffff;
  background: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
}

.table thead th{
  background: #64748b !important;
}

.table tbody tr:nth-child(odd){
  background: rgba(248, 250, 252, 0.75);
}

.table tbody tr:hover{
  background: rgba(30, 78, 139, 0.08);
}

.table.compact th,
.table.compact td{
  padding: 8px 6px;
}

.text-center{
  text-align: center !important;
}

.text-left{
  text-align: left !important;
}

.mini-table-wrap{
  overflow-x: auto;
  margin: 8px 0 10px;
  border: 1px solid rgba(30, 78, 139, 0.16);
  border-radius: 10px;
  background: #ffffff;
}

.mini-table td{
  white-space: nowrap;
}

.tile p.table-legend{
  margin: 10px 0 6px;
  font-size: 10px;
  color: rgba(15, 23, 42, 0.56);
  text-align: center;
}

.duval-grid{
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 8px;
}

.duval-table-card{
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 10px;
  overflow: hidden;
}

.duval-table-card .table{
  border: 0;
  border-radius: 0;
}

.desktop-only{
  display: block;
}

.mobile-only{
  display: none;
}

.mobile-kv-card{
  padding: 10px;
}

.mobile-kv-card h5{
  margin: 0 0 10px;
  font-size: 13px;
  color: #123a6d;
  font-weight: 700;
}

.mobile-kv-list{
  display: grid;
  gap: 8px;
}

.mobile-kv-list > div{
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 10px;
  padding: 8px 10px;
  background: rgba(248, 250, 252, 0.8);
  display: grid;
  gap: 4px;
}

.mobile-kv-list > div span{
  font-size: 11px;
  color: rgba(15, 23, 42, 0.7);
}

.mobile-kv-list > div b{
  font-size: 12px;
  color: #123a6d;
}

.mobile-kv-list.triple > div{
  grid-template-columns: 1fr;
}

.risk-pies{
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin: 10px 0 14px;
}

.risk-pie-card{
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 10px;
  padding: 10px;
  text-align: center;
  background: rgba(248, 250, 252, 0.65);
}

.risk-pie-card h5,
.risk-bar-card h5{
  text-align: center;
  font-weight: 700;
}

.risk-pie{
  --pct: 0%;
  width: 72px;
  height: 72px;
  margin: 6px auto 8px;
  border-radius: 999px;
  background: conic-gradient(#1e4e8b var(--pct), rgba(148, 163, 184, 0.25) 0);
  position: relative;
}

.risk-pie::after{
  content: '';
  position: absolute;
  inset: 12px;
  border-radius: 999px;
  background: #fff;
}

.risk-bars-grid{
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.risk-bar-card{
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 10px;
  padding: 10px;
  background: rgba(248, 250, 252, 0.65);
}

.risk-bars{
  display: grid;
  gap: 6px;
}

.risk-bar-item{
  display: grid;
  grid-template-columns: 54px 1fr auto;
  align-items: center;
  gap: 8px;
}

.risk-bar-label{
  font-size: 10px;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.75);
  text-align: left;
}

.risk-bar-track{
  width: 100%;
  height: 7px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.25);
  overflow: hidden;
}

.risk-bar-fill{
  height: 100%;
  border-radius: inherit;
  background: #1e4e8b;
}

.risk-bar-value{
  font-size: 10px;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.62);
  min-width: 34px;
  text-align: right;
}

.panel-eval .tile p b{
  color: #123a6d;
  font-weight: 700;
}

.ieee-conditions{
  margin: 8px 0 12px;
  padding-left: 18px;
  display: grid;
  gap: 8px;
}

.ieee-conditions li{
  font-size: 13px;
  line-height: 1.5;
  color: rgba(15, 23, 42, 0.82);
}

.ieee-conditions{
  margin-bottom: 18px;
}

.section-strong{
  font-weight: 700;
  color: #123a6d;
}

.label-strong{
  font-weight: 700;
  color: #123a6d;
}

.panel-eval .eval-card-5 .table th,
.panel-eval .eval-card-5 .table td{
  text-align: center !important;
}

.eval-status{
  margin-left: 8px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
}

.edit-specialist-btn{
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.7);
  color: rgba(15, 23, 42, 0.8);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.edit-specialist-btn:hover{
  background: rgba(15, 23, 42, 0.06);
}

.edit-icon{
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.modal-overlay{
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(3px);
  display: grid;
  place-items: center;
  z-index: 80;
  padding: 16px;
}

.modal-card{
  width: min(720px, 100%);
  background: #fff;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.2);
  padding: 14px;
}

.modal-card h4{
  margin: 0 0 12px;
  color: #123a6d;
}

.modal-grid{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.modal-grid label{
  display: grid;
  gap: 6px;
}

.modal-grid label span{
  font-size: 11px;
  color: rgba(15, 23, 42, 0.7);
  font-weight: 600;
}

.modal-grid select,
.modal-grid textarea{
  width: 100%;
  border: 1px solid rgba(15, 23, 42, 0.18);
  border-radius: 10px;
  background: #fff;
  padding: 8px 10px;
  font-size: 13px;
  color: #0f172a;
}

.modal-grid .full{
  grid-column: 1 / -1;
}

.modal-actions{
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.primary-btn,
.secondary-btn{
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.primary-btn{
  border: 1px solid #1e4e8b;
  background: #1e4e8b;
  color: #fff;
}

.secondary-btn{
  border: 1px solid rgba(15, 23, 42, 0.16);
  background: #fff;
  color: rgba(15, 23, 42, 0.8);
}

.empty{
  margin: 8px 0 0;
  color: rgba(15, 23, 42, 0.65);
}

.history-conditions-title{
  margin: 0 0 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: #1e4e8b;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}

.history-block-card{
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 14px;
  background: #ffffff;
  padding: 12px;
}

.history-panel{
  display: block !important;
}

.history-panel .history-block-card + .history-block-card{
  margin-top: 14px;
}

.history-grid{
  margin-top: 14px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.history-single{
  margin-top: 14px;
  display: grid;
  gap: 10px;
}

.history-line-card{
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.9);
  padding: 12px;
  overflow: hidden;
}

.history-line-card-wide{
  width: 100%;
  max-width: none;
  margin: 0 auto;
}

.history-card-label{
  margin: 0;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.78);
}

.history-line-head{
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.history-line-head h4{
  margin: 0;
  font-size: 13px;
  color: #0f172a;
}

.history-tabs-inline{
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  padding: 2px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  background: rgba(255, 255, 255, 0.92);
}

.history-tabs-main{
  margin: 0 auto;
}

.history-tab-btn{
  border: 0;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 8px;
  background: transparent;
  color: rgba(15, 23, 42, 0.7);
  font-size: 11px;
  line-height: 1.2;
  white-space: normal;
  text-align: center;
  font-weight: 600;
  cursor: pointer;
}

.history-tab-btn.active{
  background: #1e4e8b;
  color: #fff;
}

.history-scale{
  margin-top: 8px;
  display: flex;
  justify-content: center;
  gap: 10px;
  font-size: 11px;
  color: rgba(15, 23, 42, 0.65);
}

.history-switch-wrap{
  margin-top: 8px;
  display: flex;
  justify-content: center;
}

.history-switch-wrap-top{
  margin-top: 0;
  margin-bottom: 6px;
  justify-content: flex-start;
}

.history-switch{
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.8);
  cursor: pointer;
}

.history-switch input{
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.history-switch b{
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.history-switch-track{
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background: #94a3b8;
  border: 1px solid rgba(15, 23, 42, 0.18);
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 2px;
  transition: background-color 0.2s ease;
  cursor: pointer;
}

.history-switch-thumb{
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.25);
  transform: translateX(0);
  transition: transform 0.2s ease;
  cursor: pointer;
}

.history-switch input:checked + .history-switch-track{
  background: #22c55e;
  border-color: #16a34a;
}

.history-switch input:checked + .history-switch-track .history-switch-thumb{
  transform: translateX(18px);
}

.history-chart-host{
  width: 100%;
  height: 460px;
  display: block;
  margin-top: 8px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 10px;
  padding: 8px 8px 2px;
  overflow: hidden;
}

.history-chart-host :deep(.apexcharts-canvas){
  max-width: 100% !important;
}

.history-chart-host :deep(svg){
  max-width: 100% !important;
}

@media (max-width: 900px) {
  .report-view{
    padding: 90px 16px 40px;
  }
  .selector select{
    min-width: 100%;
  }
  .report-toolbar{
    flex-direction: column;
    align-items: stretch;
  }
  .locate-btn{
    width: 100%;
  }
  .summary-grid{
    grid-template-columns: 1fr;
  }
  .info-grid{
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .panel{
    grid-template-columns: 1fr;
  }
  .panel-eval .eval-card-1,
  .panel-eval .eval-card-2,
  .panel-eval .eval-card-3,
  .panel-eval .eval-card-4,
  .panel-eval .eval-card-5,
  .panel-eval .eval-card-6{
    grid-column: auto;
    grid-row: auto;
  }
  .risk-pies,
  .risk-bars-grid{
    grid-template-columns: 1fr 1fr;
  }
  .duval-grid{
    grid-template-columns: 1fr;
  }
  .desktop-only{
    display: none !important;
  }
  .mobile-only{
    display: block;
  }
  .panel.table-panel.split{
    grid-template-columns: 1fr;
  }
  .panel.table-panel,
  .panel.table-panel article,
  .mini-table-wrap{
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .table{
    min-width: 760px;
  }
  .table.mobile-card-table{
    min-width: 0 !important;
    border: 0;
    background: transparent;
  }
  .table.mobile-card-table thead{
    display: none;
  }
  .table.mobile-card-table tbody{
    display: grid;
    gap: 8px;
  }
  .table.mobile-card-table tbody tr{
    display: block;
    border: 1px solid rgba(15, 23, 42, 0.12);
    border-radius: 10px;
    background: rgba(248, 250, 252, 0.85);
    padding: 8px 10px;
  }
  .table.mobile-card-table tbody td{
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    border: 0;
    padding: 6px 0;
    text-align: right !important;
    white-space: normal;
  }
  .table.mobile-card-table tbody td::before{
    content: attr(data-label);
    color: rgba(15, 23, 42, 0.68);
    font-size: 11px;
    font-weight: 600;
    text-align: left;
    margin-right: auto;
    padding-right: 10px;
  }
  .history-grid{
    grid-template-columns: 1fr;
  }
  .history-chart-host{
    height: 340px;
  }
  .modal-grid{
    grid-template-columns: 1fr;
  }
}
</style>
