<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import SideMenu from '@/components/SideMenu.vue'
import Map3DMock from '@/components/Map3DMock.vue'
import KpiCard from '@/components/KpiCard.vue'
import { usePrototypeScopeStore, type MapItem } from '@/stores/prototypeScope'

const store = usePrototypeScopeStore()
const hoverInfo = ref<{ name: string; sigla: string; value: number } | null>(null)
const pinnedInfo = ref<{ name: string; sigla: string; value: number } | null>(null)
const pinnedItem = ref<MapItem | null>(null)
const hoverPos = ref({ x: 0, y: 0 })
const pinnedPos = ref<{ x: number; y: number } | null>(null)
const mapShellRef = ref<HTMLElement | null>(null)
const stateMenuOpen = ref(false)
const cityMenuOpen = ref(false)
const municipiosMG = ref<MapItem[]>([])
const setoresIndex = ref<{ cd_mun: string; nm_mun: string; total_setores: number; file?: string }[]>([])
const stateQuery = ref('')
const cityQuery = ref('')
const stateMenuRef = ref<HTMLElement | null>(null)
const cityMenuRef = ref<HTMLElement | null>(null)

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

function handleHover(payload: { name: string; sigla: string; value: number } | null) {
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

function handleMove(payload: { x: number; y: number }) {
  const rect = mapShellRef.value?.getBoundingClientRect()
  if (!rect) return
  hoverPos.value = { x: payload.x - rect.left, y: payload.y - rect.top }
}

const displayInfo = computed(() => pinnedInfo.value ?? hoverInfo.value)
const displayPos = computed(() => pinnedPos.value ?? hoverPos.value)

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
}

function toggleCityMenu() {
  cityMenuOpen.value = !cityMenuOpen.value
  stateMenuOpen.value = false
}

function goBrasil() {
  store.goToLevel(0)
  stateMenuOpen.value = false
  cityMenuOpen.value = false
}

function selectState(state: MapItem) {
  store.jumpToState(state)
  stateMenuOpen.value = false
  cityMenuOpen.value = false
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
  if (stateEl && target && stateEl.contains(target)) return
  if (cityEl && target && cityEl.contains(target)) return
  stateMenuOpen.value = false
  cityMenuOpen.value = false
}

watch(
  () => stateMenuOpen.value || cityMenuOpen.value,
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
        </div>
      </header>

      <section ref="mapShellRef" class="map-shell">
        <div
          v-if="displayInfo && !munCode"
          class="map-hover"
          :class="{ pinned: pinnedInfo }"
          :style="{ left: `${displayPos.x + 16}px`, top: `${displayPos.y - 12}px` }"
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
          <template v-if="isTransformerView && pinnedInfo">
            <div class="map-hover-transformer">
              <div class="map-hover-iframe">
                <iframe title="Transformador 3D" src="about:blank"></iframe>
              </div>
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
              :transformers-count="0"
              @select="handleSelect"
              @hover="handleHover"
              @background="handleBackground"
              @move="handleMove"
            />
          </div>
        </div>
      </section>
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
}

.breadcrumbs{
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
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
  z-index: 0;
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
  z-index: 4;
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

@media (max-width: 1100px){
  .map-shell{ padding: 50px 40px; }
  .kpi{ width: 200px; }
}

@media (max-width: 900px){
  .topbar{ flex-direction: column; align-items: flex-start; }
  .map-shell{
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
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
    position: static;
    transform: none;
    margin: 0 auto 6px;
    max-width: min(320px, 90vw);
  }
  .map-hover-transformer{
    grid-template-columns: 1fr;
  }
}
</style>
