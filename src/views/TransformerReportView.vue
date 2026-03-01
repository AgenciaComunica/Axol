<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SideMenu from '@/components/SideMenu.vue'
import AppHeader from '@/components/AppHeader.vue'
import transformersData from '@/assets/transformadores.json'
import oltcData from '@/assets/oltc.json'
import cromatografiasRaw from '@/assets/cromatografias.json?raw'
import fisicoQuimicosRaw from '@/assets/fisicoquimicos.json?raw'
import fisicoQuimicosOltcRaw from '@/assets/fisicoquimicos_oltc.json?raw'
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
type AnalysisModalTab = 'cromatografia' | 'fisicoquimico' | 'ensaiosespeciais' | 'oltc' | 'fisicoquimicooltc'
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
type TransformerPickerGroup = {
  substation: string
  items: Transformer[]
  filteredItems: Transformer[]
  groupMatch: boolean
}
type TransformerPickerEntry =
  | { kind: 'group'; key: string; index: number; group: TransformerPickerGroup }
  | { kind: 'item'; key: string; index: number; group: TransformerPickerGroup; item: Transformer }
type AdvancedFilterContext = 'analises' | 'coletas' | 'tratamento'
type AdvancedOperator = '=' | '!=' | '>' | '<' | '>=' | '<='
type AdvancedConnector = 'AND' | 'OR'
type AdvancedFilterRule = {
  id: number
  field: string
  operator: AdvancedOperator
  value: string
  connector: AdvancedConnector
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

function getAnalysisDataSerialAliases(): Record<string, string[]> {
  return {
    '9701-A01': ['3792', 'OLTC-0001'],
  }
}

const macroTabs = ['TR Óleo', 'TR Rota', 'OLTC'] as const
type MacroTab = (typeof macroTabs)[number]

const tabs = [
  'Avaliação Completa',
  'Histórico de Análises',
  'Avaliação IEEE',
  'Coletas',
  'Tratamento de Óleo',
  'Duval',
] as const

type ReportTab = (typeof tabs)[number]

function toValidTab(value: unknown): ReportTab {
  const text = String(value || '')
  if (text === 'Próximas Coletas') return 'Coletas'
  return (tabs.find((tab) => tab === text) as ReportTab) || 'Avaliação Completa'
}

function toValidMacro(value: unknown): MacroTab {
  const text = String(value || '')
  return (macroTabs.find((tab) => tab === text) as MacroTab) || 'TR Óleo'
}

const activeMacroTab = ref<MacroTab>(toValidMacro(route.query.macro))
const activeTab = ref<ReportTab>(toValidTab(route.query.section))
const isGlobalAnalisesView = computed(() => route.name === 'analises-view')
const isGlobalTreatmentView = computed(() => route.name === 'tratamento-oleo-view')
const isGlobalColetasView = computed(() => route.name === 'coletas-view')
const isGlobalScopeView = computed(() =>
  isGlobalAnalisesView.value || isGlobalTreatmentView.value || isGlobalColetasView.value
)
const pageEyebrow = computed(() => {
  if (isGlobalAnalisesView.value) return 'Análises dos Transformadores'
  if (isGlobalTreatmentView.value) return 'Tratamento de Óleo dos Transformadores'
  if (isGlobalColetasView.value) return 'Coletas dos Transformadores'
  return 'Relatórios de Transformadores'
})
const pageTitle = computed(() => {
  if (isGlobalAnalisesView.value) return 'Análise Geral'
  if (isGlobalTreatmentView.value) return 'Tratamento Geral'
  if (isGlobalColetasView.value) return 'Coletas Gerais'
  return 'Relatório Consolidado'
})
const pageSubtitle = computed(() => {
  if (isGlobalAnalisesView.value) return 'Visualização consolidada de análises para todos os transformadores.'
  if (isGlobalTreatmentView.value) return 'Visualização consolidada de tratamento de óleo para todos os transformadores.'
  if (isGlobalColetasView.value) return 'Visualização consolidada de coletas para todos os transformadores.'
  return 'Visualização única com dados do transformador e módulos técnicos.'
})
const forcedGlobalTab = computed<ReportTab | null>(() => {
  if (isGlobalAnalisesView.value) return 'Histórico de Análises'
  if (isGlobalTreatmentView.value) return 'Tratamento de Óleo'
  if (isGlobalColetasView.value) return 'Coletas'
  return null
})
const isOltcMacro = computed(() => activeMacroTab.value === 'OLTC')
const isTrRotaMacro = computed(() => activeMacroTab.value === 'TR Rota')

const trOleoSubTabs: ReportTab[] = [
  'Avaliação Completa',
  'Histórico de Análises',
  'Avaliação IEEE',
  'Coletas',
  'Tratamento de Óleo',
  'Duval',
]
const trRotaSubTabs: ReportTab[] = ['Avaliação Completa', 'Histórico de Análises']
const oltcSubTabs: ReportTab[] = [
  'Avaliação Completa',
  'Histórico de Análises',
  'Avaliação IEEE',
  'Coletas',
  'Tratamento de Óleo',
  'Duval',
]

const activeSubTabs = computed(() => {
  if (isGlobalScopeView.value) return tabs.map((tab) => ({ value: tab, label: tab }))
  const base =
    activeMacroTab.value === 'TR Óleo'
      ? trOleoSubTabs
      : activeMacroTab.value === 'TR Rota'
        ? trRotaSubTabs
        : oltcSubTabs
  return base.map((tab) => ({
    value: tab,
    label: isTrRotaMacro.value && tab === 'Histórico de Análises' ? 'Análise de Campo' : tab,
  }))
})
const generateReportMenuOpen = ref(false)
const generateReportWrapRef = ref<HTMLElement | null>(null)
const generateReportItems = [
  'Avaliação Completa',
  'Histórico de Análises',
  'Avaliação IEEE',
  'Coletas',
  'Tratamento de Óleo',
  'Duval',
  'TR Óleo',
]
const generateReportSelected = ref<string[]>([...generateReportItems])

const transformerOptions = computed<Transformer[]>(() => {
  const baseTransformers: Transformer[] = [
    {
      id: 'MG-9701-A01',
      serial: 'MG-A01',
      tag: '9701',
      substation: 'SE VISCONDE DO RIO BRANCO',
      reference: '-',
      unit: '-',
      status: 'Normal',
      statusAnalyst: 'Alerta',
      oilStatus: 'Normal',
      treatment: 'Normal',
      power: '43 MVA',
      voltage: '69 kV',
      equipment: '-',
      commutator: 'SIM',
      oilFluid: 'NAO IDENTIFICADO',
      year: '1993',
      manufacturer: 'TRAFO',
      volume: '-',
      refrigeration: '-',
      load: '-',
      operating: '-',
      sealed: '-',
      analyst: 'alex.fabiano@axol.eng.br',
      analystNote: 'qwerqwerqwerwqeqwe',
      failureMode: '-',
      latitude: '-19.912998',
      longitude: '-43.940933',
    },
    {
      id: 'MG-9701-A02',
      serial: 'MG-A02',
      tag: '9701',
      substation: 'SE SERENO',
      reference: '-',
      unit: '-',
      status: 'Alerta',
      statusAnalyst: 'Normal',
      oilStatus: 'Alerta',
      treatment: 'Alerta',
      power: '2 MVA',
      voltage: '22 kV',
      equipment: '-',
      commutator: 'CST',
      oilFluid: 'MINERAL',
      year: '2013',
      manufacturer: 'WEG',
      volume: '-',
      refrigeration: '-',
      load: '-',
      operating: '-',
      sealed: '-',
      analyst: 'alexsandro.oliveira@axol.eng.br',
      analystNote: 'sdkfasdjfaslkdjfaslkdjfaslkdjfslkdfjlskdf',
      failureMode: '-',
      latitude: '-21.316419',
      longitude: '-42.650596',
    },
    {
      id: 'MG-A03',
      serial: 'MG-A03',
      tag: '',
      substation: 'SE CANARANA 138 KV',
      reference: '-',
      unit: '-',
      status: 'Ainda nao Analisado',
      statusAnalyst: 'Ainda nao Analisado',
      oilStatus: 'Ainda nao Analisado',
      treatment: 'Ainda nao Analisado',
      power: '30 MVA',
      voltage: '138 kV',
      equipment: '-',
      commutator: 'SIM',
      oilFluid: 'MINERAL',
      year: '2015',
      manufacturer: 'NAO IDENTIFICADO',
      volume: '-',
      refrigeration: '-',
      load: '-',
      operating: '-',
      sealed: '-',
      analyst: '-',
      analystNote: '-',
      failureMode: '-',
      latitude: '-20.27848',
      longitude: '-40.30561',
    },
    {
      id: 'MG-2FTMTR01-A04',
      serial: 'MG-A04',
      tag: '2FTMTR01',
      substation: 'SE FATIMA',
      reference: '-',
      unit: '-',
      status: 'Alerta',
      statusAnalyst: 'Normal',
      oilStatus: 'Alerta',
      treatment: 'Alerta',
      power: '1.25 MVA',
      voltage: '36 kV',
      equipment: '-',
      commutator: 'SIM',
      oilFluid: 'MINERAL',
      year: '1997',
      manufacturer: 'WEG',
      volume: '-',
      refrigeration: '-',
      load: '-',
      operating: '-',
      sealed: '-',
      analyst: 'alex.fabiano@axol.eng.br',
      analystNote: 'Teste agora',
      failureMode: '-',
      latitude: '-20.663567',
      longitude: '-43.783096',
    },
    {
      id: 'MG-2CTMTR01-A05',
      serial: 'MG-A05',
      tag: '2CTMTR01',
      substation: 'SE COUTO MAGALHAES',
      reference: '-',
      unit: '-',
      status: 'Alerta',
      statusAnalyst: 'Normal',
      oilStatus: 'Alerta',
      treatment: 'Alerta',
      power: '1 MVA',
      voltage: '34.5 kV',
      equipment: '-',
      commutator: 'SIM',
      oilFluid: 'MINERAL',
      year: '1994',
      manufacturer: 'GE',
      volume: '-',
      refrigeration: '-',
      load: '-',
      operating: '-',
      sealed: '-',
      analyst: 'alex.fabiano@axol.eng.br',
      analystNote: 'Descricao do analista',
      failureMode: '-',
      latitude: '-19.8945',
      longitude: '-44.1377',
    },
  ]

  const jsonTransformers = rawSubstations.flatMap((substation: any) => {
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

  const merged = [...baseTransformers, ...jsonTransformers]
  const byId = new Map<string, Transformer>()
  merged.forEach((item) => {
    if (!item.id) return
    if (!byId.has(item.id)) byId.set(item.id, item)
  })
  return Array.from(byId.values())
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
    if (isGlobalScopeView.value) return
    activeTab.value = toValidTab(value)
  }
)

watch(
  () => route.query.macro,
  (value) => {
    if (isGlobalScopeView.value) return
    activeMacroTab.value = toValidMacro(value)
  }
)

watch(selectedId, (value) => {
  if (route.name !== 'transformer-report') return
  if (!value || String(route.params.id || '') === value) return
  router.replace({
    name: 'transformer-report',
    params: { id: value },
    query: { ...route.query, macro: activeMacroTab.value, section: activeTab.value },
  })
})

watch(selectedId, () => {
  ensureSelectedGroupExpanded()
})

watch(activeTab, (value) => {
  if (route.name !== 'transformer-report') return
  if (String(route.query.section || '') === value && String(route.query.macro || '') === activeMacroTab.value) return
  router.replace({
    name: 'transformer-report',
    params: { id: selectedId.value || String(route.params.id || '') },
    query: { ...route.query, macro: activeMacroTab.value, section: value },
  })
})

watch(activeMacroTab, (value) => {
  if (route.name !== 'transformer-report') return
  const allowed = activeSubTabs.value.map((tab) => tab.value)
  if (!allowed.includes(activeTab.value)) {
    activeTab.value = allowed[0] || 'Avaliação Completa'
  }
  router.replace({
    name: 'transformer-report',
    params: { id: selectedId.value || String(route.params.id || '') },
    query: { ...route.query, macro: value, section: activeTab.value },
  })
}, { immediate: true })

watch(
  forcedGlobalTab,
  (value) => {
    if (!value) return
    if (activeTab.value !== value) activeTab.value = value
  },
  { immediate: true }
)

watch(
  activeSubTabs,
  (items) => {
    const allowed = items.map((tab) => tab.value)
    if (!allowed.length) return
    if (!allowed.includes(activeTab.value)) {
      activeTab.value = allowed[0]!
    }
  },
  { immediate: true }
)

const selectedTransformer = computed(
  () => transformerOptions.value.find((item) => item.id === selectedId.value) || null
)
const transformerPickerWrapRef = ref<HTMLElement | null>(null)
const transformerPickerMenuRef = ref<HTMLElement | null>(null)
const transformerPickerTriggerRef = ref<HTMLButtonElement | null>(null)
const transformerPickerSearchRef = ref<HTMLInputElement | null>(null)
const transformerPickerOpen = ref(false)
const transformerPickerSearch = ref('')
const transformerPickerFocusedIndex = ref(-1)
const transformerPickerExpanded = ref<Record<string, boolean>>({})
const selectedTransformerLabel = computed(() =>
  selectedTransformer.value ? `${selectedTransformer.value.id} • ${selectedTransformer.value.substation}` : 'Selecionar'
)
const transformerPickerGroups = computed<TransformerPickerGroup[]>(() => {
  const groups = new Map<string, Transformer[]>()
  transformerOptions.value.forEach((item) => {
    const key = String(item.substation || 'Sem Subestação')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  })

  const query = transformerPickerSearch.value.trim().toLowerCase()
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([substation, items]) => {
      const sortedItems = [...items].sort((a, b) => a.id.localeCompare(b.id, 'pt-BR'))
      const groupMatch = !!query && substation.toLowerCase().includes(query)
      const filteredItems = !query
        ? sortedItems
        : sortedItems.filter((item) => {
            const haystack = [item.id, item.serial, item.tag, item.substation, item.reference]
              .join(' ')
              .toLowerCase()
            return haystack.includes(query)
          })
      return { substation, items: sortedItems, filteredItems, groupMatch }
    })
    .filter((group) => !query || group.groupMatch || group.filteredItems.length > 0)
})

function isTransformerGroupExpanded(group: TransformerPickerGroup) {
  if (transformerPickerSearch.value.trim()) return true
  return !!transformerPickerExpanded.value[group.substation]
}

function visibleTransformerItems(group: TransformerPickerGroup) {
  if (!transformerPickerSearch.value.trim()) return group.items
  if (group.groupMatch) return group.items
  return group.filteredItems
}

const transformerPickerEntries = computed<TransformerPickerEntry[]>(() => {
  const entries: TransformerPickerEntry[] = []
  let index = 0
  transformerPickerGroups.value.forEach((group) => {
    entries.push({ kind: 'group', key: `group-${group.substation}`, index, group })
    index += 1
    if (isTransformerGroupExpanded(group)) {
      visibleTransformerItems(group).forEach((item) => {
        entries.push({ kind: 'item', key: `item-${item.id}`, index, group, item })
        index += 1
      })
    }
  })
  return entries
})

function ensureSelectedGroupExpanded() {
  const selected = selectedTransformer.value
  if (!selected) return
  transformerPickerExpanded.value = {
    ...transformerPickerExpanded.value,
    [selected.substation]: true,
  }
}

function openTransformerPicker() {
  ensureSelectedGroupExpanded()
  transformerPickerOpen.value = true
  nextTick(() => {
    transformerPickerSearchRef.value?.focus()
  })
}

function closeTransformerPicker() {
  transformerPickerOpen.value = false
  transformerPickerSearch.value = ''
  transformerPickerFocusedIndex.value = -1
}

function toggleTransformerPicker() {
  if (transformerPickerOpen.value) {
    closeTransformerPicker()
    return
  }
  openTransformerPicker()
}

function toggleTransformerGroup(substation: string) {
  if (transformerPickerSearch.value.trim()) return
  transformerPickerExpanded.value = {
    ...transformerPickerExpanded.value,
    [substation]: !transformerPickerExpanded.value[substation],
  }
}

function selectTransformerFromPicker(item: Transformer) {
  selectedId.value = item.id
  closeTransformerPicker()
  nextTick(() => transformerPickerTriggerRef.value?.focus())
}

function focusTransformerPickerEntry(index: number) {
  const el = transformerPickerMenuRef.value?.querySelector<HTMLElement>(`[data-trafo-index="${index}"]`)
  el?.focus()
}

function moveTransformerPickerFocus(step: number) {
  const entries = transformerPickerEntries.value
  if (!entries.length) return
  const total = entries.length
  const current = transformerPickerFocusedIndex.value
  const next = current < 0 ? (step > 0 ? 0 : total - 1) : (current + step + total) % total
  transformerPickerFocusedIndex.value = next
  nextTick(() => focusTransformerPickerEntry(next))
}

function handleTransformerPickerKeydown(event: KeyboardEvent) {
  if (!transformerPickerOpen.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeTransformerPicker()
    nextTick(() => transformerPickerTriggerRef.value?.focus())
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveTransformerPickerFocus(1)
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveTransformerPickerFocus(-1)
    return
  }
  if (event.key === 'Home') {
    event.preventDefault()
    transformerPickerFocusedIndex.value = 0
    nextTick(() => focusTransformerPickerEntry(0))
    return
  }
  if (event.key === 'End') {
    event.preventDefault()
    const last = transformerPickerEntries.value.length - 1
    transformerPickerFocusedIndex.value = last
    nextTick(() => focusTransformerPickerEntry(last))
  }
}
const reportViewerModalOpen = ref(false)

function buildReportViewerSrc(showWatermark: boolean) {
  if (!selectedTransformer.value) return ''
  const params = new URLSearchParams()
  params.set('trafoId', selectedTransformer.value.id)
  const lat = Number(String(selectedTransformer.value.latitude || '').replace(',', '.'))
  const lng = Number(String(selectedTransformer.value.longitude || '').replace(',', '.'))
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    params.set('lat', String(lat))
    params.set('lng', String(lng))
  }
  params.set('munCode', '3106200')
  params.set('embed', '1')
  params.set('watermark', showWatermark ? '1' : '0')
  return `${import.meta.env.BASE_URL}viewer-3d?${params.toString()}`
}

const reportViewerCardSrc = computed(() => buildReportViewerSrc(false))
const reportViewerModalSrc = computed(() => buildReportViewerSrc(true))

const reportViewerSrc = computed(() => {
  return reportViewerModalOpen.value ? reportViewerModalSrc.value : reportViewerCardSrc.value
})

function openReportViewerModal() {
  if (!reportViewerSrc.value) return
  reportViewerModalOpen.value = true
}

function closeReportViewerModal() {
  reportViewerModalOpen.value = false
}

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
  oltc: false,
  fisicoquimicooltc: false,
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
const analysisOltcForm = ref<Record<string, string>>({
  transformador: '',
  dataColeta: '',
  noSerieComutador: '',
  statusOltc: '',
  modelo: '',
  fabricante: '',
  filtro: '',
  anoFabricacao: '',
  rdLimite: '',
  teorAguaLimite: '',
  laboratorio: '',
})
const analysisFisicoOltcForm = ref<Record<string, string>>({
  transformador: '',
  dataColeta: '',
  noSerieComutador: '',
  tempAmostra: '',
  tempOleo: '',
  teorAgua: '',
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
const analysisOltcFields: AnalysisFieldDef[] = [
  { key: 'transformador', label: 'Transformador', hint: '* Digite o serial do Transformador' },
  { key: 'dataColeta', label: 'Data Coleta', hint: '* Selecione a data da Coleta', type: 'date' },
  { key: 'noSerieComutador', label: 'No. Série Comutador', hint: 'Máximo de 45 dígitos' },
  { key: 'statusOltc', label: 'Status OLTC', hint: 'Máximo de 45 dígitos' },
  { key: 'modelo', label: 'Modelo', hint: 'Máximo de 45 dígitos' },
  { key: 'fabricante', label: 'Fabricante', hint: 'Máximo de 45 dígitos' },
  { key: 'filtro', label: 'Filtro', hint: 'Máximo de 45 dígitos' },
  { key: 'anoFabricacao', label: 'Ano de Fabricação', hint: 'Máximo de 4 dígitos', type: 'number' },
  { key: 'rdLimite', label: 'RD (Mín. 40 kV)', hint: 'Mínimo de 1 e máximo de 11 dígitos', type: 'number' },
  { key: 'teorAguaLimite', label: 'Teor de Água (Máx. 30 ppm)', hint: 'Mínimo de 1 e máximo de 11 dígitos', type: 'number' },
  { key: 'laboratorio', label: 'Laboratório', hint: 'Máximo de 45 dígitos' },
]
const analysisFisicoOltcFields: AnalysisFieldDef[] = [
  { key: 'transformador', label: 'Transformador', hint: '* Digite o serial do Transformador' },
  { key: 'dataColeta', label: 'Data Coleta', hint: '* Selecione a data da Coleta', type: 'date' },
  { key: 'noSerieComutador', label: 'No. Série Comutador', hint: 'Máximo de 45 dígitos' },
  { key: 'tempAmostra', label: 'Temp. Amostra (°C)', hint: 'Máximo de 11 dígitos', type: 'number' },
  { key: 'tempOleo', label: 'Temp. Óleo (°C)', hint: 'Máximo de 11 dígitos', type: 'number' },
  { key: 'teorAgua', label: 'Teor de Água (ppm)', hint: '* Mínimo de 1 e máximo de 11 dígitos', type: 'number' },
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
    oltc: false,
    fisicoquimicooltc: false,
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
  analysisOltcForm.value = {
    transformador: serial,
    dataColeta: '',
    noSerieComutador: '',
    statusOltc: '',
    modelo: '',
    fabricante: '',
    filtro: '',
    anoFabricacao: '',
    rdLimite: '',
    teorAguaLimite: '',
    laboratorio: '',
  }
  analysisFisicoOltcForm.value = {
    transformador: serial,
    dataColeta: '',
    noSerieComutador: '',
    tempAmostra: '',
    tempOleo: '',
    teorAgua: '',
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
  analysisModalTab.value = analysisRecentTab.value === 'oltc' ? 'oltc' : 'cromatografia'
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

watch(
  analysisOltcForm,
  (form) => {
    if (hasAnalysisData(form)) analysisSendReport.value.oltc = true
  },
  { deep: true }
)

watch(
  analysisFisicoOltcForm,
  (form) => {
    if (hasAnalysisData(form)) analysisSendReport.value.fisicoquimicooltc = true
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
type DuvalViewTab = 'triangulos' | 'pentagonos'
type AnalysisColumnGroup = 'Geral' | 'Cromatografia' | 'Físico Químico' | 'Ensaios Especiais'
type AnalysisRecentTab = 'padrao' | 'oltc'
type OltcAnalysisColumnGroup = 'Geral' | 'OLTC' | 'Físico Químico'
type AnalysisColumn = {
  id: string
  label: string
  group: AnalysisColumnGroup
  defaultVisible: boolean
}
type OltcAnalysisColumn = {
  id: string
  label: string
  group: OltcAnalysisColumnGroup
  defaultVisible: boolean
}
type UnifiedAnalysisRow = Record<string, string | number> & { id: string; sortTime: number }

const historyActiveTab = ref<HistoryChartTab>('cromatografia')
const historyCromDisplayMode = ref<HistoryDisplayMode>('base')
const historyFisicoDisplayMode = ref<HistoryDisplayMode>('base')
const duvalViewTab = ref<DuvalViewTab>('triangulos')
const duvalManualSelectedAnalyses = ref<string[]>([])

type DuvalRefItem = [string, string]
const duvalReferences: Record<'D1' | 'D4' | 'D5' | 'P1' | 'P2', DuvalRefItem[]> = {
  D1: [
    ['rgb(63, 164, 91)', 'PD - Descargas parciais (corona)'],
    ['rgb(164, 101, 10)', 'T1 - Faltas térmicas abaixo de 300°'],
    ['rgb(249, 148, 148)', 'T2 - Faltas térmicas entre 300°C e 700°C'],
    ['rgb(185, 12, 13)', 'T3 - Faltas térmicas acima de 700°C'],
    ['rgb(113, 201, 137)', 'D1 - Descarga de baixa energia (centelhamento)'],
    ['rgb(245, 176, 77)', 'D2 - Descarga de alta energia (arco elétrico)'],
    ['rgb(246, 99, 100)', 'DT - Ocorrência simultânea de falta térmica e arco elétrico'],
  ],
  D4: [
    ['rgb(63, 164, 91)', 'PD - Descargas parciais do tipo corona'],
    ['rgb(248, 204, 140)', 'S - Gases dispersos em temperaturas < 200 °C'],
    ['rgb(147, 10, 10)', 'C - Possível carbonização do papel'],
    ['rgb(198, 122, 12)', 'O - Superaquecimento < 250 °C sem carbonização do papel'],
  ],
  D5: [
    ['rgb(63, 164, 91)', 'PD - Descargas parciais do tipo corona'],
    ['rgb(248, 204, 140)', 'S - Gases dispersos em temperaturas < 200 °C'],
    ['rgb(147, 10, 10)', 'C - Possível carbonização do papel'],
    ['rgb(198, 122, 12)', 'O - Superaquecimento < 250 °C sem carbonização do papel'],
    ['rgb(246, 99, 100)', 'T2 - Falha térmica, 300 ºC < t < 700 ºC'],
    ['rgb(185, 12, 13)', 'T3 - Falha térmica, t > 700 ºC'],
  ],
  P1: [
    ['rgb(248, 204, 140)', 'S - Gases dispersos em temperaturas < 200 °C'],
    ['rgb(164, 101, 10)', 'T1 - Falha térmica, t < 300 ºC'],
    ['rgb(249, 148, 148)', 'T2 - Falha térmica, 300 ºC < t < 700 ºC'],
    ['rgb(185, 12, 13)', 'T3 - Falha térmica, t > 700 ºC'],
    ['rgb(113, 201, 137)', 'D1 - Descargas de baixa energia ou descargas parciais do tipo faísca'],
    ['rgb(245, 176, 77)', 'D2 - Descargas de alta energia'],
    ['rgb(63, 164, 91)', 'PD - Descargas parciais do tipo corona'],
  ],
  P2: [
    ['rgb(248, 204, 140)', 'S - Gases dispersos em temperaturas < 200 °C'],
    ['rgb(198, 122, 12)', 'O - Superaquecimento < 250 °C sem carbonização do papel'],
    ['rgb(147, 10, 10)', 'C - Possível carbonização do papel'],
    ['rgb(222, 137, 13)', 'T3-H - Falha térmica T3 somente em óleo mineral'],
    ['rgb(113, 201, 137)', 'D1 - Descargas de baixa energia ou descargas parciais do tipo faísca'],
    ['rgb(245, 176, 77)', 'D2 - Descargas de alta energia'],
    ['rgb(63, 164, 91)', 'PD - Descargas parciais do tipo corona'],
  ],
}

const duvalAreaByIndex = {
  d1: ['T3', 'T3', 'T3', 'T3', 'T3'],
  d4: ['S', 'S', 'ND', 'ND', 'S'],
  d5: ['T3', 'T3', 'C', 'T3', 'C'],
  p1: ['T2', 'T3', 'D2', 'T3', 'D2'],
  p2: ['C', 'T3-H', 'D2', 'T3-H', 'D2'],
}

type DuvalAnalysisRow = {
  id: string
  date: string
  C2H2: string
  C2H4: string
  CH4: string
  C2H6: string
  H2: string
  AREA_D1: string
  AREA_D4: string
  AREA_D5: string
  AREA_P1: string
  AREA_P2: string
}

const duvalAnalysesRows = computed<DuvalAnalysisRow[]>(() => {
  const data = parseLooseJson<BaseRow[]>(cromatografiasRaw)
  return [...data]
    .filter(rowMatchesSelectedTransformer)
    .sort((a, b) => parseBrDate(b.DATA_COLETA) - parseBrDate(a.DATA_COLETA))
    .slice(0, 5)
    .map((row, index) => ({
      id: `${normalizeCell(row.DATA_COLETA)}-${index}`,
      date: normalizeCell(row.DATA_COLETA),
      C2H2: normalizeCell(row.ACETILENO),
      C2H4: normalizeCell(row.ETILENO),
      CH4: normalizeCell(row.METANO),
      C2H6: normalizeCell(row.ETANO),
      H2: normalizeCell(row.HIDROGENIO),
      AREA_D1: duvalAreaByIndex.d1[index] || '-',
      AREA_D4: duvalAreaByIndex.d4[index] || '-',
      AREA_D5: duvalAreaByIndex.d5[index] || '-',
      AREA_P1: duvalAreaByIndex.p1[index] || '-',
      AREA_P2: duvalAreaByIndex.p2[index] || '-',
    }))
})

watch(
  duvalAnalysesRows,
  (rows) => {
    const validIds = new Set(rows.map((row) => row.id))
    duvalManualSelectedAnalyses.value = duvalManualSelectedAnalyses.value.filter((id) => validIds.has(id))
    if (!duvalManualSelectedAnalyses.value.length && rows.length) {
      duvalManualSelectedAnalyses.value = [rows[0].id]
    }
  },
  { immediate: true }
)

const duvalFullSelectedAnalyses = computed(() => {
  const rows = duvalAnalysesRows.value
  if (!duvalManualSelectedAnalyses.value.length) return []
  const analysisMap = new Map(rows.map((row, index) => [row.id, index]))
  const manualIndices = duvalManualSelectedAnalyses.value
    .map((id) => analysisMap.get(id))
    .filter((index): index is number => Number.isInteger(index))
  if (!manualIndices.length) return []
  const minIndex = Math.min(...manualIndices)
  const maxIndex = Math.max(...manualIndices)
  return rows.slice(minIndex, maxIndex + 1).map((row) => row.id)
})

function buildDuvalLayers(baseImage: string, pointPrefix: string, arrowPrefix: string) {
  const rows = duvalAnalysesRows.value
  const layers = [baseImage]
  if (!rows.length || !duvalFullSelectedAnalyses.value.length) return layers

  const indexMap = new Map(rows.map((row, index) => [row.id, index]))
  const selectedIndices = duvalFullSelectedAnalyses.value
    .map((id) => indexMap.get(id))
    .filter((index): index is number => Number.isInteger(index))

  if (!selectedIndices.length) return layers

  const minIndex = Math.min(...selectedIndices)
  const maxIndex = Math.max(...selectedIndices)

  for (let i = minIndex; i <= maxIndex; i += 1) {
    if (i > minIndex) {
      layers.push(`/duval-assets/A01/${arrowPrefix}${i}.svg`)
    }
  }

  for (let i = minIndex; i <= maxIndex; i += 1) {
    layers.push(`/duval-assets/A01/${pointPrefix}${i + 1}.svg`)
  }

  return layers
}

const duvalLayersD1 = computed(() => buildDuvalLayers('/duval-assets/A01/T1.svg', 'T1_P', 'T1_S'))
const duvalLayersD4 = computed(() => buildDuvalLayers('/duval-assets/A01/T4.svg', 'T4_P', 'T4_S'))
const duvalLayersD5 = computed(() => buildDuvalLayers('/duval-assets/A01/T5.svg', 'T5_P', 'T5_S'))
const duvalLayersP1 = computed(() => buildDuvalLayers('/duval-assets/A01/P1.svg', 'P1_P', 'P1_S'))
const duvalLayersP2 = computed(() => buildDuvalLayers('/duval-assets/A01/P2.svg', 'P2_P', 'P2_S'))

function isDuvalManualSelected(id: string) {
  return duvalManualSelectedAnalyses.value.includes(id)
}

function handleDuvalSelection(id: string, checked: boolean) {
  let updated = [...duvalManualSelectedAnalyses.value]
  if (checked) {
    if (!updated.includes(id)) updated.push(id)
  } else {
    updated = updated.filter((item) => item !== id)
  }
  duvalManualSelectedAnalyses.value = updated
}

function clearDuvalSelection() {
  duvalManualSelectedAnalyses.value = []
}

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

const analysisSearchQuery = ref('')
const analysisRecentTab = ref<AnalysisRecentTab>('padrao')
const showAnalysisRecentSubtabs = computed(() => isGlobalAnalisesView.value)
const advancedFilterModalOpen = ref(false)
const advancedFilterContext = ref<AdvancedFilterContext>('analises')
const advancedFilterRuleId = ref(1)
const advancedFilterApplied = ref<Record<AdvancedFilterContext, boolean>>({
  analises: false,
  coletas: false,
  tratamento: false,
})
const advancedFilterRulesDraft = ref<Record<AdvancedFilterContext, AdvancedFilterRule[]>>({
  analises: [],
  coletas: [],
  tratamento: [],
})
const advancedFilterRulesApplied = ref<Record<AdvancedFilterContext, AdvancedFilterRule[]>>({
  analises: [],
  coletas: [],
  tratamento: [],
})
const analysisColumnsMenuOpen = ref(false)
const analysisColumnsWrapRef = ref<HTMLElement | null>(null)
const analysisNewMenuOpen = ref(false)
const analysisExportMenuOpen = ref(false)
const analysisNewWrapRef = ref<HTMLElement | null>(null)
const analysisExportWrapRef = ref<HTMLElement | null>(null)
const analysisExportSelected = ref<string[]>([])
const analysisPage = ref(1)
const analysisRowsPerPage = ref(route.name === 'analises-view' ? 20 : 10)
const analysisRowsPerPageOptions = [10, 20, 30, 50]
const coletasActiveTab = ref<ColetasSubTab>('proximas')
const coletasNewMenuOpen = ref(false)
const coletasExportMenuOpen = ref(false)
const coletasNewWrapRef = ref<HTMLElement | null>(null)
const coletasExportWrapRef = ref<HTMLElement | null>(null)
const coletasExportOptions = ['Próximas', 'Realizadas']
const coletasExportSelected = ref<string[]>([])
const coletasFilterQuarter = ref('')
const coletasFilterMonth = ref('')
const coletasFilterYear = ref('')
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
const historyConditionsOpen = ref(true)
const historyAnalysesOpen = ref(true)
const evalCardOpen = ref<Record<'1' | '2' | '3' | '4' | '5', boolean>>({
  '1': true,
  '2': true,
  '3': true,
  '4': true,
  '5': true,
})
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

const coletasMonthOptions = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
]

const coletasQuarterOptions = [
  { value: 'Q1', label: 'Q1 (Jan-Mar)' },
  { value: 'Q2', label: 'Q2 (Abr-Jun)' },
  { value: 'Q3', label: 'Q3 (Jul-Set)' },
  { value: 'Q4', label: 'Q4 (Out-Dez)' },
]

function toggleEvalCard(card: '1' | '2' | '3' | '4' | '5') {
  evalCardOpen.value[card] = !evalCardOpen.value[card]
}

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

const oltcAnalysisColumns: OltcAnalysisColumn[] = [
  { id: 'transformador', label: 'Transformador', group: 'Geral', defaultVisible: true },
  { id: 'dataColeta', label: 'Data Coleta', group: 'Geral', defaultVisible: true },
  { id: 'subestacao', label: 'Subestação', group: 'Geral', defaultVisible: true },
  { id: 'unidade', label: 'Unidade', group: 'Geral', defaultVisible: true },
  { id: 'tag', label: 'Tag', group: 'Geral', defaultVisible: true },
  { id: 'laboratorio', label: 'Laboratório', group: 'Geral', defaultVisible: true },
  { id: 'noSerieTransformador', label: 'No. Série Transformador', group: 'OLTC', defaultVisible: true },
  { id: 'noSerieComutador', label: 'No. Série Comutador', group: 'OLTC', defaultVisible: true },
  { id: 'rdLimite', label: 'RD (Mín. 40 kV)', group: 'OLTC', defaultVisible: true },
  { id: 'teorAguaLimite', label: 'Teor de Água (Máx. 30 ppm)', group: 'OLTC', defaultVisible: true },
  { id: 'statusOltc', label: 'Status OLTC', group: 'OLTC', defaultVisible: true },
  { id: 'modelo', label: 'Modelo', group: 'OLTC', defaultVisible: false },
  { id: 'fabricante', label: 'Fabricante', group: 'OLTC', defaultVisible: false },
  { id: 'filtro', label: 'Filtro', group: 'OLTC', defaultVisible: false },
  { id: 'anoFabricacao', label: 'Ano de Fabricação', group: 'OLTC', defaultVisible: false },
  { id: 'dataIntervencao', label: 'Data Intervenção', group: 'Físico Químico', defaultVisible: false },
  { id: 'tempAmostra', label: 'Temp. Amostra (°C)', group: 'Físico Químico', defaultVisible: false },
  { id: 'tempOleo', label: 'Temp. Óleo (°C)', group: 'Físico Químico', defaultVisible: false },
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
]

function getColumnsStorageUserKey() {
  if (typeof window === 'undefined') return 'anon'
  return (
    window.localStorage.getItem('axol.user.id')
    || window.localStorage.getItem('axol.user.email')
    || window.localStorage.getItem('axol.user')
    || 'anon'
  )
}

function buildColumnsStorageKey(scope: string) {
  return `${scope}.${getColumnsStorageUserKey()}`
}

function loadStoredColumnIds(scope: string, defaults: string[], allowed: string[]) {
  if (typeof window === 'undefined') return defaults
  try {
    const raw = window.localStorage.getItem(buildColumnsStorageKey(scope))
    if (!raw) return defaults
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return defaults
    const filtered = parsed.filter((value): value is string => typeof value === 'string' && allowed.includes(value))
    return filtered.length ? filtered : defaults
  } catch {
    return defaults
  }
}

function persistColumnIds(scope: string, value: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(buildColumnsStorageKey(scope), JSON.stringify(value))
}

const analysisColumnsScope = 'axol.columns.report.analysis.default'
const analysisColumnDefaults = analysisColumns.filter((column) => column.defaultVisible).map((column) => column.id)
const analysisColumnAllowed = analysisColumns.map((column) => column.id)
const oltcAnalysisColumnsScope = 'axol.columns.report.analysis.oltc'
const oltcAnalysisColumnDefaults = oltcAnalysisColumns.filter((column) => column.defaultVisible).map((column) => column.id)
const oltcAnalysisColumnAllowed = oltcAnalysisColumns.map((column) => column.id)

const analysisVisibleColumnIds = ref<string[]>(
  loadStoredColumnIds(analysisColumnsScope, analysisColumnDefaults, analysisColumnAllowed)
)
const oltcAnalysisVisibleColumnIds = ref<string[]>(
  loadStoredColumnIds(oltcAnalysisColumnsScope, oltcAnalysisColumnDefaults, oltcAnalysisColumnAllowed)
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
const oltcAnalysisVisibleColumns = computed(() =>
  oltcAnalysisColumns.filter((column) => oltcAnalysisVisibleColumnIds.value.includes(column.id))
)
const oltcAnalysisColumnsByGroup = computed(() => {
  const grouped = new Map<OltcAnalysisColumnGroup, OltcAnalysisColumn[]>()
  oltcAnalysisColumns.forEach((column) => {
    if (!grouped.has(column.group)) grouped.set(column.group, [])
    grouped.get(column.group)!.push(column)
  })
  return grouped
})
const activeAnalysisVisibleColumns = computed(() =>
  analysisRecentTab.value === 'oltc' ? oltcAnalysisVisibleColumns.value : analysisVisibleColumns.value
)
const activeAnalysisColumnsByGroup = computed(() =>
  analysisRecentTab.value === 'oltc' ? oltcAnalysisColumnsByGroup.value : analysisColumnsByGroup.value
)
const analysisExportOptions = computed(() =>
  analysisRecentTab.value === 'oltc'
    ? ['OLTC', 'Físico Químico']
    : ['Cromatografia', 'Físico Químico', 'Ensaios Especiais']
)

function isActiveAnalysisColumnChecked(columnId: string) {
  return analysisRecentTab.value === 'oltc'
    ? oltcAnalysisVisibleColumnIds.value.includes(columnId)
    : analysisVisibleColumnIds.value.includes(columnId)
}

function isActiveAnalysisColumnLocked(columnId: string) {
  if (analysisRecentTab.value === 'oltc') {
    return (
      oltcAnalysisVisibleColumnIds.value.length === 1
      && oltcAnalysisVisibleColumnIds.value.includes(columnId)
    )
  }
  return analysisVisibleColumnIds.value.length === 1 && analysisVisibleColumnIds.value.includes(columnId)
}

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
    transformerPickerWrapRef.value?.contains(target) ||
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
  transformerPickerOpen.value = false
  transformerPickerSearch.value = ''
  transformerPickerFocusedIndex.value = -1
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

function toggleOltcAnalysisColumn(columnId: string) {
  if (oltcAnalysisVisibleColumnIds.value.includes(columnId)) {
    if (oltcAnalysisVisibleColumnIds.value.length === 1) return
    oltcAnalysisVisibleColumnIds.value = oltcAnalysisVisibleColumnIds.value.filter((id) => id !== columnId)
    return
  }
  oltcAnalysisVisibleColumnIds.value = [...oltcAnalysisVisibleColumnIds.value, columnId]
}

function toggleActiveAnalysisColumn(columnId: string) {
  if (analysisRecentTab.value === 'oltc') {
    toggleOltcAnalysisColumn(columnId)
    return
  }
  toggleAnalysisColumn(columnId)
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

const selectedOltcMeta = computed<BaseRow | null>(() => {
  const selected = selectedTransformer.value
  if (!selected) return null
  const selectedSerial = normalizedToken(selected.serial)
  const serialAliases = (getAnalysisDataSerialAliases()[selected.id] || []).map((value) => normalizedToken(value))
  const serialCandidates = new Set([selectedSerial, ...serialAliases].filter(Boolean))
  const selectedTag = normalizedToken(selected.tag)
  const rows = ((oltcData as any)?.oltc || []) as BaseRow[]
  return rows.find((row) => {
    const serialTrafo = normalizedToken(row.SERIAL_TRANSFORMADOR)
    const serialOltc = normalizedToken(row.SERIAL_OLTC)
    const tag = normalizedToken(row.TAG)
    if (serialCandidates.has(serialTrafo)) return true
    if (serialCandidates.has(serialOltc)) return true
    return !!selectedTag && tag === selectedTag
  }) || null
})

function rowMatchesSelectedTransformer(row: BaseRow) {
  if (isGlobalScopeView.value) return true
  const selected = selectedTransformer.value
  if (!selected) return true

  const selectedSerial = normalizedToken(selected.serial)
  const serialAliases = (getAnalysisDataSerialAliases()[selected.id] || []).map((value) => normalizedToken(value))
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
  const fallbackSubstation = isGlobalScopeView.value ? '-' : selected?.substation || '-'
  const fallbackUnit = isGlobalScopeView.value ? '-' : selected?.unit || '-'
  const fallbackTag = isGlobalScopeView.value ? '-' : selected?.tag || '-'
  const fallbackTransformer = isGlobalScopeView.value ? '-' : selected?.serial || selected?.id || '-'

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

const oltcUnifiedAnalysisRows = computed<UnifiedAnalysisRow[]>(() => {
  const selected = selectedTransformer.value
  if (!selected) return []
  const fallbackSubstation = selected.substation || '-'
  const fallbackUnit = selected.unit || '-'
  const fallbackTag = selected.tag || '-'
  const fallbackTransformer = selected.serial || selected.id || '-'
  const oltcMeta = selectedOltcMeta.value
  const noSerieComutador = normalizeCell(oltcMeta?.SERIAL_OLTC)
  const statusOltc = normalizeCell(oltcMeta?.ESTADO)
  const modelo = normalizeCell(oltcMeta?.MODELO)
  const fabricante = normalizeCell(oltcMeta?.FABRICANTE)
  const filtro = normalizeCell(oltcMeta?.FILTRO)
  const anoFabricacao = normalizeCell(oltcMeta?.ANO_FABRICACAO)

  return parseLooseJson<BaseRow[]>(fisicoQuimicosOltcRaw)
    .filter(rowMatchesSelectedTransformer)
    .map((row, index) => {
      const rdValue = normalizeCell(row.RD)
      const teorAguaValue = normalizeCell(row.TEOR_AGUA)
      const dataColeta = normalizeCell(row.DATA_COLETA)
      return {
        id: `oltc-${index}-${dataColeta}`,
        sortTime: parseBrDate(row.DATA_COLETA),
        transformador: pickCell(row, 'NUM_SERIE', 'SERIAL_TRANSFORMADOR') || fallbackTransformer,
        noSerieTransformador: pickCell(row, 'NUM_SERIE', 'SERIAL_TRANSFORMADOR') || fallbackTransformer,
        dataColeta,
        subestacao: pickCell(row, 'SUBESTACAO') !== '-' ? pickCell(row, 'SUBESTACAO') : fallbackSubstation,
        unidade: pickCell(row, 'UNIDADE') !== '-' ? pickCell(row, 'UNIDADE') : fallbackUnit,
        tag: pickCell(row, 'TAG') !== '-' ? pickCell(row, 'TAG') : fallbackTag,
        laboratorio: normalizeCell(row.LAB),
        noSerieComutador,
        statusOltc,
        modelo,
        fabricante,
        filtro,
        anoFabricacao,
        rdLimite: rdValue === '-' ? '-' : `${rdValue}`,
        teorAguaLimite: teorAguaValue === '-' ? '-' : `${teorAguaValue}`,
        dataIntervencao: normalizeCell(row.DATA_INTERVENCAO),
        tempAmostra: normalizeCell(row.TEMP_AMOSTRA),
        tempOleo: normalizeCell(row.TEMP_OLEO),
        teorAgua: teorAguaValue,
        rd: rdValue,
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
    .sort((a, b) => b.sortTime - a.sortTime)
})

const coletasAdvancedColumns = [
  { value: 'transformador', label: 'Transformador' },
  { value: 'status', label: 'Status' },
  { value: 'statusUltimaColeta', label: 'Status Última Coleta' },
  { value: 'dataColeta', label: 'Data Coleta' },
  { value: 'subestacao', label: 'Subestação' },
  { value: 'unidade', label: 'Unidade' },
  { value: 'tag', label: 'Tag' },
  { value: 'tipoAnalise', label: 'Tipo de Análise' },
  { value: 'faltamDias', label: 'Faltam Dia(s)' },
]

const analysisAdvancedColumns = computed(() =>
  (analysisRecentTab.value === 'oltc' ? oltcAnalysisColumns : analysisColumns).map((column) => ({
    value: column.id,
    label: column.label,
  }))
)
const treatmentAdvancedColumns = computed(() =>
  treatmentColumns.map((column) => ({ value: column.id, label: column.label }))
)
const activeAdvancedFilterFieldOptions = computed(() => {
  if (advancedFilterContext.value === 'analises') return analysisAdvancedColumns.value
  if (advancedFilterContext.value === 'coletas') return coletasAdvancedColumns
  return treatmentAdvancedColumns.value
})
const advancedAnalysisFieldEnumOptions: Record<string, string[]> = {
  tipo: ['Cromatografia', 'Físico Químico', 'Ensaios Especiais'],
  statusOltc: ['Normal', 'Alerta', 'Crítico', 'Pendente'],
  enxofreCorrosivo: ['CORROSIVO', 'NAO CORROSIVO'],
}
const advancedColetasFieldEnumOptions: Record<string, string[]> = {
  status: ['Pendente', 'Atrasada', 'Coletado'],
  statusUltimaColeta: ['Normal', 'Alerta', 'Crítico', 'Pendente'],
  tipoAnalise: ['Cromatografia', 'Físico Químico', 'Ensaios Especiais'],
}
const advancedTreatmentFieldEnumOptions: Record<string, string[]> = {
  statusTratamento: ['Concluído', 'Pendente', 'Em Andamento'],
  comutador: ['SIM', 'NÃO', 'CST', '-'],
  operando: ['SIM', 'NÃO', '-'],
  selado: ['SIM', 'NÃO', '-'],
}

function getAdvancedFieldValueOptions(context: AdvancedFilterContext, field: string) {
  if (context === 'analises') return advancedAnalysisFieldEnumOptions[field] || []
  if (context === 'coletas') return advancedColetasFieldEnumOptions[field] || []
  return advancedTreatmentFieldEnumOptions[field] || []
}

function createAdvancedRule(context: AdvancedFilterContext): AdvancedFilterRule {
  const options =
    context === 'analises'
      ? analysisAdvancedColumns.value
      : context === 'coletas'
        ? coletasAdvancedColumns
        : treatmentAdvancedColumns.value
  return {
    id: advancedFilterRuleId.value++,
    field: options[0]?.value || '',
    operator: '=',
    value: '',
    connector: 'AND',
  }
}

function normalizeComparable(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function parseComparableNumber(value: unknown) {
  const parsed = Number(String(value ?? '').trim().replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function advancedRuleMatches(row: Record<string, unknown>, rule: AdvancedFilterRule) {
  const fieldValue = row[rule.field]
  const leftNum = parseComparableNumber(fieldValue)
  const rightNum = parseComparableNumber(rule.value)
  if (leftNum !== null && rightNum !== null) {
    if (rule.operator === '=') return leftNum === rightNum
    if (rule.operator === '!=') return leftNum !== rightNum
    if (rule.operator === '>') return leftNum > rightNum
    if (rule.operator === '<') return leftNum < rightNum
    if (rule.operator === '>=') return leftNum >= rightNum
    return leftNum <= rightNum
  }

  const left = normalizeComparable(fieldValue)
  const right = normalizeComparable(rule.value)
  if (!right) return true
  if (rule.operator === '=') return left.includes(right)
  if (rule.operator === '!=') return !left.includes(right)
  if (rule.operator === '>') return left > right
  if (rule.operator === '<') return left < right
  if (rule.operator === '>=') return left >= right
  return left <= right
}

function matchesAdvancedFilterContext(context: AdvancedFilterContext, row: Record<string, unknown>) {
  if (!advancedFilterApplied.value[context]) return true
  const rules = advancedFilterRulesApplied.value[context].filter((rule) => rule.field && rule.value.trim())
  if (!rules.length) return true
  let result = advancedRuleMatches(row, rules[0]!)
  for (let index = 1; index < rules.length; index += 1) {
    const rule = rules[index]!
    const current = advancedRuleMatches(row, rule)
    result = rule.connector === 'OR' ? result || current : result && current
  }
  return result
}

function openAdvancedFilterModal(context: AdvancedFilterContext) {
  advancedFilterContext.value = context
  const appliedRules = advancedFilterRulesApplied.value[context]
  advancedFilterRulesDraft.value[context] = appliedRules.length
    ? appliedRules.map((rule) => ({ ...rule }))
    : [createAdvancedRule(context)]
  advancedFilterModalOpen.value = true
}

function closeAdvancedFilterModal() {
  advancedFilterModalOpen.value = false
}

function addAdvancedFilterRule() {
  const context = advancedFilterContext.value
  advancedFilterRulesDraft.value[context] = [
    ...advancedFilterRulesDraft.value[context],
    createAdvancedRule(context),
  ]
}

function removeAdvancedFilterRule(ruleId: number) {
  const context = advancedFilterContext.value
  const current = advancedFilterRulesDraft.value[context]
  if (current.length === 1) {
    advancedFilterRulesDraft.value[context] = [createAdvancedRule(context)]
    return
  }
  advancedFilterRulesDraft.value[context] = current.filter((rule) => rule.id !== ruleId)
}

function applyAdvancedFilterModal() {
  const context = advancedFilterContext.value
  const validRules = advancedFilterRulesDraft.value[context].filter((rule) => rule.field && rule.value.trim())
  advancedFilterRulesApplied.value[context] = validRules.map((rule) => ({ ...rule }))
  advancedFilterApplied.value[context] = validRules.length > 0
  advancedFilterModalOpen.value = false
  if (context === 'analises') analysisPage.value = 1
}

function clearAdvancedFilter(context: AdvancedFilterContext) {
  advancedFilterApplied.value[context] = false
  advancedFilterRulesApplied.value[context] = []
  advancedFilterRulesDraft.value[context] = []
  if (context === 'analises') analysisPage.value = 1
}

function handleAdvancedFilterPillClick(context: AdvancedFilterContext) {
  openAdvancedFilterModal(context)
}

function clearAdvancedFilterDraft() {
  const context = advancedFilterContext.value
  advancedFilterRulesDraft.value[context] = [createAdvancedRule(context)]
}

const filteredDefaultAnalysisRows = computed(() => {
  const query = analysisSearchQuery.value.trim().toLowerCase()
  const queryFiltered = !query
    ? unifiedAnalysisRows.value
    : unifiedAnalysisRows.value.filter((row) =>
    Object.values(row).some((value) => String(value).toLowerCase().includes(query))
  )
  return queryFiltered.filter((row) => matchesAdvancedFilterContext('analises', row as Record<string, unknown>))
})

const filteredOltcAnalysisRows = computed(() => {
  const query = analysisSearchQuery.value.trim().toLowerCase()
  const queryFiltered = !query
    ? oltcUnifiedAnalysisRows.value
    : oltcUnifiedAnalysisRows.value.filter((row) =>
    Object.values(row).some((value) => String(value).toLowerCase().includes(query))
  )
  return queryFiltered.filter((row) => matchesAdvancedFilterContext('analises', row as Record<string, unknown>))
})

const filteredUnifiedAnalysisRows = computed(() =>
  analysisRecentTab.value === 'oltc' ? filteredOltcAnalysisRows.value : filteredDefaultAnalysisRows.value
)

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

watch(analysisSearchQuery, () => {
  analysisPage.value = 1
})

watch(analysisRecentTab, () => {
  analysisPage.value = 1
  analysisColumnsMenuOpen.value = false
  analysisExportSelected.value = [...analysisExportOptions.value]
})

watch(
  activeMacroTab,
  () => {
    if (isGlobalAnalisesView.value) return
    analysisRecentTab.value = isOltcMacro.value ? 'oltc' : 'padrao'
  },
  { immediate: true }
)

watch(
  analysisVisibleColumnIds,
  (value) => {
    persistColumnIds(analysisColumnsScope, value)
  },
  { deep: true }
)

watch(
  oltcAnalysisVisibleColumnIds,
  (value) => {
    persistColumnIds(oltcAnalysisColumnsScope, value)
  },
  { deep: true }
)

watch(
  () => route.name,
  (name) => {
    analysisRowsPerPage.value = name === 'analises-view' ? 20 : 10
  }
)

watch(
  analysisExportOptions,
  (options) => {
    if (!analysisExportSelected.value.length) {
      analysisExportSelected.value = [...options]
      return
    }
    analysisExportSelected.value = analysisExportSelected.value.filter((item) => options.includes(item))
  },
  { immediate: true }
)

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

function getBrDateMonthYear(value: string) {
  const parts = String(value || '').split('/')
  if (parts.length !== 3) return { month: '', year: '' }
  const month = parts[1]?.padStart(2, '0') || ''
  const year = parts[2] || ''
  const monthNumber = Number(month)
  const quarter =
    monthNumber >= 1 && monthNumber <= 3
      ? 'Q1'
      : monthNumber >= 4 && monthNumber <= 6
        ? 'Q2'
        : monthNumber >= 7 && monthNumber <= 9
          ? 'Q3'
          : monthNumber >= 10 && monthNumber <= 12
            ? 'Q4'
            : ''
  return { month, year, quarter }
}

const coletasYearOptions = computed(() => {
  const allRows = [...coletasRows.value.proximas, ...coletasRows.value.realizadas]
  const years = Array.from(
    new Set(
      allRows
        .map((row) => getBrDateMonthYear(row.dataColeta).year)
        .filter((year) => /^\d{4}$/.test(year))
    )
  )
  return years.sort((a, b) => Number(b) - Number(a))
})

const coletasFilteredRows = computed(() => {
  const rows = coletasActiveTab.value === 'proximas' ? coletasRows.value.proximas : coletasRows.value.realizadas
  const selectedQuarter = coletasFilterQuarter.value
  const selectedMonth = coletasFilterMonth.value
  const selectedYear = coletasFilterYear.value
  const periodFiltered = (!selectedQuarter && !selectedMonth && !selectedYear)
    ? rows
    : rows.filter((row) => {
    const { month, year, quarter } = getBrDateMonthYear(row.dataColeta)
    if (selectedQuarter && quarter !== selectedQuarter) return false
    if (selectedMonth && month !== selectedMonth) return false
    if (selectedYear && year !== selectedYear) return false
    return true
  })
  return periodFiltered.filter((row) => matchesAdvancedFilterContext('coletas', row as Record<string, unknown>))
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

const treatmentColumnsScope = 'axol.columns.report.treatment'
const treatmentColumnDefaults = treatmentColumns.filter((column) => column.defaultVisible).map((column) => column.id)
const treatmentColumnAllowed = treatmentColumns.map((column) => column.id)
const treatmentVisibleColumnIds = ref<string[]>(
  loadStoredColumnIds(treatmentColumnsScope, treatmentColumnDefaults, treatmentColumnAllowed)
)

const treatmentVisibleColumns = computed(() =>
  treatmentColumns.filter((column) => treatmentVisibleColumnIds.value.includes(column.id))
)

watch(
  treatmentVisibleColumnIds,
  (value) => {
    persistColumnIds(treatmentColumnsScope, value)
  },
  { deep: true }
)

const treatmentRows = computed<TreatmentRow[]>(() => {
  if (isGlobalScopeView.value) {
    const latestBySerial = new Map<string, BaseRow>()
    parseLooseJson<BaseRow[]>(fisicoQuimicosRaw)
      .filter(rowMatchesSelectedTransformer)
      .forEach((row) => {
        const serial = String(row.NUM_SERIE || row.SERIAL_TRANSFORMADOR || '').trim()
        if (!serial) return
        const current = latestBySerial.get(serial)
        const rowTime = parseBrDate(row.DATA_COLETA)
        const currentTime = current ? parseBrDate(current.DATA_COLETA) : 0
        if (!current || rowTime >= currentTime) {
          latestBySerial.set(serial, row)
        }
      })

    const rows = Array.from(latestBySerial.entries()).map(([serial, latestFisico], index) => {
      const transformerMeta = transformerOptions.value.find((item) => item.serial === serial)
      const tratamentoNome = `Tratamento a Óleo ${normalizeCell((latestFisico as BaseRow).TENSAO_INTERFACIAL)}`
      return {
        id: `treatment-global-${serial}-${index}`,
        serial,
        statusTratamento: 'Concluído',
        equipamento: transformerMeta?.equipment || '-',
        comutador: transformerMeta?.commutator || '-',
        oleoFluido: transformerMeta?.oilFluid || '-',
        tensaoPrimaria: transformerMeta?.voltage || '-',
        tensaoSecundaria: '-',
        anoFabricacao: transformerMeta?.year || '-',
        potencia: transformerMeta?.power || '-',
        fabricante: transformerMeta?.manufacturer || '-',
        volumeLitros: transformerMeta?.volume || '-',
        refrigeracao: transformerMeta?.refrigeration || '-',
        subestacao: normalizeCell((latestFisico as BaseRow).SUBESTACAO) || transformerMeta?.substation || '-',
        tag: normalizeCell((latestFisico as BaseRow).TAG) || transformerMeta?.tag || '-',
        identificacao: transformerMeta?.id || serial,
        carregamento: transformerMeta?.load || '-',
        operando: transformerMeta?.operating || '-',
        unidade: normalizeCell((latestFisico as BaseRow).UNIDADE) || transformerMeta?.unit || '-',
        selado: transformerMeta?.sealed || '-',
        rd: normalizeCell((latestFisico as BaseRow).RD),
        teorAgua: normalizeCell((latestFisico as BaseRow).TEOR_AGUA),
        tensaoInterfacial: normalizeCell((latestFisico as BaseRow).TENSAO_INTERFACIAL),
        indNeutralizacao: normalizeCell((latestFisico as BaseRow)['IND_NEUTRALIZACAO ']),
        fator25: normalizeCell((latestFisico as BaseRow).FATOR_POT_25),
        fator90: normalizeCell((latestFisico as BaseRow).FATOR_POT_90),
        fator100: normalizeCell((latestFisico as BaseRow).FATOR_POT_100),
        dbpc: normalizeCell((latestFisico as BaseRow).DBPC),
        tratamentoNome,
        dataColeta: normalizeCell((latestFisico as BaseRow).DATA_COLETA),
        tipoAnalise: 'Físico Químico',
      }
    })
    return [...rows, ...manualTreatmentRows.value]
  }

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
  const queryFiltered = !query
    ? treatmentRows.value
    : treatmentRows.value.filter((row) =>
    Object.values(row).some((value) => String(value).toLowerCase().includes(query))
  )
  return queryFiltered.filter((row) => matchesAdvancedFilterContext('tratamento', row as Record<string, unknown>))
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
  const trafo = selectedTransformer.value
  const id = String(trafo?.id || '').toUpperCase()
  const serial = String(trafo?.serial || '').toUpperCase()
  const tag = String(trafo?.tag || '').toUpperCase()
  const is9701A01Demo = id.includes('9701-A01') || (tag === '9701' && serial === 'A01')

  if (is9701A01Demo) return [5, 25, 50, 75, 100]

  const status = normalizeStatus(selectedTransformer.value?.statusAnalyst || selectedTransformer.value?.status || '')
  if (status === 'Crítico') return [8.5, 12.2, 19.8, 27.5, 32.0]
  if (status === 'Alerta') return [0, 0, 85.14, 14.86, 0]
  return [100, 0, 0, 0, 0]
})

function riskLevelColorVar(index: number) {
  return `var(--level-n${index + 1}, #1e4e8b)`
}

function riskLevelColor(index: number, probability: number) {
  const levelRgb: Record<number, [number, number, number]> = {
    0: [0, 255, 0], // N1
    1: [128, 255, 0], // N2
    2: [255, 255, 0], // N3
    3: [255, 128, 0], // N4
    4: [255, 0, 0], // N5
  }
  const [r, g, b] = levelRgb[index] || [30, 78, 139]
  const pct = Math.max(0, Math.min(100, Number(probability) || 0))
  const alpha = pct / 100
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
}

const riskParameterDefs = [
  { key: 'TEMP', label: 'TEMP', tooltip: 'TEMP - Temperatura' },
  { key: 'H2O', label: 'H₂O', tooltip: 'H₂O - Água' },
  { key: 'TIF', label: 'TIF', tooltip: 'TIF - Tensão Interfacial' },
  { key: 'RD', label: 'RD', tooltip: 'RD - Rigidez Dielétrica' },
  { key: 'EC', label: 'EC', tooltip: 'EC - Ensaio de Cor' },
  { key: 'H2', label: 'H₂', tooltip: 'H₂ - Hidrogênio' },
  { key: 'DBDS', label: 'DBDS', tooltip: 'DBDS - Dibenzil Dissulfeto' },
  { key: 'CARRE', label: 'CARRE', tooltip: 'CARRE - Carregamento' },
  { key: 'GP', label: 'GP', tooltip: 'GP - Grau de Polimerização' },
  { key: 'DGAF', label: 'DGAF', tooltip: 'DGAF - Diagnóstico de Gases de Falha' },
  { key: 'CO', label: 'CO', tooltip: 'CO - Monóxido de Carbono' },
  { key: 'CO2', label: 'CO₂', tooltip: 'CO₂ - Dióxido de Carbono' },
  { key: 'C2H4', label: 'C₂H₄', tooltip: 'C₂H₄ - Etileno' },
  { key: 'C2H2', label: 'C₂H₂', tooltip: 'C₂H₂ - Acetileno' },
]
const demoRiskHeatmapByLabel: Record<string, number[]> = {
  TEMP: [0, 1, 0, 0, 0],
  H2O: [0, 12, 0, 0, 0],
  TIF: [0, 0, 35, 0, 0],
  RD: [0, 0, 0, 55, 0],
  EC: [0, 0, 0, 0, 78],
  H2: [0, 0, 0, 18, 0],
  DBDS: [0, 0, 4, 0, 0],
  CARRE: [0, 22, 0, 0, 0],
  GP: [0, 0, 0, 0, 100],
  DGAF: [0, 0, 0, 48, 0],
  CO: [0, 9, 0, 0, 0],
  CO2: [0, 0, 0, 0, 64],
  C2H4: [0, 0, 14, 0, 0],
  C2H2: [0, 0, 0, 0, 8],
}

const riskHeatmapRows = computed(() => {
  const trafo = selectedTransformer.value
  const id = String(trafo?.id || '').toUpperCase()
  const serial = String(trafo?.serial || '').toUpperCase()
  const tag = String(trafo?.tag || '').toUpperCase()
  const is9701A01Demo = id.includes('9701-A01') || (tag === '9701' && serial === 'A01')

  if (is9701A01Demo) {
    return riskParameterDefs.map((parameter) => ({
      key: parameter.key,
      label: parameter.label,
      tooltip: parameter.tooltip,
      values: demoRiskHeatmapByLabel[parameter.key] || [0, 0, 0, 0, 0],
    }))
  }

  const levels = riskProbabilities.value.map((value, index) => {
    const scale = Math.max(value, 8)
    return riskParameterDefs.map((_, labelIndex) => {
      const ratio = 0.15 + ((labelIndex % 7) * 0.06) + index * 0.015
      return Number((scale * ratio).toFixed(2))
    })
  })

  return riskParameterDefs.map((parameter, rowIndex) => ({
    key: parameter.key,
    label: parameter.label,
    tooltip: parameter.tooltip,
    values: levels.map((levelValues) => levelValues[rowIndex] || 0),
  }))
})

function riskHeatCellStyle(value: number) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
  if (safe <= 0) {
    return {
      backgroundColor: 'transparent',
      borderColor: 'rgba(148, 163, 184, 0.2)',
      color: 'rgba(71, 85, 105, 0.7)',
    }
  }

  const normalized = (safe - 1) / 99
  const alpha = 0.12 + Math.max(0, normalized) * 0.88
  return {
    backgroundColor: `rgba(255, 0, 0, ${alpha.toFixed(3)})`,
    borderColor: `rgba(185, 28, 28, ${(0.28 + normalized * 0.52).toFixed(3)})`,
    color: safe >= 62 ? '#ffffff' : '#7f1d1d',
  }
}

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
  if (tone === 'tone-danger') return { color: '#8f0000', backgroundColor: 'rgba(255, 0, 0, 0.16)', fontWeight: '700' }
  if (tone === 'tone-warning') return { color: '#666300', backgroundColor: 'rgba(255, 255, 0, 0.2)', fontWeight: '700' }
  if (tone === 'tone-neutral') return { color: '#475569', backgroundColor: 'rgba(148, 163, 184, 0.16)', fontWeight: '700' }
  return { color: '#0b5f0b', backgroundColor: 'rgba(0, 255, 0, 0.16)', fontWeight: '700' }
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
      :eyebrow="pageEyebrow"
      :title="pageTitle"
      :subtitle="pageSubtitle"
      :secondaryAction="{ label: 'Start Óleo', onClick: () => {} }"
      :action="{ label: 'Voltar ao Painel', onClick: () => router.push({ name: 'dashboard' }) }"
    />

    <section class="report-shell">
      <div v-if="!isGlobalScopeView" class="report-toolbar">
        <div v-if="!isGlobalScopeView" ref="transformerPickerWrapRef" class="selector">
          <label for="trafo-picker-trigger">Selecionar transformador</label>
          <button
            id="trafo-picker-trigger"
            ref="transformerPickerTriggerRef"
            type="button"
            class="transformer-picker-trigger"
            :aria-expanded="transformerPickerOpen ? 'true' : 'false'"
            aria-haspopup="listbox"
            @click="toggleTransformerPicker"
            @keydown.down.prevent="openTransformerPicker"
          >
            <span class="transformer-picker-trigger-label">{{ selectedTransformerLabel }}</span>
            <i aria-hidden="true">{{ transformerPickerOpen ? '▴' : '▾' }}</i>
          </button>
          <div
            v-if="transformerPickerOpen"
            ref="transformerPickerMenuRef"
            class="transformer-picker-menu"
            @keydown="handleTransformerPickerKeydown"
          >
            <div class="transformer-picker-search-wrap">
              <input
                ref="transformerPickerSearchRef"
                v-model="transformerPickerSearch"
                type="text"
                class="transformer-picker-search"
                placeholder="Buscar subestação ou transformador..."
                aria-label="Buscar subestação ou transformador"
                @keydown.down.prevent="moveTransformerPickerFocus(1)"
                @keydown.up.prevent="moveTransformerPickerFocus(-1)"
              />
            </div>
            <div class="transformer-picker-list" role="listbox" aria-label="Transformadores por subestação">
              <template v-for="entry in transformerPickerEntries" :key="entry.key">
                <button
                  v-if="entry.kind === 'group'"
                  type="button"
                  class="transformer-picker-group"
                  :data-trafo-index="entry.index"
                  :aria-expanded="isTransformerGroupExpanded(entry.group) ? 'true' : 'false'"
                  @click="toggleTransformerGroup(entry.group.substation)"
                >
                  <span class="transformer-picker-group-main">
                    <i class="transformer-picker-caret" aria-hidden="true">
                      {{ isTransformerGroupExpanded(entry.group) ? '−' : '+' }}
                    </i>
                    {{ entry.group.substation }}
                  </span>
                  <small>{{ visibleTransformerItems(entry.group).length }}</small>
                </button>
                <button
                  v-else
                  type="button"
                  class="transformer-picker-item"
                  :class="{ active: entry.item.id === selectedId }"
                  :data-trafo-index="entry.index"
                  @click="selectTransformerFromPicker(entry.item)"
                >
                  <span>{{ entry.item.id }}</span>
                  <small>{{ entry.item.serial }}</small>
                </button>
              </template>
              <div v-if="!transformerPickerEntries.length" class="transformer-picker-empty">
                Nenhum transformador encontrado.
              </div>
            </div>
          </div>
        </div>
        <nav class="macro-tabs" aria-label="Tipo de relatório">
          <button
            v-for="macro in macroTabs"
            :key="macro"
            type="button"
            class="macro-tab-btn"
            :class="{ active: activeMacroTab === macro }"
            @click="activeMacroTab = macro"
          >
            {{ macro }}
          </button>
        </nav>
        <div class="report-toolbar-actions">
          <button
            type="button"
            class="locate-btn"
            :disabled="!selectedTransformer || isGlobalScopeView"
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

      <div v-if="selectedTransformer && !isGlobalScopeView" class="summary-grid">
        <article class="summary-card summary-viewer-card">
          <div class="summary-media-container">
            <button
              type="button"
              class="summary-viewer-expand"
              aria-label="Expandir visualização do transformador"
              @click="openReportViewerModal"
            >
              ⛶
            </button>
            <iframe
              v-if="reportViewerCardSrc"
              class="summary-viewer-frame"
              :src="reportViewerCardSrc"
              title="Visualização do transformador"
              loading="lazy"
              scrolling="no"
            ></iframe>
            <div v-else class="summary-viewer-fallback">Visualização indisponível para este transformador.</div>
          </div>
        </article>
        <article class="summary-card">
          <div class="summary-title-row">
            <h3>{{ selectedTransformer.id }}</h3>
            <div class="pill-row">
              <span class="pill" :class="statusClass(selectedTransformer.status)">
                Status TR-Óleo: {{ selectedTransformer.status }}
              </span>
              <span class="pill" :class="statusClass(selectedTransformer.statusAnalyst)">
                Status Analista: {{ selectedTransformer.statusAnalyst }}
              </span>
            </div>
          </div>
          <p>{{ selectedTransformer.substation }} • {{ selectedTransformer.reference }}</p>
          <h4 class="summary-main-data-title">Dados principais</h4>
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

      <nav v-if="!isGlobalScopeView" class="tabs">
        <button
          v-for="tab in activeSubTabs"
          :key="tab.value"
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === tab.value }"
          @click="activeTab = tab.value"
        >
          {{ tab.label }}
        </button>
      </nav>

      <section v-if="activeTab === 'Histórico de Análises'" class="panel table-panel history-panel">
        <article v-if="!isGlobalAnalisesView" class="history-block-card">
          <button
            type="button"
            class="expandable-head-btn"
            :class="{ open: historyConditionsOpen }"
            @click="historyConditionsOpen = !historyConditionsOpen"
          >
            <span>Análise Linear</span>
            <i class="expandable-toggle-icon" aria-hidden="true">{{ historyConditionsOpen ? '−' : '+' }}</i>
          </button>
          <template v-if="historyConditionsOpen">
            <div class="history-linear-children">
              <article class="history-block-card history-linear-child-card">
                <table class="table history-conditions-table">
                  <thead>
                    <tr>
                      <th class="text-center" colspan="8">Condições: IEEE Std C57.104™-2008</th>
                    </tr>
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

              <article v-if="activeHistoryModel.categories.length" class="history-block-card history-linear-child-card">
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
            </div>
          </template>
        </article>
        <article class="history-block-card history-analyses-card">
          <button
            v-if="!isGlobalAnalisesView"
            type="button"
            class="expandable-head-btn"
            :class="{ open: historyAnalysesOpen }"
            @click="historyAnalysesOpen = !historyAnalysesOpen"
          >
            <span>Análises Recentes</span>
            <i class="expandable-toggle-icon" aria-hidden="true">{{ historyAnalysesOpen ? '−' : '+' }}</i>
          </button>
          <div v-if="isGlobalAnalisesView || historyAnalysesOpen" class="history-analyses-head">
            <div class="history-analyses-controls">
              <label class="history-analysis-search">
                <input
                  v-model="analysisSearchQuery"
                  type="text"
                  placeholder="Pesquisar..."
                  aria-label="Pesquisar análises recentes"
                />
              </label>
              <button
                v-if="isGlobalAnalisesView"
                type="button"
                class="history-columns-trigger advanced-filter-pill"
                :class="{ applied: advancedFilterApplied.analises }"
                @click="handleAdvancedFilterPillClick('analises')"
              >
                <span
                  v-if="advancedFilterApplied.analises"
                  class="advanced-filter-clear-btn"
                  role="button"
                  tabindex="0"
                  aria-label="Remover filtro avançado"
                  @click.stop="clearAdvancedFilter('analises')"
                  @keydown.enter.stop.prevent="clearAdvancedFilter('analises')"
                  @keydown.space.stop.prevent="clearAdvancedFilter('analises')"
                >
                  <span class="advanced-filter-icon-check" aria-hidden="true">✓</span>
                  <span class="advanced-filter-icon-remove" aria-hidden="true">✕</span>
                </span>
                <span v-else class="advanced-filter-pill-icon" aria-hidden="true">⚙</span>
                <span>Filtro avançado</span>
              </button>
              <div ref="analysisColumnsWrapRef" class="history-columns-picker">
                <button type="button" class="history-columns-trigger" @click="toggleAnalysisColumnsMenu">
                  <span>Colunas</span>
                  <i aria-hidden="true">▾</i>
                </button>
                <div v-if="analysisColumnsMenuOpen" class="history-columns-menu">
                  <section
                    v-for="[group, columns] in activeAnalysisColumnsByGroup"
                    :key="group"
                    class="history-columns-group"
                  >
                    <p>{{ group }}</p>
                    <label v-for="column in columns" :key="column.id" class="history-columns-option">
                      <input
                        type="checkbox"
                        :checked="isActiveAnalysisColumnChecked(column.id)"
                        :disabled="isActiveAnalysisColumnLocked(column.id)"
                        @change="toggleActiveAnalysisColumn(column.id)"
                      />
                      <span>{{ column.label }}</span>
                    </label>
                  </section>
                </div>
              </div>
              <div v-if="showAnalysisRecentSubtabs" class="history-tabs-inline history-tabs-main history-analyses-subtabs">
                <button
                  type="button"
                  class="history-tab-btn"
                  :class="{ active: analysisRecentTab === 'padrao' }"
                  @click="analysisRecentTab = 'padrao'"
                >
                  Padrão
                </button>
                <button
                  type="button"
                  class="history-tab-btn"
                  :class="{ active: analysisRecentTab === 'oltc' }"
                  @click="analysisRecentTab = 'oltc'"
                >
                  OLTC
                </button>
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
          <div v-if="isGlobalAnalisesView || historyAnalysesOpen" class="mini-table-wrap history-analyses-table-wrap">
            <table class="table compact analysis-table">
              <thead>
                <tr>
                  <th v-for="column in activeAnalysisVisibleColumns" :key="column.id" class="text-center">
                    {{ column.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in paginatedUnifiedAnalysisRows" :key="row.id">
                  <td v-for="column in activeAnalysisVisibleColumns" :key="`${row.id}-${column.id}`" class="text-center">
                    {{ row[column.id] }}
                  </td>
                </tr>
                <tr v-if="!filteredUnifiedAnalysisRows.length">
                  <td class="text-center" :colspan="activeAnalysisVisibleColumns.length">
                    Nenhuma análise encontrada para o filtro informado.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="isGlobalAnalisesView || historyAnalysesOpen" class="history-analyses-pagination">
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
        <div class="eval-left-stack">
        <article class="tile eval-card-1" :class="{ 'eval-collapsed': !evalCardOpen['1'] }">
          <div class="eval-card-head">
            <h4>1 - Resultado das avaliações</h4>
            <button type="button" class="eval-collapse-btn" @click="toggleEvalCard('1')">
              {{ evalCardOpen['1'] ? '−' : '+' }}
            </button>
          </div>
          <template v-if="evalCardOpen['1']">
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
          </template>
        </article>
        <article class="tile eval-card-2" :class="{ 'eval-collapsed': !evalCardOpen['2'] }">
          <div class="tile-head-actions eval-card-head-actions">
            <h4>2 - Avaliação do Especialista</h4>
            <div class="eval-card-action-group">
              <button type="button" class="edit-specialist-btn" @click="openSpecialistModal">
                <svg class="edit-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l8.06-8.06.92.92L5.92 19.58zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/>
                </svg>
                Editar avaliação
              </button>
              <button type="button" class="eval-collapse-btn" @click="toggleEvalCard('2')">
                {{ evalCardOpen['2'] ? '−' : '+' }}
              </button>
            </div>
          </div>
          <template v-if="evalCardOpen['2']">
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
          </template>
        </article>
        </div>
        <article class="tile eval-card-3" :class="{ 'eval-collapsed': !evalCardOpen['3'] }">
          <div class="eval-card-head">
            <h4>3 - Última Coleta</h4>
            <button type="button" class="eval-collapse-btn" @click="toggleEvalCard('3')">
              {{ evalCardOpen['3'] ? '−' : '+' }}
            </button>
          </div>
          <template v-if="evalCardOpen['3']">
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
          </template>
        </article>
        <article class="tile eval-card-4" :class="{ 'eval-collapsed': !evalCardOpen['4'] }">
          <div class="eval-card-head">
            <h4>5 - Avaliação do risco operacional do transformador</h4>
            <button type="button" class="eval-collapse-btn" @click="toggleEvalCard('4')">
              {{ evalCardOpen['4'] ? '−' : '+' }}
            </button>
          </div>
          <template v-if="evalCardOpen['4']">
          <p>
            As probabilidades calculadas representam as probabilidades de residência nos cinco níveis de estados
            operativos do transformador para no ano seguinte ao histórico.
          </p>
          <p><b>Probabilidade (%) de operação em risco para o próximo ano</b></p>

          <div class="risk-grid-shell">
          <div class="risk-pies risk-pies-aligned">
            <div class="risk-pies-tab" aria-label="Parâmetros">Parâmetros</div>
            <article
              v-for="(probability, index) in riskProbabilities"
              :key="`risk-${index}`"
              class="risk-pie-card"
              :style="{ '--risk-color': riskLevelColor(index, probability), '--risk-color-solid': riskLevelColorVar(index) }"
            >
              <h5>Nível-{{ index + 1 }}</h5>
              <div class="risk-pie" :style="{ '--pct': `${probability}%`, '--risk-color': riskLevelColor(index, probability) }">
                <span class="risk-pie-center">{{ probability.toFixed(2) }}%</span>
              </div>
            </article>
          </div>

          <div class="risk-heatmap-wrap">
            <div class="risk-heatmap-grid">
              <template v-for="row in riskHeatmapRows" :key="`risk-row-${row.key}`">
                <div class="risk-heatmap-label" :title="row.tooltip" :data-tooltip="row.tooltip">{{ row.label }}</div>
                <div
                  v-for="(value, idx) in row.values"
                  :key="`risk-cell-${row.key}-${idx}`"
                  class="risk-heatmap-cell"
                  :style="riskHeatCellStyle(value)"
                >
                  {{ value.toFixed(2) }}%
                </div>
              </template>
            </div>
          </div>
          </div>

          <p><b>Variáveis do óleo que levaram o transformador aos estados de risco:</b></p>
          <p>
            A matrix acima apresenta as variáveis do óleo isolante que levaram o transformador a operar nas regiões
            de risco (N1 a N5).
          </p>

          <div class="risk-heatmap-legend">
            <span class="risk-legend-title">Escala de cor:</span>
            <span class="risk-legend-stop">0%</span>
            <div class="risk-legend-scale"></div>
            <span class="risk-legend-stop">100%</span>
          </div>
          </template>
        </article>
        <article class="tile eval-card-5" :class="{ 'eval-collapsed': !evalCardOpen['5'] }">
          <div class="eval-card-head">
            <h4>4 - Tratamentos no óleo isolante</h4>
            <button type="button" class="eval-collapse-btn" @click="toggleEvalCard('5')">
              {{ evalCardOpen['5'] ? '−' : '+' }}
            </button>
          </div>
          <template v-if="evalCardOpen['5']">
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
          </template>
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
              <div class="coletas-period-filter" role="group" aria-label="Filtrar coletas por mês e ano">
                <select v-model="coletasFilterQuarter" aria-label="Filtrar coletas por quarter">
                  <option value="">Quarter</option>
                  <option v-for="quarter in coletasQuarterOptions" :key="`coletas-quarter-${quarter.value}`" :value="quarter.value">
                    {{ quarter.label }}
                  </option>
                </select>
                <select v-model="coletasFilterMonth" aria-label="Filtrar coletas por mês">
                  <option value="">Mês</option>
                  <option v-for="month in coletasMonthOptions" :key="`coletas-month-${month.value}`" :value="month.value">
                    {{ month.label }}
                  </option>
                </select>
                <select v-model="coletasFilterYear" aria-label="Filtrar coletas por ano">
                  <option value="">Ano</option>
                  <option v-for="year in coletasYearOptions" :key="`coletas-year-${year}`" :value="year">
                    {{ year }}
                  </option>
                </select>
              </div>
              <button
                v-if="isGlobalColetasView"
                type="button"
                class="history-columns-trigger advanced-filter-pill"
                :class="{ applied: advancedFilterApplied.coletas }"
                @click="handleAdvancedFilterPillClick('coletas')"
              >
                <span
                  v-if="advancedFilterApplied.coletas"
                  class="advanced-filter-clear-btn"
                  role="button"
                  tabindex="0"
                  aria-label="Remover filtro avançado"
                  @click.stop="clearAdvancedFilter('coletas')"
                  @keydown.enter.stop.prevent="clearAdvancedFilter('coletas')"
                  @keydown.space.stop.prevent="clearAdvancedFilter('coletas')"
                >
                  <span class="advanced-filter-icon-check" aria-hidden="true">✓</span>
                  <span class="advanced-filter-icon-remove" aria-hidden="true">✕</span>
                </span>
                <span v-else class="advanced-filter-pill-icon" aria-hidden="true">⚙</span>
                <span>Filtro avançado</span>
              </button>
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
              <button
                v-if="isGlobalTreatmentView"
                type="button"
                class="history-columns-trigger advanced-filter-pill"
                :class="{ applied: advancedFilterApplied.tratamento }"
                @click="handleAdvancedFilterPillClick('tratamento')"
              >
                <span
                  v-if="advancedFilterApplied.tratamento"
                  class="advanced-filter-clear-btn"
                  role="button"
                  tabindex="0"
                  aria-label="Remover filtro avançado"
                  @click.stop="clearAdvancedFilter('tratamento')"
                  @keydown.enter.stop.prevent="clearAdvancedFilter('tratamento')"
                  @keydown.space.stop.prevent="clearAdvancedFilter('tratamento')"
                >
                  <span class="advanced-filter-icon-check" aria-hidden="true">✓</span>
                  <span class="advanced-filter-icon-remove" aria-hidden="true">✕</span>
                </span>
                <span v-else class="advanced-filter-pill-icon" aria-hidden="true">⚙</span>
                <span>Filtro avançado</span>
              </button>
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

      <section v-else-if="activeTab === 'Duval'" class="panel table-panel">
        <article class="tile tile-wide duval-screen">
          <nav class="duval-tabs">
            <button
              type="button"
              class="duval-tab-btn"
              :class="{ active: duvalViewTab === 'triangulos' }"
              @click="duvalViewTab = 'triangulos'"
            >
              Triângulos Duval
            </button>
            <button
              type="button"
              class="duval-tab-btn"
              :class="{ active: duvalViewTab === 'pentagonos' }"
              @click="duvalViewTab = 'pentagonos'"
            >
              Pentágonos Duval
            </button>
          </nav>

          <div v-if="duvalViewTab === 'triangulos'" class="duval-diagram-grid duval-diagram-grid-triangles">
            <article class="duval-diagram-card">
              <div class="duval-image-frame">
                <img
                  v-for="(layer, index) in duvalLayersD1"
                  :key="`duval-d1-${index}`"
                  :src="layer"
                  class="duval-layer-image"
                  alt="Duval Triângulo 1"
                />
              </div>
              <ul class="duval-reference-list">
                <li v-for="(item, index) in duvalReferences.D1" :key="`duval-ref-d1-${index}`">
                  <span class="duval-reference-dot" :style="{ backgroundColor: item[0] }" aria-hidden="true"></span>
                  <span>{{ item[1] }}</span>
                </li>
              </ul>
            </article>

            <article class="duval-diagram-card">
              <div class="duval-image-frame">
                <img
                  v-for="(layer, index) in duvalLayersD4"
                  :key="`duval-d4-${index}`"
                  :src="layer"
                  class="duval-layer-image"
                  alt="Duval Triângulo 4"
                />
              </div>
              <ul class="duval-reference-list">
                <li v-for="(item, index) in duvalReferences.D4" :key="`duval-ref-d4-${index}`">
                  <span class="duval-reference-dot" :style="{ backgroundColor: item[0] }" aria-hidden="true"></span>
                  <span>{{ item[1] }}</span>
                </li>
              </ul>
            </article>

            <article class="duval-diagram-card">
              <div class="duval-image-frame">
                <img
                  v-for="(layer, index) in duvalLayersD5"
                  :key="`duval-d5-${index}`"
                  :src="layer"
                  class="duval-layer-image"
                  alt="Duval Triângulo 5"
                />
              </div>
              <ul class="duval-reference-list">
                <li v-for="(item, index) in duvalReferences.D5" :key="`duval-ref-d5-${index}`">
                  <span class="duval-reference-dot" :style="{ backgroundColor: item[0] }" aria-hidden="true"></span>
                  <span>{{ item[1] }}</span>
                </li>
              </ul>
            </article>
          </div>

          <div v-else class="duval-diagram-grid duval-diagram-grid-pentagons">
            <article class="duval-diagram-card">
              <div class="duval-image-frame">
                <img
                  v-for="(layer, index) in duvalLayersP1"
                  :key="`duval-p1-${index}`"
                  :src="layer"
                  class="duval-layer-image"
                  alt="Duval Pentágono 1"
                />
              </div>
              <ul class="duval-reference-list">
                <li v-for="(item, index) in duvalReferences.P1" :key="`duval-ref-p1-${index}`">
                  <span class="duval-reference-dot" :style="{ backgroundColor: item[0] }" aria-hidden="true"></span>
                  <span>{{ item[1] }}</span>
                </li>
              </ul>
            </article>

            <article class="duval-diagram-card">
              <div class="duval-image-frame">
                <img
                  v-for="(layer, index) in duvalLayersP2"
                  :key="`duval-p2-${index}`"
                  :src="layer"
                  class="duval-layer-image"
                  alt="Duval Pentágono 2"
                />
              </div>
              <ul class="duval-reference-list">
                <li v-for="(item, index) in duvalReferences.P2" :key="`duval-ref-p2-${index}`">
                  <span class="duval-reference-dot" :style="{ backgroundColor: item[0] }" aria-hidden="true"></span>
                  <span>{{ item[1] }}</span>
                </li>
              </ul>
            </article>
          </div>

          <article class="duval-data-card">
            <div class="duval-data-head">
              <h4>Concentração de Gases (ppm)</h4>
              <button type="button" class="history-action-btn small" @click="clearDuvalSelection">
                Limpar Seleção
              </button>
            </div>
            <div class="mini-table-wrap">
              <table class="table compact duval-data-table">
                <thead>
                  <tr>
                    <th class="text-center">Selecionar</th>
                    <th class="text-center">Análises</th>
                    <th class="text-center">C2H2</th>
                    <th class="text-center">C2H4</th>
                    <th class="text-center">CH4</th>
                    <th class="text-center">C2H6</th>
                    <th class="text-center">H2</th>
                    <th class="text-center">Duval 1</th>
                    <th class="text-center">Duval 4</th>
                    <th class="text-center">Duval 5</th>
                    <th class="text-center">Pentágono 1</th>
                    <th class="text-center">Pentágono 2</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in duvalAnalysesRows" :key="row.id">
                    <td class="text-center">
                      <input
                        type="checkbox"
                        :checked="isDuvalManualSelected(row.id)"
                        @change="handleDuvalSelection(row.id, ($event.target as HTMLInputElement).checked)"
                      />
                    </td>
                    <td class="text-center">{{ row.date }}</td>
                    <td class="text-center">{{ row.C2H2 }}</td>
                    <td class="text-center">{{ row.C2H4 }}</td>
                    <td class="text-center">{{ row.CH4 }}</td>
                    <td class="text-center">{{ row.C2H6 }}</td>
                    <td class="text-center">{{ row.H2 }}</td>
                    <td class="text-center">{{ row.AREA_D1 }}</td>
                    <td class="text-center">{{ row.AREA_D4 }}</td>
                    <td class="text-center">{{ row.AREA_D5 }}</td>
                    <td class="text-center">{{ row.AREA_P1 }}</td>
                    <td class="text-center">{{ row.AREA_P2 }}</td>
                  </tr>
                  <tr v-if="!duvalAnalysesRows.length">
                    <td class="text-center" colspan="12">
                      Sem dados de cromatografia para compor a visualização Duval.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </article>
      </section>

      <section v-else-if="activeTab === 'TR Óleo'" class="panel table-panel">
        <article class="tile tile-wide">
          <h4>TR Óleo</h4>
          <p>Módulo em preparação para próxima entrega.</p>
        </article>
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

      <div v-if="advancedFilterModalOpen" class="modal-overlay" @click="closeAdvancedFilterModal">
        <div class="modal-card analysis-modal-card advanced-filter-modal-card" @click.stop>
          <h4>Filtro Avançado</h4>
          <div class="advanced-filter-rules">
            <div
              v-for="(rule, index) in advancedFilterRulesDraft[advancedFilterContext]"
              :key="`advanced-rule-${advancedFilterContext}-${rule.id}`"
              class="advanced-filter-row"
            >
              <select v-if="index > 0" v-model="rule.connector" aria-label="Operador lógico">
                <option value="AND">E</option>
                <option value="OR">OU</option>
              </select>
              <span v-else class="advanced-filter-first">SE</span>
              <select v-model="rule.field" aria-label="Campo do filtro">
                <option
                  v-for="option in activeAdvancedFilterFieldOptions"
                  :key="`advanced-field-${advancedFilterContext}-${option.value}`"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
              <select v-model="rule.operator" aria-label="Operador">
                <option value="=">==</option>
                <option value="!=">!=</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value=">=">&gt;=</option>
                <option value="<=">&lt;=</option>
              </select>
              <select
                v-if="getAdvancedFieldValueOptions(advancedFilterContext, rule.field).length"
                v-model="rule.value"
                aria-label="Valor da expressão"
              >
                <option value="">Selecione</option>
                <option
                  v-for="option in getAdvancedFieldValueOptions(advancedFilterContext, rule.field)"
                  :key="`advanced-value-${advancedFilterContext}-${rule.id}-${option}`"
                  :value="option"
                >
                  {{ option }}
                </option>
              </select>
              <input v-else v-model="rule.value" type="text" placeholder="Valor" aria-label="Valor da expressão" />
              <button type="button" class="advanced-filter-remove-btn" @click="removeAdvancedFilterRule(rule.id)">
                Remover
              </button>
            </div>
          </div>
          <div class="advanced-filter-footer">
            <button type="button" class="history-action-btn small" @click="addAdvancedFilterRule">+ Condição</button>
            <div class="advanced-filter-footer-actions">
              <button type="button" class="history-action-btn small neutral" @click="clearAdvancedFilterDraft">
                Limpar
              </button>
              <button type="button" class="history-action-btn small neutral" @click="closeAdvancedFilterModal">
                Cancelar
              </button>
              <button type="button" class="history-action-btn small" @click="applyAdvancedFilterModal">
                Aplicar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="analysisModalOpen" class="modal-overlay" @click="closeAnalysisModal">
        <div class="modal-card analysis-modal-card" @click.stop>
          <h4>Nova Análise</h4>
          <div class="analysis-modal-tabs">
            <template v-if="analysisRecentTab === 'oltc'">
              <button
                type="button"
                class="analysis-modal-tab-btn"
                :class="{ active: analysisModalTab === 'oltc' }"
                @click="analysisModalTab = 'oltc'"
              >
                OLTC
              </button>
              <button
                type="button"
                class="analysis-modal-tab-btn"
                :class="{ active: analysisModalTab === 'fisicoquimicooltc' }"
                @click="analysisModalTab = 'fisicoquimicooltc'"
              >
                Físico Químico OLTC
              </button>
            </template>
            <template v-else>
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
            </template>
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

          <div v-else-if="analysisModalTab === 'ensaiosespeciais'">
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

          <div v-else-if="analysisModalTab === 'oltc'">
            <p class="analysis-form-title">ENTRADA DE OLTC -TR-OLEO</p>
            <div class="history-switch-wrap history-switch-wrap-top">
              <label class="history-switch">
                <input v-model="analysisSendReport.oltc" type="checkbox" />
                <span class="history-switch-track">
                  <i class="history-switch-thumb"></i>
                </span>
                <b>Enviar Relatorio</b>
              </label>
            </div>
            <div class="analysis-form-grid">
              <label v-for="field in analysisOltcFields" :key="`oltc-${field.key}`">
                <span>{{ field.label }}</span>
                <input
                  v-if="field.key === 'transformador'"
                  v-model="analysisOltcForm[field.key]"
                  type="text"
                  list="analysis-transformers-list"
                />
                <template v-if="field.type === 'select'">
                  <select v-model="analysisOltcForm[field.key]">
                    <option value="">Selecione</option>
                    <option v-for="option in field.options || []" :key="option" :value="option">{{ option }}</option>
                  </select>
                </template>
                <input
                  v-else-if="field.key !== 'transformador'"
                  v-model="analysisOltcForm[field.key]"
                  :type="field.type || 'text'"
                />
                <small v-if="field.hint">{{ field.hint }}</small>
              </label>
            </div>
          </div>

          <div v-else>
            <p class="analysis-form-title">ENTRADA DE FÍSICO QUÍMICO OLTC -TR-OLEO</p>
            <div class="history-switch-wrap history-switch-wrap-top">
              <label class="history-switch">
                <input v-model="analysisSendReport.fisicoquimicooltc" type="checkbox" />
                <span class="history-switch-track">
                  <i class="history-switch-thumb"></i>
                </span>
                <b>Enviar Relatorio</b>
              </label>
            </div>
            <div class="analysis-form-grid">
              <label v-for="field in analysisFisicoOltcFields" :key="`fis-oltc-${field.key}`">
                <span>{{ field.label }}</span>
                <input
                  v-if="field.key === 'transformador'"
                  v-model="analysisFisicoOltcForm[field.key]"
                  type="text"
                  list="analysis-transformers-list"
                />
                <template v-if="field.type === 'select'">
                  <select v-model="analysisFisicoOltcForm[field.key]">
                    <option value="">Selecione</option>
                    <option v-for="option in field.options || []" :key="option" :value="option">{{ option }}</option>
                  </select>
                </template>
                <input
                  v-else-if="field.key !== 'transformador'"
                  v-model="analysisFisicoOltcForm[field.key]"
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

      <div v-if="reportViewerModalOpen" class="report-viewer-overlay" @click.self="closeReportViewerModal">
        <div class="report-viewer-frame">
          <button type="button" class="report-viewer-close" @click="closeReportViewerModal">✕</button>
          <iframe
            v-if="reportViewerModalSrc"
            class="report-viewer-iframe"
            :src="reportViewerModalSrc"
            title="Visualização ampliada do transformador"
            scrolling="no"
          ></iframe>
          <div v-else class="summary-viewer-fallback">Visualização indisponível para este transformador.</div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.report-view{
  min-height: 100vh;
  background: var(--app-bg-gradient);
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
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  align-items: end;
  gap: 16px;
  margin-bottom: 14px;
}

.macro-tabs{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  justify-self: center;
  width: 100%;
}

.macro-tab-btn{
  height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  background: #fff;
  color: rgba(15, 23, 42, 0.78);
  padding: 0 16px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.macro-tab-btn.active{
  border-color: #1e4e8b;
  background: #1e4e8b;
  color: #fff;
  box-shadow: 0 10px 18px rgba(30, 78, 139, 0.22);
}

.report-toolbar-actions{
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-self: end;
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
  position: relative;
}

.selector label{
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(15, 23, 42, 0.55);
}

.transformer-picker-trigger{
  min-width: 340px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: #fff;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: rgba(15, 23, 42, 0.82);
  cursor: pointer;
}

.transformer-picker-trigger-label{
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.transformer-picker-menu{
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 48;
  width: min(420px, 92vw);
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: #fff;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
  padding: 8px;
  display: grid;
  gap: 8px;
}

.transformer-picker-search-wrap{
  padding: 2px;
}

.transformer-picker-search{
  width: 100%;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  padding: 0 10px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.82);
  outline: none;
}

.transformer-picker-search:focus{
  border-color: #1e4e8b;
  box-shadow: 0 0 0 2px rgba(30, 78, 139, 0.14);
}

.transformer-picker-list{
  max-height: 320px;
  overflow: auto;
  display: grid;
  gap: 4px;
  padding-right: 2px;
}

.transformer-picker-group,
.transformer-picker-item{
  width: 100%;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: #fff;
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  text-align: left;
  cursor: pointer;
  color: rgba(15, 23, 42, 0.8);
}

.transformer-picker-group-main{
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
}

.transformer-picker-caret{
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-style: normal;
  font-size: 12px;
  line-height: 1;
}

.transformer-picker-group small,
.transformer-picker-item small{
  font-size: 11px;
  color: rgba(15, 23, 42, 0.55);
}

.transformer-picker-item{
  padding-left: 34px;
}

.transformer-picker-item.active{
  border-color: rgba(30, 78, 139, 0.45);
  background: rgba(30, 78, 139, 0.08);
}

.transformer-picker-group:hover,
.transformer-picker-item:hover{
  background: rgba(15, 23, 42, 0.04);
}

.transformer-picker-group:focus-visible,
.transformer-picker-item:focus-visible{
  outline: 2px solid rgba(30, 78, 139, 0.4);
  outline-offset: 1px;
}

.transformer-picker-empty{
  padding: 10px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.55);
  text-align: center;
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
  min-height: 340px;
}

.summary-card h3,
.summary-card h4{
  margin: 0 0 6px;
}

.summary-title-row{
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.summary-card p{
  margin: 0;
  color: rgba(15, 23, 42, 0.75);
  font-size: 13px;
}

.summary-main-data-title{
  margin-top: 14px !important;
}

.summary-viewer{
  position: relative;
  margin-top: 0;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 12px;
  overflow: hidden;
  background: #ffffff;
  width: 100%;
  height: 100%;
}

.summary-viewer-card .summary-viewer{
  margin-top: 0;
}

.summary-viewer-card{
  padding: 0;
  overflow: hidden;
  min-height: 340px;
}

.summary-media-container{
  position: relative;
  width: 100%;
  height: 100%;
}

.summary-viewer-expand{
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.22);
  background: rgba(255, 255, 255, 0.86);
  color: #0f172a;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.summary-viewer-expand:hover{
  background: #ffffff;
}

.summary-viewer-frame{
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}

.summary-viewer-fallback{
  padding: 16px;
  font-size: 13px;
  color: rgba(15, 23, 42, 0.65);
}

.report-viewer-overlay{
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(2, 6, 23, 0.72);
  backdrop-filter: blur(2px);
  display: grid;
  place-items: center;
  padding: 22px;
}

.report-viewer-frame{
  width: min(1280px, 96vw);
  height: min(92vh, 840px);
  background: #fff;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.16);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25);
  position: relative;
  overflow: hidden;
}

.report-viewer-close{
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.18);
  background: rgba(255, 255, 255, 0.9);
  color: #0f172a;
  cursor: pointer;
}

.report-viewer-iframe{
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
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

.summary-title-row .pill-row{
  margin-top: 0;
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
  background: rgba(0, 255, 0, 0.18);
  color: #0b5f0b;
}

.tone-warning{
  background: rgba(255, 255, 0, 0.22);
  color: #666300;
}

.tone-danger{
  background: rgba(255, 0, 0, 0.18);
  color: #8f0000;
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

.panel-eval .eval-left-stack{
  grid-column: 1;
  grid-row: 1 / span 2;
  display: grid;
  gap: 10px;
  align-content: start;
}

.panel-eval .eval-card-3{
  grid-column: 2;
  grid-row: 1 / span 2;
}

.panel-eval .eval-card-4{
  grid-column: 1 / -1;
  grid-row: 4;
}

.panel-eval .eval-card-5{
  grid-column: 1 / -1;
  grid-row: 3;
}

.panel-eval{
  align-items: start;
}

.panel-eval .tile{
  height: fit-content;
  align-self: start;
}

.panel-eval .eval-card-3{
  height: auto;
  align-self: stretch;
}

.panel-eval .eval-card-5{
  height: auto;
  align-self: stretch;
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

.eval-card-head{
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.eval-card-head h4{
  margin: 0;
}

.eval-card-head-actions{
  margin-bottom: 8px;
}

.eval-card-action-group{
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.eval-collapse-btn{
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid rgba(30, 78, 139, 0.45);
  background: rgba(30, 78, 139, 0.1);
  color: #1e4e8b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
  font-weight: 700;
  cursor: pointer;
}

.eval-collapse-btn:hover{
  background: rgba(30, 78, 139, 0.18);
}

.panel-eval .tile.eval-collapsed{
  padding-top: 10px;
  padding-bottom: 10px;
}

.panel-eval .tile.eval-collapsed .eval-card-head,
.panel-eval .tile.eval-collapsed .eval-card-head-actions{
  margin-bottom: 0;
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

.history-conditions-table{
  margin-top: 0;
}

.history-linear-children{
  display: grid;
  gap: 12px;
  margin-top: 10px;
}

.history-linear-child-card{
  padding: 12px;
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

.duval-screen{
  display: grid;
  gap: 14px;
}

.duval-tabs{
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.duval-tab-btn{
  border: 1px solid rgba(30, 78, 139, 0.28);
  border-radius: 999px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.92);
  color: #1e4e8b;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.duval-tab-btn.active{
  background: #1e4e8b;
  border-color: #1e4e8b;
  color: #ffffff;
}

.duval-diagram-grid{
  display: grid;
  gap: 12px;
}

.duval-diagram-grid-triangles{
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.duval-diagram-grid-pentagons{
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.duval-diagram-card{
  border: 1px solid rgba(30, 78, 139, 0.16);
  border-radius: 12px;
  background: #ffffff;
  padding: 10px;
  display: grid;
  gap: 10px;
}

.duval-image-frame{
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  max-height: 370px;
  border: 1px solid rgba(30, 78, 139, 0.2);
  border-radius: 10px;
  overflow: hidden;
  background: #f8fafc;
}

.duval-layer-image{
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.duval-reference-list{
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.duval-reference-list li{
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 11px;
  color: rgba(15, 23, 42, 0.85);
}

.duval-reference-dot{
  width: 10px;
  height: 10px;
  border-radius: 999px;
  flex: 0 0 auto;
  margin-top: 2px;
}

.duval-data-card{
  border: 1px solid rgba(30, 78, 139, 0.16);
  border-radius: 12px;
  background: #ffffff;
  padding: 10px;
}

.duval-data-head{
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.duval-data-head h4{
  margin: 0;
  font-size: 14px;
  color: #123a6d;
}

.duval-data-table td{
  white-space: nowrap;
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

.risk-grid-shell{
  --risk-label-col: 140px;
  --risk-col-width: 124px;
  --risk-col-gap: 10px;
  width: 100%;
  overflow-x: auto;
}

.risk-pies-aligned{
  grid-template-columns: var(--risk-label-col) repeat(5, minmax(0, 1fr));
  column-gap: var(--risk-col-gap);
  width: 100%;
  min-width: 0;
  margin-bottom: 0;
}

.risk-pies-tab{
  align-self: end;
  justify-self: start;
  width: var(--risk-label-col);
  box-sizing: border-box;
  padding: 6px 12px 7px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-bottom: none;
  border-top-left-radius: 12px;
  border-top-right-radius: 10px;
  background: rgba(15, 23, 42, 0.05);
  font-size: 12px;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.78);
  text-align: center;
  transform: translateY(1px);
}

.risk-pie-card{
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 10px 10px 0 0;
  padding: 10px;
  text-align: center;
  background: rgba(248, 250, 252, 0.65);
}

.risk-pie-card h5{
  text-align: center;
  font-weight: 700;
}

.risk-pie-card h5{
  color: color-mix(in srgb, var(--risk-color-solid, #1e4e8b) 75%, #1f2937 25%);
}

.risk-pie{
  --pct: 0%;
  --risk-color: #1e4e8b;
  width: 88px;
  height: 88px;
  margin: 6px auto 8px;
  border-radius: 999px;
  background: conic-gradient(var(--risk-color) var(--pct), rgba(148, 163, 184, 0.25) 0);
  position: relative;
}

.risk-pie::after{
  content: '';
  position: absolute;
  inset: 14px;
  border-radius: 999px;
  background: #fff;
  z-index: 1;
}

.risk-pie-center{
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  z-index: 2;
  font-size: 12px;
  font-weight: 700;
  color: #123a6d;
}

.risk-heatmap-wrap{
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-top: none;
  border-radius: 0 0 12px 12px;
  background: rgba(248, 250, 252, 0.75);
  overflow: hidden;
  width: 100%;
  min-width: 0;
}

.risk-heatmap-grid{
  display: grid;
  grid-template-columns: var(--risk-label-col) repeat(5, minmax(0, 1fr));
  column-gap: var(--risk-col-gap);
  width: 100%;
  min-width: 0;
}

.risk-heatmap-grid > div{
  border: 1px solid rgba(15, 23, 42, 0.08);
  padding: 8px;
  text-align: center;
  box-sizing: border-box;
}

.risk-heatmap-grid > :nth-child(-n + 6){
  border-top: none;
}

.risk-heatmap-label{
  position: relative;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.78);
  background: rgba(255, 255, 255, 0.88);
  cursor: help;
}

.risk-heatmap-label::after{
  content: attr(data-tooltip);
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translate(8px, -50%);
  background: rgba(15, 23, 42, 0.92);
  color: #fff;
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.25;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
  z-index: 20;
}

.risk-heatmap-label:hover::after{
  opacity: 1;
}

.risk-heatmap-cell{
  min-width: 0;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
}

.risk-heatmap-legend{
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: rgba(15, 23, 42, 0.72);
}

.risk-legend-title{
  font-weight: 700;
  color: rgba(15, 23, 42, 0.78);
}

.risk-legend-scale{
  width: 180px;
  height: 10px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: linear-gradient(90deg, rgba(226, 232, 240, 0.95) 0%, rgba(255, 0, 0, 0.12) 35%, rgba(255, 0, 0, 1) 100%);
}

.risk-legend-stop{
  white-space: nowrap;
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

.advanced-filter-modal-card{
  width: min(980px, 100%);
}

.advanced-filter-rules{
  display: grid;
  gap: 10px;
  max-height: min(56vh, 460px);
  overflow: auto;
  padding-right: 4px;
}

.advanced-filter-row{
  display: grid;
  grid-template-columns: 92px minmax(170px, 1fr) 90px minmax(180px, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.advanced-filter-row select,
.advanced-filter-row input{
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  background: #fff;
  color: rgba(15, 23, 42, 0.82);
  padding: 0 10px;
  font-size: 12px;
}

.advanced-filter-first{
  height: 34px;
  border-radius: 10px;
  border: 1px dashed rgba(15, 23, 42, 0.22);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.65);
}

.advanced-filter-remove-btn{
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(220, 38, 38, 0.35);
  background: rgba(220, 38, 38, 0.08);
  color: #b91c1c;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.advanced-filter-footer{
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.advanced-filter-footer-actions{
  display: inline-flex;
  gap: 8px;
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
  position: relative;
  border: 1px solid #1e4e8b;
  border-radius: 8px;
  background: #1e4e8b;
  color: #fff;
  padding: 8px 44px 8px 12px;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  text-align: center;
}

.expandable-toggle-icon{
  position: absolute;
  right: 10px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  line-height: 1;
  font-weight: 700;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.12);
}

.expandable-head-btn.open{
  border-color: #1e4e8b;
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

.history-analyses-subtabs{
  margin-right: 2px;
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

.history-action-btn.small.neutral{
  background: rgba(15, 23, 42, 0.06);
  color: rgba(15, 23, 42, 0.8);
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

.coletas-period-filter{
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.coletas-period-filter select{
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  padding: 0 10px;
  font-size: 12px;
  background: #fff;
  color: #0f172a;
}

.coletas-period-filter select:focus{
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

.advanced-filter-pill{
  padding-inline: 12px;
  border-radius: 999px;
}

.advanced-filter-pill-icon{
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.26);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.advanced-filter-pill.applied{
  border-color: rgba(22, 163, 74, 0.45);
  color: #166534;
}

.advanced-filter-clear-btn{
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 1px solid #16a34a;
  background: #16a34a;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
}

.advanced-filter-icon-check,
.advanced-filter-icon-remove{
  position: absolute;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  transition: opacity 0.15s ease;
}

.advanced-filter-icon-check{
  opacity: 1;
}

.advanced-filter-icon-remove{
  opacity: 0;
}

.advanced-filter-clear-btn:hover{
  background: #dc2626;
  border-color: #dc2626;
}

.advanced-filter-clear-btn:hover .advanced-filter-icon-check{
  opacity: 0;
}

.advanced-filter-clear-btn:hover .advanced-filter-icon-remove{
  opacity: 1;
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
  .transformer-picker-trigger{
    min-width: 100%;
  }
  .transformer-picker-menu{
    min-width: 100%;
    width: 100%;
  }
  .report-toolbar{
    grid-template-columns: 1fr;
    align-items: stretch;
  }
  .macro-tabs{
    justify-content: flex-start;
    overflow-x: auto;
    padding-bottom: 2px;
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
  .panel-eval .eval-card-5{
    grid-column: auto;
    grid-row: auto;
  }
  .panel-eval .eval-left-stack{
    grid-column: auto;
    grid-row: auto;
  }
  .risk-pies:not(.risk-pies-aligned){
    grid-template-columns: 1fr 1fr;
  }
  .risk-pies-aligned{
    min-width: 760px;
  }
  .risk-heatmap-wrap{
    min-width: 760px;
  }
  .duval-grid{
    grid-template-columns: 1fr;
  }
  .duval-diagram-grid-triangles,
  .duval-diagram-grid-pentagons{
    grid-template-columns: 1fr;
  }
  .duval-image-frame{
    max-height: 320px;
  }
  .duval-tabs{
    width: 100%;
  }
  .duval-tab-btn{
    flex: 1 1 calc(50% - 4px);
    text-align: center;
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
  .advanced-filter-row{
    grid-template-columns: 1fr;
  }
  .modal-grid{
    grid-template-columns: 1fr;
  }
}
</style>
