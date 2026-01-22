<script setup lang="ts">
import { computed, ref } from 'vue'
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

function handleMove(payload: { x: number; y: number }) {
  const rect = mapShellRef.value?.getBoundingClientRect()
  if (!rect) return
  hoverPos.value = { x: payload.x - rect.left, y: payload.y - rect.top }
}

const displayInfo = computed(() => pinnedInfo.value ?? hoverInfo.value)
const displayPos = computed(() => pinnedPos.value ?? hoverPos.value)

function handleExpand() {
  if (!pinnedItem.value) return
  store.drillDown(pinnedItem.value)
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
          <button
            v-for="(crumb, index) in store.path"
            :key="crumb.id"
            type="button"
            class="crumb"
            :class="{ active: index === store.path.length - 1 }"
            @click="store.goToLevel(index)"
          >
            {{ crumb.label }}
          </button>
        </div>
      </header>

      <section ref="mapShellRef" class="map-shell">
        <div
          v-if="displayInfo"
          class="map-hover"
          :class="{ pinned: pinnedInfo }"
          :style="{ left: `${displayPos.x + 16}px`, top: `${displayPos.y - 12}px` }"
        >
          <div class="map-hover-head">
            <div>
              <strong>{{ displayInfo.name }} - {{ displayInfo.sigla }}</strong>
            </div>
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
          <button v-if="pinnedInfo" type="button" class="map-hover-action" @click.stop="handleExpand">
            Ampliar
          </button>
        </div>
        <KpiCard
          class="kpi kpi-tl"
          title="Brasil"
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
    display: grid;
    gap: 16px;
  }
  .kpi{
    position: static;
    width: 100%;
  }
  .map-center{ width: 100%; }
  .map-row{ grid-template-columns: 1fr; }
}
</style>
