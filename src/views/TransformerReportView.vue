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
type AnalysisModalTab = 'cromatografia' | 'fisicoquimico' | 'ensaiosespeciais'
type AnalysisFieldType = 'text' | 'number' | 'date' | 'select'
type AnalysisFieldDef = {
  key: string
  label: string
  hint?: string
  type?: AnalysisFieldType
  options?: string[]
}
type ColetasSubTab = 'proximas' | 'realizadas'
type ColetaRow = {
  id: string
  transformador: string
  statusUltimaColeta: string
  dataColeta: string
  subestacao: string
  unidade: string
  tag: string
  tipoAnalise: string
  faltamDias: number
  status: 'Pendente' | 'Atrasada' | 'Coletado'
  categoria: ColetasSubTab
}
type TreatmentColumn = {
  id: string
  label: string
  defaultVisible: boolean
}
type TreatmentRow = Record<string, string | number> & { id: string }

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
  'Coletas',
  'Tratamento de Óleo',
  'Cadastro OLTC',
] as const

type ReportTab = (typeof tabs)[number]

function toValidTab(value: unknown): ReportTab {
  const text = String(value || '')
  if (text === 'Próximas Coletas') return 'Coletas'
  return (tabs.find((tab) => tab === text) as ReportTab) || 'Avaliação Completa'
}

const activeTab = ref<ReportTab>(toValidTab(route.query.section))
const generateReportMenuOpen = ref(false)
const generateReportWrapRef = ref<HTMLElement | null>(null)
const generateReportItems = [
  'Avaliação Completa',
  'Histórico de Análises',
  'Avaliação IEEE',
  'Coletas',
  'Tratamento de Óleo',
]
const generateReportSelected = ref<string[]>([...generateReportItems])

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
const analysisModalOpen = ref(false)
const analysisModalTab = ref<AnalysisModalTab>('cromatografia')
const analysisSendReport = ref<Record<AnalysisModalTab, boolean>>({
  cromatografia: false,
  fisicoquimico: false,
  ensaiosespeciais: false,
})
const analysisCromForm = ref<Record<string, string>>({
  transformador: '',
  dataColeta: '',
  dataIntervencao: '',
  intervencao: '',
  tempAmostra: '',
  tempOleo: '',
  tempEnrolam: '',
  hidrogenio: '',
  oxigenio: '',
  nitrogenio: '',
  monCarbono: '',
  metano: '',
  dioxCarbono: '',
  etileno: '',
  etano: '',
  acetileno: '',
  totalGases: '',
  tgc: '',
  laboratorio: '',
  carregamento: '',
})
const analysisFisicoForm = ref<Record<string, string>>({
  transformador: '',
  dataColeta: '',
  dataIntervencao: '',
  intervencao: '',
  tempAmostra: '',
  teorAgua: '',
  tempOleo: '',
  tempEnrolam: '',
  rd: '',
  tif: '',
  indNeutr: '',
  cor: '',
  densRel: '',
  fPot25: '',
  fPot90: '',
  fPot100: '',
  ensaioDbpc: '',
  laboratorio: '',
})
const analysisEnsaiosForm = ref<Record<string, string>>({
  transformador: '',
  dataColeta: '',
  enxofreCorrosivo: '',
  teorDbds: '',
  teorPassivador: '',
  enxofreElementar: '',
  gpFabrica: '',
  gp: '',
  furanos: '',
  laboratorio: '',
})
const analysisCromFields: AnalysisFieldDef[] = [
  { key: 'transformador', label: 'Transformador', hint: '* Digite o serial do Transformador' },
  { key: 'dataColeta', label: 'Data Coleta', hint: '* Selecione a data da Coleta', type: 'date' },
  { key: 'dataIntervencao', label: 'Data Intervenção', hint: 'Se existir selecione a Data Intervenção', type: 'date' },
  { key: 'intervencao', label: 'Intervenção', hint: 'Máximo de 255 dígitos' },
  { key: 'tempAmostra', label: 'Temp. Amostra (°C)', hint: 'Máximo de 11 dígitos', type: 'number' },
  { key: 'tempOleo', label: 'Temp. Óleo (°C)', hint: 'Máximo de 11 dígitos', type: 'number' },
  { key: 'tempEnrolam', label: 'Temp. Enrolam. (°C)', hint: 'Máximo de 11 dígitos', type: 'number' },
  { key: 'hidrogenio', label: 'Hidrogênio (H2)', hint: '* Mínimo de 1 e máximo de 11 dígitos', type: 'number' },
  { key: 'oxigenio', label: 'Oxigênio (O2)', hint: '* Mínimo de 1 e máximo de 11 dígitos', type: 'number' },
  { key: 'nitrogenio', label: 'Nitrogênio (N2)', hint: '* Mínimo de 1 e máximo de 11 dígitos', type: 'number' },
  { key: 'monCarbono', label: 'Mon. Carbono (CO)', hint: '* Mínimo de 1 e máximo de 11 dígitos', type: 'number' },
  { key: 'metano', label: 'Metano (CH4)', hint: '* Mínimo de 1 e máximo de 11 dígitos', type: 'number' },
  { key: 'dioxCarbono', label: 'Dióx. Carbono (CO2)', hint: '* Mínimo de 1 e máximo de 11 dígitos', type: 'number' },
  { key: 'etileno', label: 'Etileno (C2H4)', hint: '* Mínimo de 1 e máximo de 11 dígitos', type: 'number' },
  { key: 'etano', label: 'Etano (C2H6)', hint: '* Mínimo de 1 e máximo de 11 dígitos', type: 'number' },
  { key: 'acetileno', label: 'Acetileno (C2H2)', hint: '* Mínimo de 1 e máximo de 11 dígitos', type: 'number' },
  { key: 'totalGases', label: 'Total Gases', hint: 'Máximo de 30 dígitos', type: 'number' },
  { key: 'tgc', label: 'TGC', hint: 'Mínimo de 1 e máximo de 11 dígitos', type: 'number' },
  { key: 'laboratorio', label: 'Laboratório', hint: 'Máximo de 45 dígitos' },
  { key: 'carregamento', label: 'Carregamento (%)', hint: '* Mínimo de 1 e máximo de 3 dígitos', type: 'number' },
]
const analysisFisicoFields: AnalysisFieldDef[] = [
  { key: 'transformador', label: 'Transformador', hint: '* Digite o serial do Transformador' },
  { key: 'dataColeta', label: 'Data Coleta', hint: '* Selecione a data da Coleta', type: 'date' },
  { key: 'dataIntervencao', label: 'Data Intervenção', hint: 'Se existir selecione a Data Intervenção', type: 'date' },
  { key: 'intervencao', label: 'Intervenção', hint: 'Máximo de 255 dígitos' },
  { key: 'tempAmostra', label: 'Temp. Amostra (°C)', hint: 'Máximo de 11 dígitos', type: 'number' },
  { key: 'teorAgua', label: 'Teor de Água (ppm)', hint: '* Mínimo de 1 e máximo de 11 dígitos', type: 'number' },
  { key: 'tempOleo', label: 'Temp. Óleo (°C)', hint: 'Máximo de 11 dígitos', type: 'number' },
  { key: 'tempEnrolam', label: 'Temp. Enrolam. (°C)', hint: 'Máximo de 11 dígitos', type: 'number' },
  { key: 'rd', label: 'RD (kV)', hint: '* Mínimo de 1 e máximo de 11 dígitos', type: 'number' },
  { key: 'tif', label: 'TIF. (Dyn/cm)', hint: 'Mínimo de 1 e máximo de 11 dígitos', type: 'number' },
  { key: 'indNeutr', label: 'Índ. Neutr. (mgKHO/g)', hint: '* Mínimo de 1 e máximo de 12 dígitos', type: 'number' },
  { key: 'cor', label: 'COR', hint: 'Máximo de 11 dígitos', type: 'number' },
  { key: 'densRel', label: 'Dens. Rel. 20/4 °C (g/mL)', hint: 'Máximo de 12 dígitos', type: 'number' },
  { key: 'fPot25', label: 'F. Pot. 25ºC', hint: 'Máximo de 12 dígitos', type: 'number' },
  { key: 'fPot90', label: 'F. Pot. 90ºC', hint: 'Máximo de 12 dígitos', type: 'number' },
  { key: 'fPot100', label: 'F. Pot. 100ºC', hint: 'Máximo de 12 dígitos', type: 'number' },
  { key: 'ensaioDbpc', label: 'Ensaio de DBPC', hint: 'Máximo de 11 dígitos', type: 'number' },
  { key: 'laboratorio', label: 'Laboratório', hint: 'Máximo de 45 dígitos' },
]
const analysisEnsaiosFields: AnalysisFieldDef[] = [
  { key: 'transformador', label: 'Transformador', hint: '* Digite o serial do Transformador' },
  { key: 'dataColeta', label: 'Data Coleta', hint: '* Selecione a data da Coleta', type: 'date' },
  { key: 'enxofreCorrosivo', label: 'Enxofre corrosivo', hint: 'Escolha CORROSIVO ou NAO CORROSIVO', type: 'select', options: ['CORROSIVO', 'NAO CORROSIVO'] },
  { key: 'teorDbds', label: 'Teor de DBDS (mg/Kg)', hint: 'Máximo de 11 dígitos', type: 'number' },
  { key: 'teorPassivador', label: 'Teor de Passivador / IRGA (mg/Kg)', hint: 'Máximo de 11 dígitos', type: 'number' },
  { key: 'enxofreElementar', label: 'Enxofre Elementar', hint: 'Máximo de 11 dígitos', type: 'number' },
  { key: 'gpFabrica', label: 'GP de Fábrica', hint: 'Máximo de 11 dígitos numéricos inteiros', type: 'number' },
  { key: 'gp', label: 'GP', hint: 'Máximo de 11 dígitos numéricos inteiros', type: 'number' },
  { key: 'furanos', label: 'Furanos', hint: 'Máximo de 11 dígitos numéricos inteiros. Ref. Equação de Chendong', type: 'number' },
  { key: 'laboratorio', label: 'Laboratório', hint: 'Máximo de 45 dígitos' },
]
const analysisTransformerOptions = computed(() => {
  const seen = new Set<string>()
  return transformerOptions.value
    .map((item) => {
      const value = String(item.serial || '')
      const label = `${item.serial} • ${item.tag} • ${item.substation}`
      return { value, label }
    })
    .filter((item) => {
      if (!item.value || seen.has(item.value)) return false
      seen.add(item.value)
      return true
    })
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

function openAnalysisModal() {
  analysisNewMenuOpen.value = false
  const serial = selectedTransformer.value?.serial || ''
  analysisSendReport.value = {
    cromatografia: false,
    fisicoquimico: false,
    ensaiosespeciais: false,
  }
  analysisCromForm.value = {
    transformador: serial,
    dataColeta: '',
    dataIntervencao: '',
    intervencao: '',
    tempAmostra: '',
    tempOleo: '',
    tempEnrolam: '',
    hidrogenio: '',
    oxigenio: '',
    nitrogenio: '',
    monCarbono: '',
    metano: '',
    dioxCarbono: '',
    etileno: '',
    etano: '',
    acetileno: '',
    totalGases: '',
    tgc: '',
    laboratorio: '',
    carregamento: '',
  }
  analysisFisicoForm.value = {
    transformador: serial,
    dataColeta: '',
    dataIntervencao: '',
    intervencao: '',
    tempAmostra: '',
    teorAgua: '',
    tempOleo: '',
    tempEnrolam: '',
    rd: '',
    tif: '',
    indNeutr: '',
    cor: '',
    densRel: '',
    fPot25: '',
    fPot90: '',
    fPot100: '',
    ensaioDbpc: '',
    laboratorio: '',
  }
  analysisEnsaiosForm.value = {
    transformador: serial,
    dataColeta: '',
    enxofreCorrosivo: '',
    teorDbds: '',
    teorPassivador: '',
    enxofreElementar: '',
    gpFabrica: '',
    gp: '',
    furanos: '',
    laboratorio: '',
  }
  analysisModalTab.value = 'cromatografia'
  analysisModalOpen.value = true
}

function closeAnalysisModal() {
  analysisModalOpen.value = false
}

function saveAnalysisModal() {
  analysisModalOpen.value = false
}

function goToPreviousAnalysisPage() {
  analysisPage.value = Math.max(1, analysisPage.value - 1)
}

function goToNextAnalysisPage() {
  analysisPage.value = Math.min(analysisTotalPages.value, analysisPage.value + 1)
}

function hasAnalysisData(form: Record<string, string>) {
  return Object.entries(form).some(([key, value]) => key !== 'transformador' && String(value || '').trim() !== '')
}

watch(
  analysisCromForm,
  (form) => {
    if (hasAnalysisData(form)) analysisSendReport.value.cromatografia = true
  },
  { deep: true }
)

watch(
  analysisFisicoForm,
  (form) => {
    if (hasAnalysisData(form)) analysisSendReport.value.fisicoquimico = true
  },
  { deep: true }
)

watch(
  analysisEnsaiosForm,
  (form) => {
    if (hasAnalysisData(form)) analysisSendReport.value.ensaiosespeciais = true
  },
  { deep: true }
)

const cromatografiasRows = computed(() => {
  const data = parseLooseJson<BaseRow[]>(cromatografiasRaw)
  return [...data]
    .filter(rowMatchesSelectedTransformer)
    .sort((a, b) => parseBrDate(b.DATA_COLETA) - parseBrDate(a.DATA_COLETA))
    .slice(0, 8)
})

const latestCromatografiaRow = computed<BaseRow | null>(() => {
  const data = parseLooseJson<BaseRow[]>(cromatografiasRaw)
  return [...data]
    .filter(rowMatchesSelectedTransformer)
    .sort((a, b) => parseBrDate(b.DATA_COLETA) - parseBrDate(a.DATA_COLETA))[0] || null
})

const fisicoRows = computed(() => {
  const data = parseLooseJson<BaseRow[]>(fisicoQuimicosRaw)
  return [...data]
    .filter(rowMatchesSelectedTransformer)
    .sort((a, b) => parseBrDate(b.DATA_COLETA) - parseBrDate(a.DATA_COLETA))
    .slice(0, 8)
})

const fisicoOltcRows = computed(() => {
  const data = parseLooseJson<BaseRow[]>(fisicoQuimicosOltcRaw)
  return [...data]
    .filter(rowMatchesSelectedTransformer)
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

  parseLooseJson<BaseRow[]>(cromatografiasRaw)
    .filter(rowMatchesSelectedTransformer)
    .forEach((row) => {
    const time = parseBrDate(row.DATA_COLETA)
    if (!time) return
    add(new Date(time).getFullYear(), 'cromatografias')
  })

  parseLooseJson<BaseRow[]>(fisicoQuimicosRaw)
    .filter(rowMatchesSelectedTransformer)
    .forEach((row) => {
    const time = parseBrDate(row.DATA_COLETA)
    if (!time) return
    add(new Date(time).getFullYear(), 'fisicoQuimicos')
  })

  parseLooseJson<BaseRow[]>(fisicoQuimicosOltcRaw)
    .filter(rowMatchesSelectedTransformer)
    .forEach((row) => {
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
type AnalysisColumnGroup = 'Geral' | 'Cromatografia' | 'Físico Químico' | 'Ensaios Especiais'
type AnalysisColumn = {
  id: string
  label: string
  group: AnalysisColumnGroup
  defaultVisible: boolean
}
type UnifiedAnalysisRow = Record<string, string | number> & { id: string; sortTime: number }

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
    .filter(rowMatchesSelectedTransformer)
    .sort((a, b) => parseBrDate(a.DATA_COLETA) - parseBrDate(b.DATA_COLETA))
    .slice(-40)
})

const fisicoChartRows = computed(() => {
  const data = parseLooseJson<BaseRow[]>(fisicoQuimicosRaw)
  return [...data]
    .filter(rowMatchesSelectedTransformer)
    .sort((a, b) => parseBrDate(a.DATA_COLETA) - parseBrDate(b.DATA_COLETA))
    .slice(-40)
})

const ensaiosChartRows = computed(() => {
  const data = parseLooseJson<BaseRow[]>(fisicoQuimicosOltcRaw)
  return [...data]
    .filter(rowMatchesSelectedTransformer)
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
    toolbar: {
      show: true,
      tools: {
        reset:
          '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="display:block;transform:translateY(1px)"><path fill="currentColor" d="M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4z"/></svg>',
      },
    },
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
  responsive: [
    {
      breakpoint: 900,
      options: {
        xaxis: {
          labels: { show: false },
        },
      },
    },
  ],
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
const historyMobileRangeLabel = computed(() => {
  const categories = activeHistoryModel.value.categories
  if (!categories.length) return ''
  const first = categories[0] || ''
  const last = categories[categories.length - 1] || ''
  const compact = (value: string) => {
    const parts = value.split('/')
    if (parts.length !== 3) return value
    const year = parts[2]
    const shortYear = year.length >= 2 ? year.slice(-2) : year
    return `${parts[0]}/${parts[1]}/${shortYear}`
  }
  return `${compact(first)} - ${compact(last)}`
})
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

const analysisSearchDate = ref('')
const analysisColumnsMenuOpen = ref(false)
const analysisColumnsWrapRef = ref<HTMLElement | null>(null)
const analysisNewMenuOpen = ref(false)
const analysisExportMenuOpen = ref(false)
const analysisNewWrapRef = ref<HTMLElement | null>(null)
const analysisExportWrapRef = ref<HTMLElement | null>(null)
const analysisExportOptions = ['Análises', 'Cromatografia', 'Físico Químico']
const analysisExportSelected = ref<string[]>([])
const analysisPage = ref(1)
const analysisRowsPerPage = ref(10)
const analysisRowsPerPageOptions = [10, 20, 30, 50]
const analysisSearchInputType = ref<'text' | 'date'>('text')
const coletasActiveTab = ref<ColetasSubTab>('proximas')
const coletasNewMenuOpen = ref(false)
const coletasExportMenuOpen = ref(false)
const coletasNewWrapRef = ref<HTMLElement | null>(null)
const coletasExportWrapRef = ref<HTMLElement | null>(null)
const coletasExportOptions = ['Próximas', 'Realizadas']
const coletasExportSelected = ref<string[]>([])
const coletasSearchDate = ref('')
const coletasModalOpen = ref(false)
const coletasModalForm = ref({
  transformador: '',
  statusUltimaColeta: '',
  dataColeta: '',
  subestacao: '',
  unidade: '',
  tag: '',
  tipoAnalise: 'Cromatografia',
})
const manualColetas = ref<ColetaRow[]>([])
const treatmentSearch = ref('')
const treatmentColumnsMenuOpen = ref(false)
const treatmentNewMenuOpen = ref(false)
const treatmentColumnsWrapRef = ref<HTMLElement | null>(null)
const treatmentNewWrapRef = ref<HTMLElement | null>(null)
const treatmentDetailsModalOpen = ref(false)
const treatmentCreateModalOpen = ref(false)
const manualTreatmentRows = ref<TreatmentRow[]>([])
const treatmentLimitsOpen = ref(false)
const treatmentForm = ref({
  statusTratamento: 'Concluído',
  dataColeta: '',
  tipoAnalise: 'Físico Químico',
  rd: '',
  teorAgua: '',
  tensaoInterfacial: '',
  indNeutralizacao: '',
  fator25: '',
  fator90: '',
  fator100: '',
  dbpc: '',
})

const analysisColumns: AnalysisColumn[] = [
  { id: 'tipo', label: 'Tipo', group: 'Geral', defaultVisible: true },
  { id: 'transformador', label: 'Transformador', group: 'Geral', defaultVisible: true },
  { id: 'dataColeta', label: 'Data Coleta', group: 'Geral', defaultVisible: true },
  { id: 'subestacao', label: 'Subestação', group: 'Geral', defaultVisible: true },
  { id: 'unidade', label: 'Unidade', group: 'Geral', defaultVisible: true },
  { id: 'tag', label: 'Tag', group: 'Geral', defaultVisible: true },
  { id: 'dataIntervencao', label: 'Data Intervenção', group: 'Geral', defaultVisible: false },
  { id: 'intervencao', label: 'Intervenção', group: 'Geral', defaultVisible: false },
  { id: 'tempAmostra', label: 'Temp. Amostra (°C)', group: 'Geral', defaultVisible: false },
  { id: 'tempOleo', label: 'Temp. Óleo (°C)', group: 'Geral', defaultVisible: false },
  { id: 'tempEnrolam', label: 'Temp. Enrolam. (°C)', group: 'Geral', defaultVisible: false },
  { id: 'laboratorio', label: 'Laboratório', group: 'Geral', defaultVisible: true },
  { id: 'hidrogenio', label: 'Hidrogênio (H2)', group: 'Cromatografia', defaultVisible: true },
  { id: 'oxigenio', label: 'Oxigênio (O2)', group: 'Cromatografia', defaultVisible: false },
  { id: 'nitrogenio', label: 'Nitrogênio (N2)', group: 'Cromatografia', defaultVisible: false },
  { id: 'monCarbono', label: 'Mon. Carbono (CO)', group: 'Cromatografia', defaultVisible: true },
  { id: 'metano', label: 'Metano (CH4)', group: 'Cromatografia', defaultVisible: true },
  { id: 'dioxCarbono', label: 'Dióx. Carbono (CO2)', group: 'Cromatografia', defaultVisible: true },
  { id: 'etileno', label: 'Etileno (C2H4)', group: 'Cromatografia', defaultVisible: false },
  { id: 'etano', label: 'Etano (C2H6)', group: 'Cromatografia', defaultVisible: false },
  { id: 'acetileno', label: 'Acetileno (C2H2)', group: 'Cromatografia', defaultVisible: false },
  { id: 'totalGases', label: 'Total Gases', group: 'Cromatografia', defaultVisible: false },
  { id: 'tgcb', label: 'TGCB', group: 'Cromatografia', defaultVisible: true },
  { id: 'teorAgua', label: 'Teor de Água (ppm)', group: 'Físico Químico', defaultVisible: true },
  { id: 'rd', label: 'RD (kV)', group: 'Físico Químico', defaultVisible: true },
  { id: 'tif', label: 'TIF (Dyan/cm)', group: 'Físico Químico', defaultVisible: true },
  { id: 'indNeutr', label: 'Índ. Neutr. (mgKH0/g)', group: 'Físico Químico', defaultVisible: false },
  { id: 'cor', label: 'COR', group: 'Físico Químico', defaultVisible: false },
  { id: 'densRel', label: 'Dens. Rel. 20/4 °C (g/mL)', group: 'Físico Químico', defaultVisible: false },
  { id: 'fPot25', label: 'F. Pot. 25ºC', group: 'Físico Químico', defaultVisible: false },
  { id: 'fPot90', label: 'F. Pot. 90ºC', group: 'Físico Químico', defaultVisible: false },
  { id: 'fPot100', label: 'F. Pot. 100ºC', group: 'Físico Químico', defaultVisible: false },
  { id: 'ensaioDbpc', label: 'Ensaio de DBPC', group: 'Físico Químico', defaultVisible: false },
  { id: 'enxofreCorrosivo', label: 'Enxofre corrosivo', group: 'Ensaios Especiais', defaultVisible: true },
  { id: 'teorDbds', label: 'Teor de DBDS (mg/Kg)', group: 'Ensaios Especiais', defaultVisible: true },
  { id: 'teorPassivador', label: 'Teor de Passivador (mg/Kg)', group: 'Ensaios Especiais', defaultVisible: false },
  { id: 'enxofreElementar', label: 'Enxofre Elementar', group: 'Ensaios Especiais', defaultVisible: false },
  { id: 'gpFabrica', label: 'GP de Fábrica', group: 'Ensaios Especiais', defaultVisible: false },
  { id: 'gp', label: 'GP', group: 'Ensaios Especiais', defaultVisible: false },
  { id: 'furanos', label: 'Furanos', group: 'Ensaios Especiais', defaultVisible: false },
]

const analysisVisibleColumnIds = ref<string[]>(
  analysisColumns.filter((column) => column.defaultVisible).map((column) => column.id)
)

const analysisVisibleColumns = computed(() =>
  analysisColumns.filter((column) => analysisVisibleColumnIds.value.includes(column.id))
)

const analysisColumnsByGroup = computed(() => {
  const grouped = new Map<AnalysisColumnGroup, AnalysisColumn[]>()
  analysisColumns.forEach((column) => {
    if (!grouped.has(column.group)) grouped.set(column.group, [])
    grouped.get(column.group)!.push(column)
  })
  return grouped
})

function toggleAnalysisColumnsMenu() {
  analysisNewMenuOpen.value = false
  analysisExportMenuOpen.value = false
  generateReportMenuOpen.value = false
  analysisColumnsMenuOpen.value = !analysisColumnsMenuOpen.value
}

function closeAnalysisColumnsOnOutsideClick(event: MouseEvent) {
  const target = event.target as Node | null
  if (!target) return
  if (
    generateReportWrapRef.value?.contains(target) ||
    analysisColumnsWrapRef.value?.contains(target) ||
    analysisNewWrapRef.value?.contains(target) ||
    analysisExportWrapRef.value?.contains(target) ||
    coletasNewWrapRef.value?.contains(target) ||
    coletasExportWrapRef.value?.contains(target) ||
    treatmentColumnsWrapRef.value?.contains(target) ||
    treatmentNewWrapRef.value?.contains(target)
  ) {
    return
  }
  analysisColumnsMenuOpen.value = false
  generateReportMenuOpen.value = false
  analysisNewMenuOpen.value = false
  analysisExportMenuOpen.value = false
  coletasNewMenuOpen.value = false
  coletasExportMenuOpen.value = false
  treatmentColumnsMenuOpen.value = false
  treatmentNewMenuOpen.value = false
}

function toggleGenerateReportMenu() {
  analysisColumnsMenuOpen.value = false
  analysisNewMenuOpen.value = false
  analysisExportMenuOpen.value = false
  generateReportMenuOpen.value = !generateReportMenuOpen.value
}

function toggleGenerateReportItem(item: string) {
  if (generateReportSelected.value.includes(item)) {
    if (generateReportSelected.value.length === 1) return
    generateReportSelected.value = generateReportSelected.value.filter((value) => value !== item)
    return
  }
  generateReportSelected.value = [...generateReportSelected.value, item]
}

function downloadGeneratedReport() {
  if (!generateReportSelected.value.length) return
  generateReportMenuOpen.value = false
}

function toggleAnalysisNewMenu() {
  analysisColumnsMenuOpen.value = false
  analysisExportMenuOpen.value = false
  analysisNewMenuOpen.value = !analysisNewMenuOpen.value
}

function toggleAnalysisExportMenu() {
  analysisColumnsMenuOpen.value = false
  analysisNewMenuOpen.value = false
  analysisExportMenuOpen.value = !analysisExportMenuOpen.value
}

function toggleColetasNewMenu() {
  coletasExportMenuOpen.value = false
  coletasNewMenuOpen.value = !coletasNewMenuOpen.value
}

function toggleColetasExportMenu() {
  coletasNewMenuOpen.value = false
  coletasExportMenuOpen.value = !coletasExportMenuOpen.value
}

function toggleColetasExportOption(option: string) {
  if (coletasExportSelected.value.includes(option)) {
    coletasExportSelected.value = coletasExportSelected.value.filter((item) => item !== option)
    return
  }
  coletasExportSelected.value = [...coletasExportSelected.value, option]
}

function downloadColetasExports() {
  if (!coletasExportSelected.value.length) return
  coletasExportMenuOpen.value = false
}

function toggleTreatmentColumnsMenu() {
  treatmentNewMenuOpen.value = false
  treatmentColumnsMenuOpen.value = !treatmentColumnsMenuOpen.value
}

function toggleTreatmentColumn(columnId: string) {
  if (treatmentVisibleColumnIds.value.includes(columnId)) {
    if (treatmentVisibleColumnIds.value.length === 1) return
    treatmentVisibleColumnIds.value = treatmentVisibleColumnIds.value.filter((id) => id !== columnId)
    return
  }
  treatmentVisibleColumnIds.value = [...treatmentVisibleColumnIds.value, columnId]
}

function downloadTreatmentExports() {
  // Placeholder while backend export is not integrated.
}

function toggleTreatmentNewMenu() {
  treatmentColumnsMenuOpen.value = false
  treatmentNewMenuOpen.value = !treatmentNewMenuOpen.value
}

function openTreatmentCreateModal() {
  const latestFisico = fisicoRows.value[0] || {}
  treatmentNewMenuOpen.value = false
  treatmentForm.value = {
    statusTratamento: 'Concluído',
    dataColeta: '',
    tipoAnalise: 'Físico Químico',
    rd: normalizeCell((latestFisico as BaseRow).RD) === '-' ? '' : String((latestFisico as BaseRow).RD),
    teorAgua: normalizeCell((latestFisico as BaseRow).TEOR_AGUA) === '-' ? '' : String((latestFisico as BaseRow).TEOR_AGUA),
    tensaoInterfacial: normalizeCell((latestFisico as BaseRow).TENSAO_INTERFACIAL) === '-' ? '' : String((latestFisico as BaseRow).TENSAO_INTERFACIAL),
    indNeutralizacao: normalizeCell((latestFisico as BaseRow)['IND_NEUTRALIZACAO ']) === '-' ? '' : String((latestFisico as BaseRow)['IND_NEUTRALIZACAO ']),
    fator25: normalizeCell((latestFisico as BaseRow).FATOR_POT_25) === '-' ? '' : String((latestFisico as BaseRow).FATOR_POT_25),
    fator90: normalizeCell((latestFisico as BaseRow).FATOR_POT_90) === '-' ? '' : String((latestFisico as BaseRow).FATOR_POT_90),
    fator100: normalizeCell((latestFisico as BaseRow).FATOR_POT_100) === '-' ? '' : String((latestFisico as BaseRow).FATOR_POT_100),
    dbpc: normalizeCell((latestFisico as BaseRow).DBPC) === '-' ? '' : String((latestFisico as BaseRow).DBPC),
  }
  treatmentCreateModalOpen.value = true
}

function closeTreatmentCreateModal() {
  treatmentCreateModalOpen.value = false
}

function saveTreatmentCreateModal() {
  const selected = selectedTransformer.value
  if (!selected) return
  const dateText = treatmentForm.value.dataColeta
  const brDate = dateText ? dateText.split('-').reverse().join('/') : '-'
  const nextId = Date.now()
  manualTreatmentRows.value = [
    {
      id: `manual-treatment-${nextId}`,
      serial: selected.serial,
      statusTratamento: treatmentForm.value.statusTratamento || 'Concluído',
      equipamento: selected.equipment || '-',
      comutador: selected.commutator || '-',
      oleoFluido: selected.oilFluid || '-',
      tensaoPrimaria: selected.voltage || '-',
      tensaoSecundaria: '-',
      anoFabricacao: selected.year || '-',
      potencia: selected.power || '-',
      fabricante: selected.manufacturer || '-',
      volumeLitros: selected.volume || '-',
      refrigeracao: selected.refrigeration || '-',
      subestacao: selected.substation || '-',
      tag: selected.tag || '-',
      identificacao: selected.id || '-',
      carregamento: selected.load || '-',
      operando: selected.operating || '-',
      unidade: selected.unit || '-',
      selado: selected.sealed || '-',
      rd: treatmentForm.value.rd || '-',
      teorAgua: treatmentForm.value.teorAgua || '-',
      tensaoInterfacial: treatmentForm.value.tensaoInterfacial || '-',
      indNeutralizacao: treatmentForm.value.indNeutralizacao || '-',
      fator25: treatmentForm.value.fator25 || '-',
      fator90: treatmentForm.value.fator90 || '-',
      fator100: treatmentForm.value.fator100 || '-',
      dbpc: treatmentForm.value.dbpc || '-',
      tratamentoNome: `Tratamento a Óleo ${treatmentForm.value.tensaoInterfacial || '26.600'}`,
      dataColeta: brDate,
      tipoAnalise: treatmentForm.value.tipoAnalise || 'Físico Químico',
    },
    ...manualTreatmentRows.value,
  ]
  treatmentCreateModalOpen.value = false
}

function openTreatmentDetailsModal() {
  treatmentDetailsModalOpen.value = true
}

function closeTreatmentDetailsModal() {
  treatmentDetailsModalOpen.value = false
}

function openColetasModal() {
  const selected = selectedTransformer.value
  coletasNewMenuOpen.value = false
  coletasModalForm.value = {
    transformador: selected?.serial || '',
    statusUltimaColeta: selected?.status || 'Pendente',
    dataColeta: '',
    subestacao: selected?.substation || '',
    unidade: selected?.unit || '',
    tag: selected?.tag || '',
    tipoAnalise: 'Cromatografia',
  }
  coletasModalOpen.value = true
}

function closeColetasModal() {
  coletasModalOpen.value = false
}

function saveColetasModal() {
  const form = coletasModalForm.value
  if (!form.transformador || !form.dataColeta) return
  const parsed = parseIsoDate(form.dataColeta)
  const dateBr = parsed ? formatDateToBr(parsed) : form.dataColeta
  const faltamDias = parsed ? daysDiffFromToday(parsed) : 0
  const categoria: ColetasSubTab = 'proximas'
  manualColetas.value = [
    {
      id: `manual-coleta-${Date.now()}`,
      transformador: form.transformador,
      statusUltimaColeta: form.statusUltimaColeta || 'Pendente',
      dataColeta: dateBr,
      subestacao: form.subestacao || '-',
      unidade: form.unidade || '-',
      tag: form.tag || '-',
      tipoAnalise: form.tipoAnalise || 'Cromatografia',
      faltamDias,
      status: faltamDias < 0 ? 'Atrasada' : 'Pendente',
      categoria,
    },
    ...manualColetas.value,
  ]
  coletasModalOpen.value = false
}

function toggleAnalysisExportOption(option: string) {
  if (analysisExportSelected.value.includes(option)) {
    analysisExportSelected.value = analysisExportSelected.value.filter((item) => item !== option)
    return
  }
  analysisExportSelected.value = [...analysisExportSelected.value, option]
}

function downloadAnalysisExports() {
  if (!analysisExportSelected.value.length) return
  analysisExportMenuOpen.value = false
}

function toggleAnalysisColumn(columnId: string) {
  if (analysisVisibleColumnIds.value.includes(columnId)) {
    if (analysisVisibleColumnIds.value.length === 1) return
    analysisVisibleColumnIds.value = analysisVisibleColumnIds.value.filter((id) => id !== columnId)
    return
  }
  analysisVisibleColumnIds.value = [...analysisVisibleColumnIds.value, columnId]
}

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return '-'
  const text = String(value).trim()
  return text ? text : '-'
}

function pickCell(row: BaseRow, ...keys: string[]) {
  for (const key of keys) {
    if (key in row && row[key] !== null && row[key] !== undefined && String(row[key]).trim()) {
      return normalizeCell(row[key])
    }
  }
  return '-'
}

function normalizedToken(value: unknown) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
}

const analysisDataSerialAliases: Record<string, string[]> = {
  '9701-A01': ['3792', 'OLTC-0001'],
}

function rowMatchesSelectedTransformer(row: BaseRow) {
  const selected = selectedTransformer.value
  if (!selected) return true

  const selectedSerial = normalizedToken(selected.serial)
  const serialAliases = (analysisDataSerialAliases[selected.id] || []).map((value) => normalizedToken(value))
  const serialCandidates = new Set([selectedSerial, ...serialAliases].filter(Boolean))
  const selectedTag = normalizedToken(selected.tag)
  const selectedUnit = normalizedToken(selected.unit)
  const selectedSubstation = normalizedToken(selected.substation)

  const rowSerial = normalizedToken(row.NUM_SERIE ?? row.SERIAL_TRANSFORMADOR)
  const rowTag = normalizedToken(row.TAG)
  const rowUnit = normalizedToken(row.UNIDADE)
  const rowSubstation = normalizedToken(row.SUBESTACAO)

  if (rowSerial) return serialCandidates.has(rowSerial)

  if (rowTag && rowTag !== selectedTag) return false
  if (rowUnit && rowUnit !== selectedUnit) return false
  if (rowSubstation && rowSubstation !== selectedSubstation) return false

  return true
}

const unifiedAnalysisRows = computed<UnifiedAnalysisRow[]>(() => {
  const selected = selectedTransformer.value
  const fallbackSubstation = selected?.substation || '-'
  const fallbackUnit = selected?.unit || '-'
  const fallbackTag = selected?.tag || '-'
  const fallbackTransformer = selected?.serial || selected?.id || '-'

  const asCommon = (row: BaseRow, tipo: string, index: number): UnifiedAnalysisRow => {
    const dataColeta = normalizeCell(row.DATA_COLETA)
    return {
      id: `${tipo}-${index}-${dataColeta}`,
      sortTime: parseBrDate(row.DATA_COLETA),
      tipo,
      transformador: pickCell(row, 'NUM_SERIE', 'SERIAL_TRANSFORMADOR') || fallbackTransformer,
      dataColeta,
      subestacao: pickCell(row, 'SUBESTACAO') !== '-' ? pickCell(row, 'SUBESTACAO') : fallbackSubstation,
      unidade: pickCell(row, 'UNIDADE') !== '-' ? pickCell(row, 'UNIDADE') : fallbackUnit,
      tag: pickCell(row, 'TAG') !== '-' ? pickCell(row, 'TAG') : fallbackTag,
      dataIntervencao: normalizeCell(row.DATA_INTERVENCAO),
      intervencao: normalizeCell(row.INTERVENCAO),
      tempAmostra: normalizeCell(row.TEMP_AMOSTRA),
      tempOleo: normalizeCell(row.TEMP_OLEO),
      tempEnrolam: normalizeCell(row.TEMP_ENROLAMENTO),
      laboratorio: normalizeCell(row.LAB),
      hidrogenio: '-',
      oxigenio: '-',
      nitrogenio: '-',
      monCarbono: '-',
      metano: '-',
      dioxCarbono: '-',
      etileno: '-',
      etano: '-',
      acetileno: '-',
      totalGases: '-',
      tgcb: '-',
      teorAgua: '-',
      rd: '-',
      tif: '-',
      indNeutr: '-',
      cor: '-',
      densRel: '-',
      fPot25: '-',
      fPot90: '-',
      fPot100: '-',
      ensaioDbpc: '-',
      enxofreCorrosivo: '-',
      teorDbds: '-',
      teorPassivador: '-',
      enxofreElementar: '-',
      gpFabrica: '-',
      gp: '-',
      furanos: '-',
    }
  }

  const cromRows = parseLooseJson<BaseRow[]>(cromatografiasRaw)
    .filter(rowMatchesSelectedTransformer)
    .map((row, index) => {
    const base = asCommon(row, 'Cromatografia', index)
    return {
      ...base,
      hidrogenio: normalizeCell(row.HIDROGENIO),
      oxigenio: normalizeCell(row.OXIGENIO),
      nitrogenio: normalizeCell(row.NITROGENIO),
      monCarbono: normalizeCell(row.MONOX_CARBONO),
      metano: normalizeCell(row.METANO),
      dioxCarbono: normalizeCell(row.DIOX_CARBONO),
      etileno: normalizeCell(row.ETILENO),
      etano: normalizeCell(row.ETANO),
      acetileno: normalizeCell(row.ACETILENO),
      totalGases: normalizeCell(row.TOTAL_GASES),
      tgcb: normalizeCell(row.TOTAL_GASES_COMB),
    }
  })

  const fisicoRowsAll = parseLooseJson<BaseRow[]>(fisicoQuimicosRaw)
    .filter(rowMatchesSelectedTransformer)
    .map((row, index) => {
    const base = asCommon(row, 'Físico Químico', index)
    return {
      ...base,
      teorAgua: normalizeCell(row.TEOR_AGUA),
      rd: normalizeCell(row.RD),
      tif: normalizeCell(row.TENSAO_INTERFACIAL),
      indNeutr: normalizeCell(row['IND_NEUTRALIZACAO ']),
      cor: normalizeCell(row.COR),
      densRel: normalizeCell(row.DENS_RELATIVA),
      fPot25: normalizeCell(row.FATOR_POT_25),
      fPot90: normalizeCell(row.FATOR_POT_90),
      fPot100: normalizeCell(row.FATOR_POT_100),
      ensaioDbpc: normalizeCell(row.DBPC),
    }
  })

  const ensaiosRowsAll = parseLooseJson<BaseRow[]>(fisicoQuimicosOltcRaw)
    .filter(rowMatchesSelectedTransformer)
    .map((row, index) => {
    const base = asCommon(row, 'Ensaios Especiais', index)
    return {
      ...base,
      enxofreCorrosivo: pickCell(row, 'ENXOFRE_CORROSIVO'),
      teorDbds: pickCell(row, 'TEOR_DBDS'),
      teorPassivador: pickCell(row, 'TEOR_PASSIVADOR'),
      enxofreElementar: pickCell(row, 'ENXOFRE_ELEMENTAR'),
      gpFabrica: pickCell(row, 'GP_FABRICA'),
      gp: pickCell(row, 'GP'),
      furanos: pickCell(row, 'FURANOS'),
    }
  })

  return [...cromRows, ...fisicoRowsAll, ...ensaiosRowsAll].sort((a, b) => b.sortTime - a.sortTime)
})

const filteredUnifiedAnalysisRows = computed(() => {
  const query = analysisSearchDate.value.trim()
  if (!query) return unifiedAnalysisRows.value
  const formattedQuery = query.includes('-')
    ? query.split('-').reverse().join('/')
    : query
  return unifiedAnalysisRows.value.filter((row) => String(row.dataColeta) === formattedQuery)
})

const analysisTotalPages = computed(() => {
  const total = filteredUnifiedAnalysisRows.value.length
  return Math.max(1, Math.ceil(total / analysisRowsPerPage.value))
})

const paginatedUnifiedAnalysisRows = computed(() => {
  const start = (analysisPage.value - 1) * analysisRowsPerPage.value
  const end = start + analysisRowsPerPage.value
  return filteredUnifiedAnalysisRows.value.slice(start, end)
})

const analysisRangeLabel = computed(() => {
  const total = filteredUnifiedAnalysisRows.value.length
  if (!total) return '0 de 0'
  const start = (analysisPage.value - 1) * analysisRowsPerPage.value + 1
  const end = Math.min(analysisPage.value * analysisRowsPerPage.value, total)
  return `${start}-${end} de ${total}`
})

watch(analysisRowsPerPage, () => {
  analysisPage.value = 1
})

watch(analysisSearchDate, () => {
  analysisPage.value = 1
})

watch(selectedId, () => {
  analysisPage.value = 1
})

watch(
  () => filteredUnifiedAnalysisRows.value.length,
  () => {
    if (analysisPage.value > analysisTotalPages.value) {
      analysisPage.value = analysisTotalPages.value
    }
  }
)

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

function parseIsoDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDateToBr(value: Date) {
  return value.toLocaleDateString('pt-BR')
}

function daysDiffFromToday(value: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((value.getTime() - today.getTime()) / 86400000)
}

const coletasRows = computed(() => {
  const selected = selectedTransformer.value
  if (!selected) return { proximas: [] as ColetaRow[], realizadas: [] as ColetaRow[] }

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const offsets = selected.status === 'Crítico' ? [3, 7, 15] : selected.status === 'Alerta' ? [7, 15, 30] : [15, 30, 60]
  const defaultTipos = ['Cromatografia', 'Físico Químico', 'Ensaios Especiais']

  const proximasBase: ColetaRow[] = offsets.map((days, index) => {
    const date = new Date(now)
    date.setDate(now.getDate() + days)
    const faltamDias = daysDiffFromToday(date)
    return {
      id: `${selected.id}-coleta-prox-${index}`,
      transformador: selected.serial,
      statusUltimaColeta: selected.status,
      dataColeta: formatDateToBr(date),
      subestacao: selected.substation,
      unidade: selected.unit,
      tag: selected.tag,
      tipoAnalise: defaultTipos[index] || 'Cromatografia',
      faltamDias,
      status: faltamDias < 0 ? 'Atrasada' : 'Pendente',
      categoria: 'proximas',
    }
  })

  const previewOverdueDate = new Date(now)
  previewOverdueDate.setDate(now.getDate() - 2)
  const previewOverdue: ColetaRow = {
    id: `${selected.id}-coleta-preview-atrasada`,
    transformador: selected.serial,
    statusUltimaColeta: selected.status,
    dataColeta: formatDateToBr(previewOverdueDate),
    subestacao: selected.substation,
    unidade: selected.unit,
    tag: selected.tag,
    tipoAnalise: 'Cromatografia',
    faltamDias: daysDiffFromToday(previewOverdueDate),
    status: 'Atrasada',
    categoria: 'proximas',
  }

  const realizadasBase: ColetaRow[] = unifiedAnalysisRows.value
    .slice(0, 8)
    .map((row, index) => ({
      id: `${selected.id}-coleta-real-${index}-${row.id}`,
      transformador: String(row.transformador || selected.serial),
      statusUltimaColeta: selected.status,
      dataColeta: String(row.dataColeta || '-'),
      subestacao: String(row.subestacao || selected.substation),
      unidade: String(row.unidade || selected.unit),
      tag: String(row.tag || selected.tag),
      tipoAnalise: String(row.tipo || 'Cromatografia'),
      faltamDias: 0,
      status: 'Coletado',
      categoria: 'realizadas',
    }))

  const manualRows = manualColetas.value.filter((row) => row.transformador === selected.serial)

  const proximasManual = manualRows
    .filter((row) => row.categoria === 'proximas')
    .map((row) => {
      const parsed = parseBrDate(row.dataColeta)
      const date = parsed ? new Date(parsed) : now
      const faltamDias = daysDiffFromToday(date)
      return {
        ...row,
        faltamDias,
        status: faltamDias < 0 ? 'Atrasada' : 'Pendente',
      }
    })

  const realizadasManual = manualRows
    .filter((row) => row.categoria === 'realizadas')
    .map((row) => ({
      ...row,
      faltamDias: 0,
      status: 'Coletado' as const,
    }))

  return {
    proximas: [previewOverdue, ...proximasManual, ...proximasBase],
    realizadas: [...realizadasManual, ...realizadasBase],
  }
})

const coletasFilteredRows = computed(() => {
  const rows = coletasActiveTab.value === 'proximas' ? coletasRows.value.proximas : coletasRows.value.realizadas
  const query = coletasSearchDate.value.trim()
  if (!query) return rows
  const formattedQuery = query.includes('-') ? query.split('-').reverse().join('/') : query
  return rows.filter((row) => row.dataColeta === formattedQuery)
})

const treatmentColumns: TreatmentColumn[] = [
  { id: 'serial', label: 'No. Série', defaultVisible: true },
  { id: 'statusTratamento', label: 'Status Tratamento', defaultVisible: true },
  { id: 'equipamento', label: 'Equipamento', defaultVisible: false },
  { id: 'comutador', label: 'Comutador', defaultVisible: false },
  { id: 'oleoFluido', label: 'Oleo fluido', defaultVisible: false },
  { id: 'tensaoPrimaria', label: 'T. Primária (kV)', defaultVisible: true },
  { id: 'tensaoSecundaria', label: 'T. Secundária (kV)', defaultVisible: false },
  { id: 'anoFabricacao', label: 'Ano de fabricação', defaultVisible: false },
  { id: 'potencia', label: 'Potencia (kVA)', defaultVisible: true },
  { id: 'fabricante', label: 'Fabricante', defaultVisible: false },
  { id: 'volumeLitros', label: 'Volume em litros', defaultVisible: false },
  { id: 'refrigeracao', label: 'Refrigeração', defaultVisible: false },
  { id: 'subestacao', label: 'Subestação', defaultVisible: true },
  { id: 'tag', label: 'TAG', defaultVisible: true },
  { id: 'identificacao', label: 'Identificação', defaultVisible: false },
  { id: 'carregamento', label: 'Carregamento (%)', defaultVisible: false },
  { id: 'operando', label: 'Operando', defaultVisible: false },
  { id: 'unidade', label: 'Unidade', defaultVisible: true },
  { id: 'selado', label: 'Selado', defaultVisible: false },
  { id: 'rd', label: 'RD', defaultVisible: false },
  { id: 'teorAgua', label: 'Teor de Água', defaultVisible: false },
  { id: 'tensaoInterfacial', label: 'Tensão Interfacial', defaultVisible: false },
  { id: 'indNeutralizacao', label: 'Ind. Neutralização', defaultVisible: false },
  { id: 'fator25', label: 'Fator 25', defaultVisible: false },
  { id: 'fator90', label: 'Fator 90', defaultVisible: false },
  { id: 'fator100', label: 'Fator 100', defaultVisible: false },
  { id: 'dbpc', label: 'DBPC', defaultVisible: false },
]

const treatmentVisibleColumnIds = ref<string[]>(
  treatmentColumns.filter((column) => column.defaultVisible).map((column) => column.id)
)

const treatmentVisibleColumns = computed(() =>
  treatmentColumns.filter((column) => treatmentVisibleColumnIds.value.includes(column.id))
)

const treatmentRows = computed<TreatmentRow[]>(() => {
  const selected = selectedTransformer.value
  if (!selected) return []
  const latestFisico = fisicoRows.value[0] || {}
  const treatmentName = `Tratamento a Óleo ${normalizeCell((latestFisico as BaseRow).TENSAO_INTERFACIAL)}`
  const baseRow: TreatmentRow = {
    id: `treatment-${selected.id}`,
    serial: selected.serial,
    statusTratamento: 'Concluído',
    equipamento: selected.equipment || '-',
    comutador: selected.commutator || '-',
    oleoFluido: selected.oilFluid || '-',
    tensaoPrimaria: selected.voltage || '-',
    tensaoSecundaria: '-',
    anoFabricacao: selected.year || '-',
    potencia: selected.power || '-',
    fabricante: selected.manufacturer || '-',
    volumeLitros: selected.volume || '-',
    refrigeracao: selected.refrigeration || '-',
    subestacao: selected.substation || '-',
    tag: selected.tag || '-',
    identificacao: selected.id || '-',
    carregamento: selected.load || '-',
    operando: selected.operating || '-',
    unidade: selected.unit || '-',
    selado: selected.sealed || '-',
    rd: normalizeCell((latestFisico as BaseRow).RD),
    teorAgua: normalizeCell((latestFisico as BaseRow).TEOR_AGUA),
    tensaoInterfacial: normalizeCell((latestFisico as BaseRow).TENSAO_INTERFACIAL),
    indNeutralizacao: normalizeCell((latestFisico as BaseRow)['IND_NEUTRALIZACAO ']),
    fator25: normalizeCell((latestFisico as BaseRow).FATOR_POT_25),
    fator90: normalizeCell((latestFisico as BaseRow).FATOR_POT_90),
    fator100: normalizeCell((latestFisico as BaseRow).FATOR_POT_100),
    dbpc: normalizeCell((latestFisico as BaseRow).DBPC),
    tratamentoNome: treatmentName,
    dataColeta: normalizeCell((latestFisico as BaseRow).DATA_COLETA),
    tipoAnalise: 'Físico Químico',
  }
  const previews: TreatmentRow[] = [1, 2].map((idx) => ({
    ...baseRow,
    id: `treatment-${selected.id}-preview-${idx}`,
    tratamentoNome: `Tratamento a Óleo ${idx === 1 ? '26.600' : '34.400'}`,
    statusTratamento: 'Concluído',
  }))
  const manualForSelected = manualTreatmentRows.value.filter((row) => String(row.serial) === selected.serial)
  return [baseRow, ...previews, ...manualForSelected]
})

const treatmentFilteredRows = computed(() => {
  const query = treatmentSearch.value.trim().toLowerCase()
  if (!query) return treatmentRows.value
  return treatmentRows.value.filter((row) =>
    Object.values(row).some((value) => String(value).toLowerCase().includes(query))
  )
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
  if (text.includes('atras')) return 'tone-danger'
  if (text.includes('colet')) return 'tone-normal'
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
  document.addEventListener('click', closeAnalysisColumnsOnOutsideClick)
})

onUnmounted(() => {
  window.removeEventListener('resize', enhanceMobileTables)
  document.removeEventListener('click', closeAnalysisColumnsOnOutsideClick)
})

watch([activeTab, selectedId], async () => {
  await nextTick()
  enhanceMobileTables()
  generateReportMenuOpen.value = false
  if (activeTab.value !== 'Histórico de Análises') {
    analysisColumnsMenuOpen.value = false
    analysisNewMenuOpen.value = false
    analysisExportMenuOpen.value = false
  }
  if (activeTab.value !== 'Coletas') {
    coletasNewMenuOpen.value = false
    coletasExportMenuOpen.value = false
    coletasModalOpen.value = false
  }
  if (activeTab.value !== 'Tratamento de Óleo') {
    treatmentColumnsMenuOpen.value = false
    treatmentNewMenuOpen.value = false
    treatmentDetailsModalOpen.value = false
    treatmentCreateModalOpen.value = false
  }
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
        <div class="report-toolbar-actions">
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
          <div ref="generateReportWrapRef" class="report-generate-wrap">
            <button type="button" class="locate-btn" @click="toggleGenerateReportMenu">
              <span class="history-action-icon" aria-hidden="true">⭳</span>
              Gerar Relatório
            </button>
            <div v-if="generateReportMenuOpen" class="report-generate-menu">
              <label v-for="item in generateReportItems" :key="`report-item-${item}`" class="history-export-option">
                <input
                  type="checkbox"
                  :checked="generateReportSelected.includes(item)"
                  :disabled="generateReportSelected.length === 1 && generateReportSelected.includes(item)"
                  @change="toggleGenerateReportItem(item)"
                />
                <span>{{ item }}</span>
              </label>
              <button
                type="button"
                class="history-export-download-btn"
                :disabled="!generateReportSelected.length"
                @click="downloadGeneratedReport"
              >
                Baixar
              </button>
            </div>
          </div>
        </div>
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
          <div class="history-line-head coletas-line-head">
            <div class="history-tab-select-wrap">
              <select v-model="historyActiveTab" class="history-tab-select" aria-label="Selecionar tipo de gráfico">
                <option value="cromatografia">Cromotografia</option>
                <option value="fisicoquimica">Físico Químico</option>
                <option value="ensaiosespeciais">Ensaios Especiais</option>
              </select>
            </div>
            <div class="history-tabs-inline history-tabs-main coletas-tabs-center">
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
            <p class="history-mobile-range">{{ historyMobileRangeLabel }}</p>
          </article>
          </div>
        </article>
        <p v-else class="empty">Sem histórico suficiente para gráfico.</p>
        <article class="history-block-card history-analyses-card">
          <p class="history-analyses-title">Análises Recentes</p>
          <div class="history-analyses-head">
            <div class="history-analyses-controls">
              <label class="history-analysis-search">
                <input
                  v-model="analysisSearchDate"
                  type="date"
                  aria-label="Pesquisar por data da coleta"
                />
              </label>
              <div ref="analysisColumnsWrapRef" class="history-columns-picker">
                <button type="button" class="history-columns-trigger" @click="toggleAnalysisColumnsMenu">
                  <span>Colunas</span>
                  <i aria-hidden="true">▾</i>
                </button>
                <div v-if="analysisColumnsMenuOpen" class="history-columns-menu">
                  <section
                    v-for="[group, columns] in analysisColumnsByGroup"
                    :key="group"
                    class="history-columns-group"
                  >
                    <p>{{ group }}</p>
                    <label v-for="column in columns" :key="column.id" class="history-columns-option">
                      <input
                        type="checkbox"
                        :checked="analysisVisibleColumnIds.includes(column.id)"
                        :disabled="analysisVisibleColumnIds.length === 1 && analysisVisibleColumnIds.includes(column.id)"
                        @change="toggleAnalysisColumn(column.id)"
                      />
                      <span>{{ column.label }}</span>
                    </label>
                  </section>
                </div>
              </div>
            </div>
            <div class="history-analyses-actions">
              <div ref="analysisNewWrapRef" class="history-actions-wrap">
                <button type="button" class="history-action-btn" @click="toggleAnalysisNewMenu">
                  <span class="history-action-icon" aria-hidden="true">＋</span>
                  Novo
                </button>
                <div v-if="analysisNewMenuOpen" class="history-actions-menu">
                  <button type="button" @click="openAnalysisModal">Nova Análise</button>
                  <button type="button">Importar Análises</button>
                </div>
              </div>
              <div ref="analysisExportWrapRef" class="history-actions-wrap">
                <button type="button" class="history-action-btn" @click="toggleAnalysisExportMenu">
                  <span class="history-action-icon" aria-hidden="true">⭳</span>
                  Exportar
                </button>
                <div v-if="analysisExportMenuOpen" class="history-actions-menu">
                  <label
                    v-for="option in analysisExportOptions"
                    :key="`export-option-${option}`"
                    class="history-export-option"
                  >
                    <input
                      type="checkbox"
                      :checked="analysisExportSelected.includes(option)"
                      @change="toggleAnalysisExportOption(option)"
                    />
                    <span>{{ option }}</span>
                  </label>
                  <button
                    type="button"
                    class="history-export-download-btn"
                    :disabled="!analysisExportSelected.length"
                    @click="downloadAnalysisExports"
                  >
                    Baixar
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="mini-table-wrap history-analyses-table-wrap">
            <table class="table compact analysis-table">
              <thead>
                <tr>
                  <th v-for="column in analysisVisibleColumns" :key="column.id" class="text-center">
                    {{ column.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in paginatedUnifiedAnalysisRows" :key="row.id">
                  <td v-for="column in analysisVisibleColumns" :key="`${row.id}-${column.id}`" class="text-center">
                    {{ row[column.id] }}
                  </td>
                </tr>
                <tr v-if="!filteredUnifiedAnalysisRows.length">
                  <td class="text-center" :colspan="analysisVisibleColumns.length">
                    Nenhuma análise encontrada para o filtro informado.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="history-analyses-pagination">
            <label class="history-rows-per-page">
              <span>Itens por página</span>
              <select v-model.number="analysisRowsPerPage">
                <option v-for="size in analysisRowsPerPageOptions" :key="`rows-${size}`" :value="size">
                  {{ size }}
                </option>
              </select>
            </label>
            <span class="history-page-range">{{ analysisRangeLabel }}</span>
            <button
              type="button"
              class="history-page-btn"
              :disabled="analysisPage <= 1"
              @click="goToPreviousAnalysisPage"
            >
              Anterior
            </button>
            <span class="history-page-current">Página {{ analysisPage }} de {{ analysisTotalPages }}</span>
            <button
              type="button"
              class="history-page-btn"
              :disabled="analysisPage >= analysisTotalPages"
              @click="goToNextAnalysisPage"
            >
              Próxima
            </button>
          </div>
        </article>
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
            <table class="table compact mini-table limit-reference-table">
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

      <section v-else-if="activeTab === 'Coletas'" class="panel table-panel history-panel">
        <article class="history-block-card">
          <div class="history-line-head coletas-line-head-two">
            <div class="history-analyses-controls history-analyses-controls-left coletas-controls-left">
              <label class="history-analysis-search">
                <input
                  v-model="coletasSearchDate"
                  type="date"
                  aria-label="Filtrar coletas por data"
                />
              </label>
              <div class="history-tabs-inline history-tabs-main">
                <button
                  type="button"
                  class="history-tab-btn"
                  :class="{ active: coletasActiveTab === 'proximas' }"
                  @click="coletasActiveTab = 'proximas'"
                >
                  Próximas
                </button>
                <button
                  type="button"
                  class="history-tab-btn"
                  :class="{ active: coletasActiveTab === 'realizadas' }"
                  @click="coletasActiveTab = 'realizadas'"
                >
                  Realizadas
                </button>
              </div>
            </div>
            <div class="history-analyses-actions">
              <div ref="coletasNewWrapRef" class="history-actions-wrap">
                <button type="button" class="history-action-btn" @click="toggleColetasNewMenu">
                  <span class="history-action-icon" aria-hidden="true">＋</span>
                  Novo
                </button>
                <div v-if="coletasNewMenuOpen" class="history-actions-menu">
                  <button type="button" @click="openColetasModal">Nova Coleta</button>
                  <button type="button">Importar Coletas</button>
                </div>
              </div>
              <div ref="coletasExportWrapRef" class="history-actions-wrap">
                <button type="button" class="history-action-btn" @click="toggleColetasExportMenu">
                  <span class="history-action-icon" aria-hidden="true">⭳</span>
                  Exportar
                </button>
                <div v-if="coletasExportMenuOpen" class="history-actions-menu">
                  <label
                    v-for="option in coletasExportOptions"
                    :key="`coleta-export-option-${option}`"
                    class="history-export-option"
                  >
                    <input
                      type="checkbox"
                      :checked="coletasExportSelected.includes(option)"
                      @change="toggleColetasExportOption(option)"
                    />
                    <span>{{ option }}</span>
                  </label>
                  <button
                    type="button"
                    class="history-export-download-btn"
                    :disabled="!coletasExportSelected.length"
                    @click="downloadColetasExports"
                  >
                    Baixar
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="mini-table-wrap history-analyses-table-wrap">
            <table class="table compact analysis-table">
              <thead>
                <tr>
                  <th class="text-center">Transformador</th>
                  <th class="text-center">Status</th>
                  <th class="text-center">Status Última Coleta</th>
                  <th class="text-center">{{ coletasActiveTab === 'proximas' ? 'Próxima Data Coleta' : 'Data Coleta' }}</th>
                  <th class="text-center">Subestação</th>
                  <th class="text-center">Unidade</th>
                  <th class="text-center">Tag</th>
                  <th class="text-center">Tipo de Análise</th>
                  <th class="text-center">Faltam Dia(s)</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in coletasFilteredRows"
                  :key="row.id"
                >
                  <td class="text-center">{{ row.transformador }}</td>
                  <td class="text-center">
                    <span class="pill" :class="statusClass(row.status)">{{ row.status }}</span>
                  </td>
                  <td class="text-center">{{ row.statusUltimaColeta }}</td>
                  <td class="text-center">{{ row.dataColeta }}</td>
                  <td class="text-center">{{ row.subestacao }}</td>
                  <td class="text-center">{{ row.unidade }}</td>
                  <td class="text-center">{{ row.tag }}</td>
                  <td class="text-center">{{ row.tipoAnalise }}</td>
                  <td class="text-center">{{ row.status === 'Coletado' ? '-' : row.faltamDias }}</td>
                </tr>
                <tr v-if="!coletasFilteredRows.length">
                  <td class="text-center" colspan="9">Sem coletas cadastradas.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section v-else-if="activeTab === 'Tratamento de Óleo'" class="panel table-panel history-panel">
        <article class="history-block-card">
          <button
            type="button"
            class="expandable-head-btn"
            :class="{ open: treatmentLimitsOpen }"
            @click="treatmentLimitsOpen = !treatmentLimitsOpen"
          >
            <span>Tabela Limite Para Ação Corretiva (Referência: NBR 10576/2017)</span>
            <i class="expandable-toggle-icon" aria-hidden="true">{{ treatmentLimitsOpen ? '−' : '+' }}</i>
          </button>
          <div v-if="treatmentLimitsOpen" class="mini-table-wrap history-analyses-table-wrap">
            <table class="table compact mini-table limit-reference-table">
              <tbody>
                <tr>
                  <th class="text-center" colspan="5">
                    Transformadores E Reatores Em Uso - Tabela Limite Para Ação Corretiva (Referência: NBR 10576/2017)
                  </th>
                </tr>
                <tr class="limit-reference-head-row">
                  <td>Ensaio</td>
                  <td>Método</td>
                  <td>Valor</td>
                  <td>
                    <div class="limit-table-class-head">Classe de tensão (kV)</div>
                    <div class="limit-table-class-grid">
                      <span>&lt; 36.2</span>
                      <span>36.2 - 72.5</span>
                      <span>72.5 - 145</span>
                      <span>145 &gt;</span>
                    </div>
                  </td>
                  <td>Recomendação, caso fora de especificação</td>
                </tr>
                <tr>
                  <td>RD (rigidez dielétrica)</td>
                  <td>ABNT NBR IEC 60156</td>
                  <td>mínimo</td>
                  <td>
                    <div class="limit-table-class-grid"><span>40</span><span>40</span><span>50</span><span>60</span></div>
                  </td>
                  <td>Recondicionamento</td>
                </tr>
                <tr>
                  <td>Teor de água</td>
                  <td>ABNT NBR 10710</td>
                  <td>máximo</td>
                  <td>
                    <div class="limit-table-class-grid"><span>40</span><span>40</span><span>30</span><span>20</span></div>
                  </td>
                  <td>Recondicionamento</td>
                </tr>
                <tr>
                  <td>FP 25°C</td>
                  <td>ABNT NBR 12133</td>
                  <td>máximo</td>
                  <td>
                    <div class="limit-table-class-grid"><span>0.5</span><span>0.5</span><span>0.5</span><span>-</span></div>
                  </td>
                  <td>Regeneração ou troca de óleo</td>
                </tr>
                <tr>
                  <td>FP 90°C</td>
                  <td>ABNT NBR 12133</td>
                  <td>máximo</td>
                  <td>
                    <div class="limit-table-class-grid"><span>15</span><span>15</span><span>15</span><span>12</span></div>
                  </td>
                  <td>Regeneração ou troca de óleo</td>
                </tr>
                <tr>
                  <td>FP 100°C</td>
                  <td>ABNT NBR 12133</td>
                  <td>máximo</td>
                  <td>
                    <div class="limit-table-class-grid"><span>20</span><span>20</span><span>20</span><span>15</span></div>
                  </td>
                  <td>Regeneração ou troca de óleo</td>
                </tr>
                <tr>
                  <td>Acidez (IN)</td>
                  <td>ABNT NBR 14248</td>
                  <td>máximo</td>
                  <td>
                    <div class="limit-table-class-grid"><span>0.2</span><span>0.2</span><span>0.15</span><span>0.15</span></div>
                  </td>
                  <td>Regeneração ou troca de óleo</td>
                </tr>
                <tr>
                  <td>TIF (tensão interfacial)</td>
                  <td>ABNT NBR 6234</td>
                  <td>mínimo</td>
                  <td>
                    <div class="limit-table-class-grid"><span>20</span><span>20</span><span>22</span><span>25</span></div>
                  </td>
                  <td>Regeneração ou troca de óleo</td>
                </tr>
                <tr>
                  <td>DBPC (%)</td>
                  <td>ABNT NBR 12134</td>
                  <td>mínimo</td>
                  <td>
                    <div class="limit-table-class-grid"><span>0.1</span><span>0.1</span><span>0.1</span><span>0.1</span></div>
                  </td>
                  <td>Readição de antioxidante</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="history-block-card">
          <div class="history-line-head coletas-line-head-two">
            <div class="history-analyses-controls history-analyses-controls-left">
              <label class="history-analysis-search">
                <input
                  v-model="treatmentSearch"
                  type="search"
                  placeholder="Pesquisar..."
                  aria-label="Filtrar tratamento de óleo"
                />
              </label>
              <div ref="treatmentColumnsWrapRef" class="history-columns-picker">
                <button type="button" class="history-columns-trigger" @click="toggleTreatmentColumnsMenu">
                  <span>Colunas</span>
                  <i aria-hidden="true">▾</i>
                </button>
                <div v-if="treatmentColumnsMenuOpen" class="history-columns-menu">
                  <label v-for="column in treatmentColumns" :key="column.id" class="history-columns-option">
                    <input
                      type="checkbox"
                      :checked="treatmentVisibleColumnIds.includes(column.id)"
                      :disabled="treatmentVisibleColumnIds.length === 1 && treatmentVisibleColumnIds.includes(column.id)"
                      @change="toggleTreatmentColumn(column.id)"
                    />
                    <span>{{ column.label }}</span>
                  </label>
                </div>
              </div>
            </div>
            <div class="history-analyses-actions">
              <div ref="treatmentNewWrapRef" class="history-actions-wrap">
                <button type="button" class="history-action-btn" @click="toggleTreatmentNewMenu">
                  <span class="history-action-icon" aria-hidden="true">＋</span>
                  Novo
                </button>
                <div v-if="treatmentNewMenuOpen" class="history-actions-menu">
                  <button type="button" @click="openTreatmentCreateModal">Novo Tratamento</button>
                  <button type="button">Importar Tratamentos</button>
                </div>
              </div>
              <button type="button" class="history-action-btn" @click="downloadTreatmentExports">
                <span class="history-action-icon" aria-hidden="true">⭳</span>
                Exportar
              </button>
            </div>
          </div>

          <div class="mini-table-wrap history-analyses-table-wrap">
            <table class="table compact analysis-table">
              <thead>
                <tr>
                  <th v-for="column in treatmentVisibleColumns" :key="column.id" class="text-center">
                    {{ column.label }}
                  </th>
                  <th class="text-center">Tratamento</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in treatmentFilteredRows" :key="row.id">
                  <td v-for="column in treatmentVisibleColumns" :key="`${row.id}-${column.id}`" class="text-center">
                    {{ row[column.id] }}
                  </td>
                  <td class="text-center">
                    <div class="treatment-action-cell">
                      <span>{{ row.tratamentoNome }}</span>
                      <button type="button" class="history-action-btn small" @click="openTreatmentDetailsModal">
                        Detalhes
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!treatmentFilteredRows.length">
                  <td class="text-center" :colspan="treatmentVisibleColumns.length + 1">
                    Sem dados de tratamento para o filtro informado.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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

      <div v-if="analysisModalOpen" class="modal-overlay" @click="closeAnalysisModal">
        <div class="modal-card analysis-modal-card" @click.stop>
          <h4>Nova Análise</h4>
          <div class="analysis-modal-tabs">
            <button
              type="button"
              class="analysis-modal-tab-btn"
              :class="{ active: analysisModalTab === 'cromatografia' }"
              @click="analysisModalTab = 'cromatografia'"
            >
              Cromatografia
            </button>
            <button
              type="button"
              class="analysis-modal-tab-btn"
              :class="{ active: analysisModalTab === 'fisicoquimico' }"
              @click="analysisModalTab = 'fisicoquimico'"
            >
              Fisio Quimico
            </button>
            <button
              type="button"
              class="analysis-modal-tab-btn"
              :class="{ active: analysisModalTab === 'ensaiosespeciais' }"
              @click="analysisModalTab = 'ensaiosespeciais'"
            >
              Ensaios Especiais
            </button>
          </div>

          <div v-if="analysisModalTab === 'cromatografia'">
            <p class="analysis-form-title">ENTRADA DE CROMATOGRAFIA -TR-OLEO</p>
            <div class="history-switch-wrap history-switch-wrap-top">
              <label class="history-switch">
                <input v-model="analysisSendReport.cromatografia" type="checkbox" />
                <span class="history-switch-track">
                  <i class="history-switch-thumb"></i>
                </span>
                <b>Enviar Relatorio</b>
              </label>
            </div>
            <div class="analysis-form-grid">
              <label v-for="field in analysisCromFields" :key="`crom-${field.key}`">
                <span>{{ field.label }}</span>
                <input
                  v-if="field.key === 'transformador'"
                  v-model="analysisCromForm[field.key]"
                  type="text"
                  list="analysis-transformers-list"
                />
                <template v-if="field.type === 'select'">
                  <select v-model="analysisCromForm[field.key]">
                    <option value="">Selecione</option>
                    <option v-for="option in field.options || []" :key="option" :value="option">{{ option }}</option>
                  </select>
                </template>
                <input
                  v-else-if="field.key !== 'transformador'"
                  v-model="analysisCromForm[field.key]"
                  :type="field.type || 'text'"
                />
                <small v-if="field.hint">{{ field.hint }}</small>
              </label>
            </div>
          </div>

          <div v-else-if="analysisModalTab === 'fisicoquimico'">
            <p class="analysis-form-title">ENTRADA DE FÍSICO QUÍMICO -TR-OLEO</p>
            <div class="history-switch-wrap history-switch-wrap-top">
              <label class="history-switch">
                <input v-model="analysisSendReport.fisicoquimico" type="checkbox" />
                <span class="history-switch-track">
                  <i class="history-switch-thumb"></i>
                </span>
                <b>Enviar Relatorio</b>
              </label>
            </div>
            <div class="analysis-form-grid">
              <label v-for="field in analysisFisicoFields" :key="`fis-${field.key}`">
                <span>{{ field.label }}</span>
                <input
                  v-if="field.key === 'transformador'"
                  v-model="analysisFisicoForm[field.key]"
                  type="text"
                  list="analysis-transformers-list"
                />
                <template v-if="field.type === 'select'">
                  <select v-model="analysisFisicoForm[field.key]">
                    <option value="">Selecione</option>
                    <option v-for="option in field.options || []" :key="option" :value="option">{{ option }}</option>
                  </select>
                </template>
                <input
                  v-else-if="field.key !== 'transformador'"
                  v-model="analysisFisicoForm[field.key]"
                  :type="field.type || 'text'"
                />
                <small v-if="field.hint">{{ field.hint }}</small>
              </label>
            </div>
          </div>

          <div v-else>
            <p class="analysis-form-title">ENTRADA DE ENSAIO ESPECIAL -TR-OLEO</p>
            <div class="history-switch-wrap history-switch-wrap-top">
              <label class="history-switch">
                <input v-model="analysisSendReport.ensaiosespeciais" type="checkbox" />
                <span class="history-switch-track">
                  <i class="history-switch-thumb"></i>
                </span>
                <b>Enviar Relatorio</b>
              </label>
            </div>
            <div class="analysis-form-grid">
              <label v-for="field in analysisEnsaiosFields" :key="`ens-${field.key}`">
                <span>{{ field.label }}</span>
                <input
                  v-if="field.key === 'transformador'"
                  v-model="analysisEnsaiosForm[field.key]"
                  type="text"
                  list="analysis-transformers-list"
                />
                <template v-if="field.type === 'select'">
                  <select v-model="analysisEnsaiosForm[field.key]">
                    <option value="">Selecione</option>
                    <option v-for="option in field.options || []" :key="option" :value="option">{{ option }}</option>
                  </select>
                </template>
                <input
                  v-else-if="field.key !== 'transformador'"
                  v-model="analysisEnsaiosForm[field.key]"
                  :type="field.type || 'text'"
                />
                <small v-if="field.hint">{{ field.hint }}</small>
              </label>
            </div>
          </div>

          <datalist id="analysis-transformers-list">
            <option
              v-for="option in analysisTransformerOptions"
              :key="`analysis-transformer-${option.value}`"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </datalist>

          <div class="modal-actions">
            <button type="button" class="secondary-btn" @click="closeAnalysisModal">Cancelar</button>
            <button type="button" class="primary-btn" @click="saveAnalysisModal">Salvar</button>
          </div>
        </div>
      </div>

      <div v-if="coletasModalOpen" class="modal-overlay" @click="closeColetasModal">
        <div class="modal-card" @click.stop>
          <h4>Nova Coleta</h4>
          <div class="modal-grid">
            <label>
              <span>Transformador</span>
              <input v-model="coletasModalForm.transformador" type="text" list="coletas-transformers-list" />
            </label>
            <label>
              <span>Status Última Coleta</span>
              <input v-model="coletasModalForm.statusUltimaColeta" type="text" />
            </label>
            <label>
              <span>Data Coleta</span>
              <input v-model="coletasModalForm.dataColeta" type="date" />
            </label>
            <label>
              <span>Subestação</span>
              <input v-model="coletasModalForm.subestacao" type="text" />
            </label>
            <label>
              <span>Unidade</span>
              <input v-model="coletasModalForm.unidade" type="text" />
            </label>
            <label>
              <span>Tag</span>
              <input v-model="coletasModalForm.tag" type="text" />
            </label>
            <label>
              <span>Tipo de Análise</span>
              <select v-model="coletasModalForm.tipoAnalise">
                <option value="Cromatografia">Cromatografia</option>
                <option value="Físico Químico">Físico Químico</option>
                <option value="Ensaios Especiais">Ensaios Especiais</option>
              </select>
            </label>
          </div>
          <datalist id="coletas-transformers-list">
            <option
              v-for="option in analysisTransformerOptions"
              :key="`coletas-transformer-${option.value}`"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </datalist>
          <div class="modal-actions">
            <button type="button" class="secondary-btn" @click="closeColetasModal">Cancelar</button>
            <button type="button" class="primary-btn" @click="saveColetasModal">Salvar</button>
          </div>
        </div>
      </div>

      <div v-if="treatmentDetailsModalOpen" class="modal-overlay" @click="closeTreatmentDetailsModal">
        <div class="modal-card analysis-modal-card" @click.stop>
          <h4>Detalhes do Tratamento</h4>
          <p>
            <b>1 - Tratamentos no óleo isolante:</b>
          </p>
          <p>
            Devem ser realizados de acordo com os resultados dos ensaios físico-químicos do óleo isolante, observando os limites mínimos e máximos estabelecidos para cada variável de interesse, conforme orientações da norma NBR 10576/2017.
          </p>
          <p><b>1.1 - Principais variáveis para o monitoramento de ensaios físico-químicos</b></p>
          <div class="mini-table-wrap">
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
                  <td class="text-center">{{ fisicoRows[0]?.DATA_COLETA || '-' }}</td>
                  <td class="text-center">{{ fisicoRows[0]?.TEOR_AGUA ?? '-' }}</td>
                  <td class="text-center">{{ fisicoRows[0]?.RD ?? '-' }}</td>
                  <td class="text-center">{{ fisicoRows[0]?.TENSAO_INTERFACIAL ?? '-' }}</td>
                  <td class="text-center">{{ fisicoRows[0]?.['IND_NEUTRALIZACAO '] ?? '-' }}</td>
                  <td class="text-center">{{ fisicoRows[0]?.FATOR_POT_25 ?? '-' }}</td>
                  <td class="text-center">{{ fisicoRows[0]?.FATOR_POT_90 ?? '-' }}</td>
                  <td class="text-center">{{ fisicoRows[0]?.FATOR_POT_100 ?? '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="modal-actions">
            <button type="button" class="primary-btn" @click="closeTreatmentDetailsModal">Fechar</button>
          </div>
        </div>
      </div>

      <div v-if="treatmentCreateModalOpen" class="modal-overlay" @click="closeTreatmentCreateModal">
        <div class="modal-card" @click.stop>
          <h4>Novo Tratamento</h4>
          <div class="modal-grid">
            <label>
              <span>Status Tratamento</span>
              <select v-model="treatmentForm.statusTratamento">
                <option value="Concluído">Concluído</option>
                <option value="Pendente">Pendente</option>
              </select>
            </label>
            <label>
              <span>Data Coleta</span>
              <input v-model="treatmentForm.dataColeta" type="date" />
            </label>
            <label>
              <span>Tipo de Análise</span>
              <select v-model="treatmentForm.tipoAnalise">
                <option value="Físico Químico">Físico Químico</option>
                <option value="Cromatografia">Cromatografia</option>
                <option value="Ensaios Especiais">Ensaios Especiais</option>
              </select>
            </label>
            <label>
              <span>RD</span>
              <input v-model="treatmentForm.rd" type="text" />
            </label>
            <label>
              <span>Teor de Água</span>
              <input v-model="treatmentForm.teorAgua" type="text" />
            </label>
            <label>
              <span>Tensão Interfacial</span>
              <input v-model="treatmentForm.tensaoInterfacial" type="text" />
            </label>
            <label>
              <span>Ind. Neutralização</span>
              <input v-model="treatmentForm.indNeutralizacao" type="text" />
            </label>
            <label>
              <span>Fator 25</span>
              <input v-model="treatmentForm.fator25" type="text" />
            </label>
            <label>
              <span>Fator 90</span>
              <input v-model="treatmentForm.fator90" type="text" />
            </label>
            <label>
              <span>Fator 100</span>
              <input v-model="treatmentForm.fator100" type="text" />
            </label>
            <label>
              <span>DBPC</span>
              <input v-model="treatmentForm.dbpc" type="text" />
            </label>
          </div>
          <div class="modal-actions">
            <button type="button" class="secondary-btn" @click="closeTreatmentCreateModal">Cancelar</button>
            <button type="button" class="primary-btn" @click="saveTreatmentCreateModal">Salvar</button>
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

.report-toolbar-actions{
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.report-generate-wrap{
  position: relative;
}

.report-generate-menu{
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 40;
  width: min(320px, 88vw);
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: #fff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
  padding: 8px;
  display: grid;
  gap: 2px;
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

.analysis-modal-card{
  width: min(980px, 100%);
  max-height: min(90vh, 920px);
  overflow: auto;
}

.modal-card h4{
  margin: 0 0 12px;
  color: #123a6d;
}

.analysis-modal-tabs{
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 2px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(248, 250, 252, 0.9);
  margin-bottom: 10px;
}

.analysis-modal-tab-btn{
  border: 0;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 8px;
  background: transparent;
  color: rgba(15, 23, 42, 0.72);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.analysis-modal-tab-btn.active{
  background: #1e4e8b;
  color: #fff;
}

.analysis-form-title{
  margin: 4px 0 8px;
  color: #123a6d;
  font-size: 12px;
  font-weight: 700;
}

.analysis-form-grid{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.analysis-form-grid label{
  display: grid;
  gap: 6px;
}

.analysis-form-grid label span{
  font-size: 11px;
  color: rgba(15, 23, 42, 0.7);
  font-weight: 600;
}

.analysis-form-grid input,
.analysis-form-grid select{
  width: 100%;
  border: 1px solid rgba(15, 23, 42, 0.18);
  border-radius: 10px;
  background: #fff;
  padding: 8px 10px;
  font-size: 13px;
  color: #0f172a;
}

.analysis-form-grid label small{
  margin-top: -2px;
  font-size: 10px;
  color: rgba(15, 23, 42, 0.58);
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

.modal-grid input,
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

.expandable-head-btn{
  width: 100%;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.9);
  color: rgba(15, 23, 42, 0.88);
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
}

.expandable-toggle-icon{
  margin-left: auto;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.22);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  line-height: 1;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.85);
  background: rgba(255, 255, 255, 0.82);
}

.expandable-head-btn.open{
  border-color: rgba(30, 78, 139, 0.28);
}

.limit-table-class-head{
  border-bottom: 1px solid rgba(15, 23, 42, 0.35);
  padding-bottom: 4px;
  margin-bottom: 4px;
  text-align: center;
  font-weight: 600;
}

.limit-table-class-grid{
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 2px;
  text-align: center;
}

.limit-reference-table .limit-reference-head-row td{
  background: #64748b !important;
  color: #ffffff !important;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
  font-weight: 700;
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

.coletas-line-head{
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  align-items: center;
  column-gap: 10px;
}

.coletas-tabs-center{
  justify-self: center;
}

.coletas-line-head .history-analyses-controls-left{
  width: max-content;
  display: inline-flex;
  justify-self: start;
  margin-right: 0;
}

.coletas-line-head .history-analyses-actions{
  justify-self: end;
}

.coletas-line-head-two{
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
  column-gap: 10px;
}

.coletas-controls-left{
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
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

.history-tab-select-wrap{
  display: none;
  width: 100%;
}

.history-tab-select{
  width: 100%;
  height: 40px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.92);
  color: rgba(15, 23, 42, 0.78);
  font-size: 12px;
  font-weight: 600;
  padding: 0 38px 0 14px;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.06);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%2364748b' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
}

.history-tab-select:focus{
  border-color: #1e4e8b;
  box-shadow: 0 0 0 3px rgba(30, 78, 139, 0.14);
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

.history-mobile-range{
  display: none;
  margin: 6px 0 0;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.72);
}

.history-analyses-card{
  overflow: visible;
}

.history-analyses-title{
  margin: 0 0 10px;
  padding: 6px 10px;
  border-radius: 8px;
  background: #1e4e8b;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}

.history-analyses-head{
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.history-analyses-controls{
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  gap: 6px;
  flex-wrap: wrap;
}

.history-analyses-controls-left{
  margin-right: auto;
}

.history-analyses-actions{
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.history-actions-wrap{
  position: relative;
}

.history-action-btn{
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

.history-action-btn.small{
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
}

.history-action-icon{
  font-size: 12px;
}

.history-actions-menu{
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
  z-index: 31;
  min-width: 180px;
}

.history-actions-menu button{
  border: none;
  background: rgba(15, 23, 42, 0.04);
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}

.history-export-option{
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.82);
  cursor: pointer;
}

.history-export-option input{
  width: 14px;
  height: 14px;
  accent-color: #1e4e8b;
  cursor: pointer;
}

.history-export-download-btn{
  margin-top: 4px;
  height: 34px;
  border: 1px solid #1e4e8b !important;
  border-radius: 999px !important;
  background: #1e4e8b !important;
  color: #fff !important;
  text-align: center !important;
  font-weight: 700;
  box-shadow: 0 8px 18px rgba(30, 78, 139, 0.22);
}

.history-export-download-btn:disabled{
  opacity: 0.55;
  cursor: not-allowed;
}

.history-analysis-search{
  display: block;
  width: auto;
  min-width: 0;
  flex: 0 0 auto;
}

.history-analysis-search input{
  width: auto;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  padding: 0 10px;
  font-size: 12px;
  background: #fff;
  color: #0f172a;
}

.history-analysis-search input:focus{
  outline: none;
  border-color: #1e4e8b;
  box-shadow: 0 0 0 3px rgba(30, 78, 139, 0.14);
}

.history-columns-picker{
  position: relative;
}

.history-columns-trigger{
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  background: #fff;
  color: rgba(15, 23, 42, 0.8);
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.history-columns-trigger i{
  font-style: normal;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.65);
}

.history-columns-menu{
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 30;
  width: min(340px, 90vw);
  max-height: 360px;
  overflow: auto;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: #fff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
  padding: 8px;
}

.history-columns-group + .history-columns-group{
  margin-top: 8px;
}

.history-columns-group p{
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  color: #1e4e8b;
}

.history-columns-option{
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.82);
  padding: 4px 2px;
  cursor: pointer;
}

.history-columns-option input{
  width: 14px;
  height: 14px;
  accent-color: #1e4e8b;
  cursor: pointer;
}

.history-columns-option input:disabled{
  cursor: not-allowed;
}

.history-analyses-table-wrap{
  margin-top: 4px;
}

.history-analyses-pagination{
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.history-rows-per-page{
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.history-rows-per-page span{
  font-size: 11px;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.72);
}

.history-rows-per-page select{
  height: 30px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  background: #fff;
  color: rgba(15, 23, 42, 0.8);
  font-size: 12px;
  padding: 0 8px;
}

.history-page-range,
.history-page-current{
  font-size: 12px;
  color: rgba(15, 23, 42, 0.75);
}

.history-page-btn{
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

.history-page-btn:disabled{
  opacity: 0.5;
  cursor: not-allowed;
}

.treatment-action-cell{
  display: inline-flex;
  align-items: center;
  gap: 8px;
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
  .report-toolbar-actions{
    width: 100%;
    display: grid;
    gap: 8px;
  }
  .report-generate-menu{
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
  .history-tabs-main{
    display: none !important;
  }
  .history-tab-select-wrap{
    display: block;
    width: min(100%, 320px);
    margin: 0 auto;
  }
  .history-mobile-range{
    display: block;
  }
  .history-analyses-controls{
    width: 100%;
    justify-content: stretch;
    align-items: stretch;
  }
  .coletas-line-head{
    grid-template-columns: 1fr;
    row-gap: 8px;
  }
  .coletas-line-head-two{
    grid-template-columns: 1fr;
    row-gap: 8px;
  }
  .coletas-tabs-center{
    justify-self: center;
  }
  .coletas-line-head .history-analyses-controls-left,
  .coletas-line-head .history-analyses-actions{
    justify-self: stretch;
  }
  .coletas-controls-left{
    width: 100%;
  }
  .coletas-line-head-two .history-analyses-controls-left,
  .coletas-line-head-two .history-analyses-actions{
    justify-self: stretch;
  }
  .history-analyses-actions{
    width: 100%;
    justify-content: flex-end;
  }
  .history-analysis-search{
    width: 100%;
    min-width: 0;
  }
  .treatment-action-cell{
    justify-content: flex-end;
    width: 100%;
  }
  .history-columns-picker{
    width: 100%;
  }
  .history-columns-trigger{
    width: 100%;
    justify-content: space-between;
  }
  .history-columns-menu{
    width: 100%;
    max-height: 300px;
  }
  .history-analyses-pagination{
    justify-content: flex-start;
  }
  .analysis-form-grid{
    grid-template-columns: 1fr;
  }
  .modal-grid{
    grid-template-columns: 1fr;
  }
}
</style>
