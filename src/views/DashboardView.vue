<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import SideMenu from '@/components/SideMenu.vue'
import Map3DMock from '@/components/Map3DMock.vue'
import KpiCard from '@/components/KpiCard.vue'
import { usePrototypeScopeStore, type MapItem } from '@/stores/prototypeScope'
import type { StateSelect } from '@/lib/BrazilMap3D'

const store = usePrototypeScopeStore()
const hoverInfo = ref<StateSelect | null>(null)
const pinnedInfo = ref<StateSelect | null>(null)
const pinnedItem = ref<MapItem | null>(null)
const hoverPos = ref({ x: 0, y: 0 })
const pinnedPos = ref<{ x: number; y: number } | null>(null)
const mapShellRef = ref<HTMLElement | null>(null)
const mapShellOffset = ref({ x: 0, y: 0 })
const stateMenuOpen = ref(false)
const cityMenuOpen = ref(false)
const transformerMenuOpen = ref(false)
const municipiosMG = ref<MapItem[]>([])
const setoresIndex = ref<{ cd_mun: string; nm_mun: string; total_setores: number; file?: string }[]>([])
const transformerOptions = ref<
  { id: string; status: string; power: string; voltage: string; oil: string; location: string }[]
>([])
const selectedTransformer = ref<
  { id: string; status: string; power: string; voltage: string; oil: string; location: string } | null
>(null)
const transformerModalOpen = ref(false)
const stateQuery = ref('')
const cityQuery = ref('')
const transformerQuery = ref('')
const stateMenuRef = ref<HTMLElement | null>(null)
const cityMenuRef = ref<HTMLElement | null>(null)
const transformerMenuRef = ref<HTMLElement | null>(null)

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

const valuesByUf: Record<string, number> = {
  AC: 96,
  AL: 112,
  AM: 134,
  AP: 84,
  BA: 178,
  CE: 154,
  DF: 121,
  ES: 118,
  GO: 142,
  MA: 133,
  MG: 204,
  MS: 109,
  MT: 116,
  PA: 165,
  PB: 101,
  PE: 147,
  PI: 97,
  PR: 169,
  RJ: 187,
  RN: 92,
  RO: 88,
  RR: 76,
  RS: 173,
  SC: 161,
  SE: 86,
  SP: 248,
  TO: 103,
}
const totalBrasil = computed(() =>
  Object.values(valuesByUf).reduce((acc, value) => acc + value, 0)
)

const kpis = computed(() => store.getKpisForScope())
const mapDataset = computed(() =>
  store.path.some((node) => node.id === 'MG') ? 'mg' : 'br'
)
const stateNode = computed(() => store.path.find((node) => node.level === 'estado') || null)
const cityNode = computed(() => store.path.find((node) => node.level === 'cidade') || null)
const munCode = computed(() => (stateNode.value?.id === 'MG' ? cityNode.value?.id || null : null))
const munFile = computed(() => {
  if (!munCode.value) return null
  const entry = setoresIndex.value.find((item) => item.cd_mun === munCode.value)
  return entry?.file || null
})
const isTransformerView = computed(() => Boolean(munCode.value))
const filteredStates = computed(() => {
  const q = stateQuery.value.trim().toLowerCase()
  if (!q) return stateOptions
  return stateOptions.filter((state) => state.name.toLowerCase().includes(q))
})
const filteredMunicipios = computed(() => {
  const q = cityQuery.value.trim().toLowerCase()
  if (!q) return municipiosMG.value
  return municipiosMG.value.filter((item) => item.name.toLowerCase().includes(q))
})
const filteredTransformers = computed(() => {
  const q = transformerQuery.value.trim().toLowerCase()
  if (!q) return transformerOptions.value
  return transformerOptions.value.filter((item) => item.id.toLowerCase().includes(q))
})

const mapTitle = computed(() => {
  const label = store.current.label
  switch (store.level) {
    case 'brasil':
      return 'Mapa (mock) — Brasil por regionais'
    case 'regiao':
      return `Mapa (mock) — ${label} por estados`
    case 'estado':
      return `Mapa (mock) — ${label} por cidades`
    case 'cidade':
      return `Mapa (mock) — ${label} por bairros`
    case 'bairro':
      return `Mapa (mock) — ${label}: transformadores`
    default:
      return 'Mapa (mock)'
  }
})

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
  status: string
  power: string
  voltage: string
  oil: string
  location: string
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

function handleMove(payload: { x: number; y: number }) {
  const rect = mapShellRef.value?.getBoundingClientRect()
  if (!rect) return
  hoverPos.value = { x: payload.x - rect.left, y: payload.y - rect.top }
  mapShellOffset.value = { x: rect.left, y: rect.top }
}

const displayInfo = computed(() => pinnedInfo.value ?? hoverInfo.value)
const displayPos = computed(() => pinnedPos.value ?? hoverPos.value)
const mapHoverStyle = computed(() => ({
  left: `${displayPos.value.x + mapShellOffset.value.x + 16}px`,
  top: `${displayPos.value.y + mapShellOffset.value.y - 12}px`,
}))

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

function toggleStateMenu() {
  stateMenuOpen.value = !stateMenuOpen.value
  cityMenuOpen.value = false
  transformerMenuOpen.value = false
}

function toggleCityMenu() {
  cityMenuOpen.value = !cityMenuOpen.value
  stateMenuOpen.value = false
  transformerMenuOpen.value = false
}

function toggleTransformerMenu() {
  transformerMenuOpen.value = !transformerMenuOpen.value
  stateMenuOpen.value = false
  cityMenuOpen.value = false
}

function goBrasil() {
  store.goToLevel(0)
  stateMenuOpen.value = false
  cityMenuOpen.value = false
  transformerMenuOpen.value = false
}

function selectState(state: MapItem) {
  store.jumpToState(state)
  stateMenuOpen.value = false
  cityMenuOpen.value = false
  transformerMenuOpen.value = false
  stateQuery.value = ''
}

function selectMunicipio(municipio: MapItem) {
  store.jumpToCity(municipio)
  cityMenuOpen.value = false
  cityQuery.value = ''
}

function handleOutsideClick(event: MouseEvent) {
  const target = event.target as Node | null
  const stateEl = stateMenuRef.value
  const cityEl = cityMenuRef.value
  const transformerEl = transformerMenuRef.value
  if (stateEl && target && stateEl.contains(target)) return
  if (cityEl && target && cityEl.contains(target)) return
  if (transformerEl && target && transformerEl.contains(target)) return
  stateMenuOpen.value = false
  cityMenuOpen.value = false
  transformerMenuOpen.value = false
}

watch(
  () => stateMenuOpen.value || cityMenuOpen.value || transformerMenuOpen.value,
  (open) => {
    if (open) {
      document.addEventListener('click', handleOutsideClick)
    } else {
      document.removeEventListener('click', handleOutsideClick)
    }
  }
)

onMounted(async () => {
  try {
    const url = new URL('../assets/states/MG_Municipios_2024.geojson', import.meta.url)
    const response = await fetch(url)
    const data = await response.json()
    const list = (data.features || []).map((feature: any) => ({
      id: String(feature.properties?.CD_MUN || ''),
      name: String(feature.properties?.NM_MUN || ''),
      qty: 1,
    }))
    municipiosMG.value = list
      .filter((item) => item.id && item.name)
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    municipiosMG.value = []
  }

  try {
    const urlIndex = new URL('../assets/cities/setores-mg/index.json', import.meta.url)
    const response = await fetch(urlIndex)
    setoresIndex.value = await response.json()
  } catch {
    setoresIndex.value = []
  }

  transformerOptions.value = [
    {
      id: 'TR-0001',
      status: 'Operacional',
      power: '18 MVA',
      voltage: '138 kV',
      oil: 'Adequado',
      location: 'R. Monte Líbano, 121 - Padre Eustáquio, Belo Horizonte - MG, 30730-450',
    },
    {
      id: 'TR-0002',
      status: 'Operacional',
      power: '12 MVA',
      voltage: '69 kV',
      oil: 'Adequado',
      location: 'Praça Bagatelle, 204 - Aeroporto, Belo Horizonte - MG, 31270-705',
    },
    {
      id: 'TR-0003',
      status: 'Manutencao',
      power: '22 MVA',
      voltage: '138 kV',
      oil: 'Reclassificacao',
      location: 'Praça Bagatelle, 204 - Aeroporto, Belo Horizonte - MG, 31270-705',
    },
  ]
})
</script>

<template>
  <div class="prototype">
    <SideMenu />

    <div class="content">
      <div class="brand-header">
        <img src="@/assets/logo-axol.png" alt="Axol" class="brand-logo" />
      </div>
      <header class="topbar">
        <div class="breadcrumbs">
          <button type="button" class="crumb" :class="{ active: !stateNode }" @click="goBrasil">
            Brasil
          </button>
          <div ref="stateMenuRef" class="crumb-select">
            <button type="button" class="crumb crumb-select-trigger" @click="toggleStateMenu">
              {{ stateNode?.label || 'Estado' }}
              <span class="crumb-chev">⌄</span>
            </button>
            <div v-if="stateMenuOpen" class="crumb-menu">
              <input
                v-model="stateQuery"
                class="crumb-search"
                type="search"
                placeholder="Buscar estado"
              />
              <button
                v-for="state in filteredStates"
                :key="state.id"
                type="button"
                class="crumb-menu-item"
                @click="selectState(state)"
              >
                {{ state.name }}
              </button>
            </div>
          </div>
          <div v-if="stateNode && stateNode.id === 'MG'" ref="cityMenuRef" class="crumb-select">
            <button type="button" class="crumb crumb-select-trigger" @click="toggleCityMenu">
              {{ cityNode?.label || 'Municipio' }}
              <span class="crumb-chev">⌄</span>
            </button>
            <div v-if="cityMenuOpen" class="crumb-menu">
              <input
                v-model="cityQuery"
                class="crumb-search"
                type="search"
                placeholder="Buscar municipio"
              />
              <button
                v-for="municipio in filteredMunicipios"
                :key="municipio.id"
                type="button"
                class="crumb-menu-item"
                @click="selectMunicipio(municipio)"
              >
                {{ municipio.name }}
              </button>
            </div>
          </div>
          <div v-if="munCode" ref="transformerMenuRef" class="crumb-select">
            <button type="button" class="crumb crumb-select-trigger" @click="toggleTransformerMenu">
              Transformadores
              <span class="crumb-chev">⌄</span>
            </button>
            <div v-if="transformerMenuOpen" class="crumb-menu">
              <input
                v-model="transformerQuery"
                class="crumb-search"
                type="search"
                placeholder="Buscar transformador"
              />
              <button
                v-for="transformer in filteredTransformers"
                :key="transformer.id"
                type="button"
                class="crumb-menu-item"
                @click="openTransformerModal(transformer)"
              >
                {{ transformer.id }}
              </button>
            </div>
          </div>
        </div>
      </header>

      <section ref="mapShellRef" class="map-shell">
        <KpiCard
          class="kpi kpi-tl"
          :title="stateNode?.label || 'Brasil'"
          value="Estado geral"
          :subtitle="kpis.cards[0].subtitle"
          :rows="kpis.cards[0].rows"
        />
        <KpiCard
          class="kpi kpi-tr"
          :title="kpis.cards[1].title"
          :value="kpis.cards[1].value"
          :subtitle="kpis.cards[1].subtitle"
          :rows="kpis.cards[1].rows"
        />
        <KpiCard
          class="kpi kpi-bl"
          :title="kpis.cards[2].title"
          :value="kpis.cards[2].value"
          :subtitle="kpis.cards[2].subtitle"
          :rows="kpis.cards[2].rows"
        />
        <KpiCard
          class="kpi kpi-br"
          :title="kpis.cards[3].title"
          :value="kpis.cards[3].value"
          :subtitle="kpis.cards[3].subtitle"
          :rows="kpis.cards[3].rows"
        />

        <div class="map-center">
          <div class="map-row">
            <Map3DMock
              :level="store.level"
              :items="store.itemsForCurrentLevel"
              :title="mapTitle"
              :values-by-uf="valuesByUf"
              :dataset="mapDataset"
              :mun-code="munCode"
              :mun-file="munFile"
              @select="handleSelect"
              @marker="handleMarker"
              @hover="handleHover"
              @background="handleBackground"
              @move="handleMove"
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
              <button
                type="button"
                class="map-hover-action"
                @click.stop="openTransformerModal(displayInfo.transformers[0])"
              >
                Ampliar
              </button>
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
          <div class="transformer-modal-placeholder">Iframe aqui</div>
          <iframe title="Transformador 3D" src="about:blank"></iframe>
        </div>
        <div class="transformer-modal-info">
          <h3>{{ selectedTransformer.id }}</h3>
          <div class="transformer-modal-row">
            <span>Status</span>
            <b>{{ selectedTransformer.status }}</b>
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
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prototype{
  min-height: 100vh;
  background: radial-gradient(1200px 800px at 20% 0%, #ffffff 0%, #f4f5f7 48%, #f2f3f5 100%);
  color: #0f172a;
}

.content{
  max-width: 1300px;
  margin: 0 auto;
  padding: 90px 24px 60px;
  display: grid;
  gap: 24px;
}

.brand-header{
  display: flex;
  justify-content: center;
  position: relative;
  z-index: 3;
}

.brand-logo{
  width: 180px;
  height: auto;
  object-fit: contain;
}

.topbar{
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 20px;
  position: relative;
}

.breadcrumbs{
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  z-index: 2;
  position: relative;
}

.crumb-select{
  position: relative;
}

.crumb-select-trigger{
  display: flex;
  align-items: center;
  gap: 6px;
}

.crumb-chev{
  font-size: 10px;
  color: rgba(15, 23, 42, 0.45);
}

.crumb-menu{
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 200px;
  max-height: 260px;
  overflow: auto;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255,255,255,0.98);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.14);
  padding: 6px;
  display: grid;
  gap: 4px;
  z-index: 10;
}

.crumb-search{
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255,255,255,0.9);
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.7);
}

.crumb-search:focus{
  outline: none;
  border-color: rgba(42, 54, 77, 0.4);
  box-shadow: 0 0 0 2px rgba(42, 54, 77, 0.12);
}

.crumb-menu-item{
  border: none;
  background: transparent;
  text-align: left;
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.7);
  cursor: pointer;
}
.crumb-menu-item:hover{
  background: rgba(15, 23, 42, 0.06);
}

.crumb{
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255,255,255,0.8);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.7);
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}
.crumb:hover{ background: rgba(255,255,255,1); transform: translateY(-1px); }
.crumb.active{
  font-weight: 600;
  border-color: rgba(15, 23, 42, 0.14);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
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
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateY(-100%);
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
  background: #2a364d;
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


.kpi{
  position: absolute;
  width: 220px;
  z-index: 3;
}
.kpi-tl{ top: 12px; left: 12px; }
.kpi-tr{ top: 12px; right: 12px; }
.kpi-bl{ bottom: 12px; left: 12px; }
.kpi-br{ bottom: 12px; right: 12px; }

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
  .kpi-tl{ top: 250px; left: 250px; }
  .kpi-tr{ top: 250px; right: 250px; }
  .kpi-bl{ bottom: 250px; left: 250px; }
  .kpi-br{ bottom: 250px; right: 250px; }
  .map-hover{
    position: fixed;
  }
}

@media (max-width: 1100px){
  .map-shell{ padding: 50px 40px; }
  .kpi{ width: 200px; }
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
  position: relative;
}

.transformer-modal-placeholder{
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: rgba(15, 23, 42, 0.55);
  pointer-events: none;
}

.transformer-modal-media iframe{
  width: 100%;
  height: 100%;
  border: none;
  display: block;
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

@media (max-width: 900px){
  .topbar{
    flex-direction: column;
    align-items: flex-start;
    z-index: 8;
  }
  .breadcrumbs{
    width: 100%;
    justify-content: center;
    gap: 6px;
    text-align: center;
    z-index: 8;
  }
  .crumb{
    white-space: nowrap;
  }
  .crumb-menu{
    left: 50%;
    right: auto;
    transform: translateX(-50%);
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
