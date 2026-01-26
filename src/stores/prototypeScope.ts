import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

type Level = 'brasil' | 'regiao' | 'estado' | 'cidade' | 'bairro'
export type MapItem = { id: string; name: string; qty: number; sigla?: string }

type PathNode = { level: Level; label: string; id: string }

type TransformerDetails = {
  id: string
  name: string
  status: string
  power: string
  voltage: string
  oil: string
  location: string
}

const data = {
  brasil: [
    { id: 'N', name: 'Norte', qty: 162 },
    { id: 'NE', name: 'Nordeste', qty: 274 },
    { id: 'CO', name: 'Centro-Oeste', qty: 118 },
    { id: 'SE', name: 'Sudeste', qty: 521 },
    { id: 'S', name: 'Sul', qty: 209 },
  ],
  regiao: {
    SE: [
      { id: 'MG', name: 'Minas Gerais', qty: 198 },
      { id: 'SP', name: 'Sao Paulo', qty: 214 },
      { id: 'RJ', name: 'Rio de Janeiro', qty: 71 },
      { id: 'ES', name: 'Espirito Santo', qty: 38 },
    ],
    NE: [
      { id: 'BA', name: 'Bahia', qty: 88 },
      { id: 'PE', name: 'Pernambuco', qty: 62 },
      { id: 'CE', name: 'Ceara', qty: 54 },
      { id: 'RN', name: 'Rio Grande do Norte', qty: 27 },
    ],
  },
  estado: {
    MG: [
      { id: 'BH', name: 'Belo Horizonte', qty: 46 },
      { id: 'UB', name: 'Uberlandia', qty: 29 },
      { id: 'JF', name: 'Juiz de Fora', qty: 18 },
      { id: 'IP', name: 'Ipatinga', qty: 15 },
    ],
    SP: [
      { id: 'SPC', name: 'Sao Paulo (Capital)', qty: 64 },
      { id: 'CP', name: 'Campinas', qty: 27 },
      { id: 'SJ', name: 'Sao Jose dos Campos', qty: 16 },
      { id: 'SA', name: 'Santos', qty: 12 },
    ],
  },
  cidade: {
    BH: [
      { id: 'CTR', name: 'Centro', qty: 18 },
      { id: 'PAM', name: 'Pampulha', qty: 11 },
      { id: 'BAR', name: 'Barreiro', qty: 9 },
      { id: 'VEN', name: 'Venda Nova', qty: 8 },
    ],
  },
  bairro: {
    CTR: [
      { id: 'TR-00921', name: 'TR-00921', qty: 1 },
      { id: 'TR-01044', name: 'TR-01044', qty: 1 },
      { id: 'TR-01102', name: 'TR-01102', qty: 1 },
      { id: 'TR-01288', name: 'TR-01288', qty: 1 },
    ],
  },
}

const transformerDetails: Record<string, TransformerDetails> = {
  'TR-00921': {
    id: 'TR-00921',
    name: 'Transformador TR-00921',
    status: 'Operacional',
    power: '25 MVA',
    voltage: '138 kV',
    oil: 'Adequado',
    location: 'MG • Belo Horizonte • Centro',
  },
  'TR-01044': {
    id: 'TR-01044',
    name: 'Transformador TR-01044',
    status: 'Manutencao',
    power: '18 MVA',
    voltage: '138 kV',
    oil: 'Reclassificacao',
    location: 'MG • Belo Horizonte • Centro',
  },
  'TR-01102': {
    id: 'TR-01102',
    name: 'Transformador TR-01102',
    status: 'Critico',
    power: '32 MVA',
    voltage: '230 kV',
    oil: 'Regeneracao',
    location: 'MG • Belo Horizonte • Centro',
  },
  'TR-01288': {
    id: 'TR-01288',
    name: 'Transformador TR-01288',
    status: 'Operacional',
    power: '20 MVA',
    voltage: '69 kV',
    oil: 'Adequado',
    location: 'MG • Belo Horizonte • Centro',
  },
}

const nextLevelByLevel: Record<Level, Level | null> = {
  brasil: 'regiao',
  regiao: 'estado',
  estado: 'cidade',
  cidade: 'bairro',
  bairro: null,
}

export const usePrototypeScopeStore = defineStore('prototypeScope', () => {
  const path = ref<PathNode[]>([{ level: 'brasil', label: 'Brasil', id: 'BR' }])
  const selectedTransformer = ref<TransformerDetails | null>(null)

  const current = computed(() => path.value[path.value.length - 1])
  const level = computed(() => current.value.level)

  const itemsForCurrentLevel = computed<MapItem[]>(() => {
    switch (current.value.level) {
      case 'brasil':
        return [...data.brasil]
      case 'regiao':
        return [...((data.regiao as Record<string, MapItem[]>)[current.value.id] || [])]
      case 'estado':
        return [...((data.estado as Record<string, MapItem[]>)[current.value.id] || [])]
      case 'cidade':
        return [...((data.cidade as Record<string, MapItem[]>)[current.value.id] || [])]
      case 'bairro':
        return [...((data.bairro as Record<string, MapItem[]>)[current.value.id] || [])]
      default:
        return []
    }
  })

  function drillDown(item: MapItem) {
    const nextLevel = nextLevelByLevel[current.value.level]
    if (!nextLevel) return
    path.value = [...path.value, { level: nextLevel, label: item.name, id: item.id }]
  }

  function jumpToState(item: MapItem) {
    path.value = [{ level: 'brasil', label: 'Brasil', id: 'BR' }, { level: 'estado', label: item.name, id: item.id }]
  }

  function jumpToCity(item: MapItem) {
    const stateNode = path.value.find((node) => node.level === 'estado')
    if (!stateNode) return
    path.value = [
      { level: 'brasil', label: 'Brasil', id: 'BR' },
      { level: 'estado', label: stateNode.label, id: stateNode.id },
      { level: 'cidade', label: item.name, id: item.id },
    ]
  }

  function goToLevel(index: number) {
    path.value = path.value.slice(0, index + 1)
  }

  function selectTransformer(item: MapItem) {
    selectedTransformer.value =
      transformerDetails[item.id] ||
      ({
        id: item.id,
        name: `Transformador ${item.id}`,
        status: 'Operacional',
        power: '18 MVA',
        voltage: '138 kV',
        oil: 'Adequado',
        location: `${current.value.label}`,
      } as TransformerDetails)
  }

  function clearSelection() {
    selectedTransformer.value = null
  }

  function getKpisForScope() {
    const items = itemsForCurrentLevel.value
    const total = items.reduce((acc, it) => acc + (it.qty || 0), 0)
    const op = Math.max(50, Math.min(85, Math.round(60 + (total % 31))))
    const man = Math.max(8, Math.min(28, Math.round(22 - (total % 7))))
    const crit = Math.max(4, Math.min(20, 100 - op - man))

    return {
      total,
      cards: [
        {
          title: 'Estado geral',
          value: total.toLocaleString('pt-BR'),
          subtitle: 'Total de transformadores',
          rows: [
            { label: 'Operacional', value: `${op}%` },
            { label: 'Manutencao', value: `${man}%` },
            { label: 'Critico', value: `${crit}%` },
          ],
        },
        {
          title: 'Potencia',
          value: `${(15 + (total % 9)).toFixed(1)} MVA`,
          subtitle: 'Media do escopo',
          rows: [
            { label: 'Ate 10 MVA', value: `${Math.max(20, 50 - (total % 22))}%` },
            { label: '10-30 MVA', value: `${Math.min(60, 40 + (total % 18))}%` },
            { label: '30+ MVA', value: `${Math.max(10, 30 - (total % 12))}%` },
          ],
        },
        {
          title: 'Nivel de tensao',
          value: `${120 + (total % 40)} kV`,
          subtitle: 'Media do escopo',
          rows: [
            { label: '69 kV', value: `${Math.max(15, 30 - (total % 9))}%` },
            { label: '138 kV', value: `${Math.min(60, 45 + (total % 12))}%` },
            { label: '230+ kV', value: `${Math.max(10, 25 - (total % 7))}%` },
          ],
        },
        {
          title: 'Tratamento de oleo',
          value: `${Math.max(50, 60 - (total % 12))}% adequado`,
          subtitle: 'Reclassificacao / regeneracao',
          rows: [
            { label: 'Reclassificacao', value: `${Math.max(12, 25 - (total % 10))}%` },
            { label: 'Regeneracao', value: `${Math.max(8, 18 - (total % 6))}%` },
            { label: 'Adequado', value: `${Math.max(50, 60 - (total % 12))}%` },
          ],
        },
      ],
    }
  }

  return {
    path,
    current,
    level,
    itemsForCurrentLevel,
    selectedTransformer,
    drillDown,
    jumpToState,
    jumpToCity,
    goToLevel,
    selectTransformer,
    clearSelection,
    getKpisForScope,
  }
})
