<script setup lang="ts">
import { computed, ref } from 'vue'
import SideMenu from '@/components/SideMenu.vue'
import Map3DMock from '@/components/Map3DMock.vue'
import KpiCard from '@/components/KpiCard.vue'
import TransformerModal from '@/components/TransformerModal.vue'
import { usePrototypeScopeStore, type MapItem } from '@/stores/prototypeScope'

const store = usePrototypeScopeStore()
const modalOpen = ref(false)
const hoverInfo = ref<{ name: string; sigla: string; value: number } | null>(null)

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
  if (store.level === 'bairro') {
    store.selectTransformer(item)
    modalOpen.value = true
    return
  }
  store.drillDown(item)
}

function closeModal() {
  modalOpen.value = false
  store.clearSelection()
}

function handleHover(payload: { name: string; sigla: string; value: number } | null) {
  hoverInfo.value = payload
}
</script>

<template>
  <div class="prototype">
    <SideMenu />

    <div class="content">
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

      <section class="map-shell">
        <div v-if="hoverInfo" class="map-hover">
          <strong>{{ hoverInfo.name }}</strong>
          <span class="map-hover-value">{{ hoverInfo.value.toLocaleString('pt-BR') }}</span>
          <small>{{ hoverInfo.sigla }}</small>
        </div>
        <KpiCard
          class="kpi kpi-tl"
          :title="kpis.cards[0].title"
          :value="kpis.cards[0].value"
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
              @select="handleSelect"
              @hover="handleHover"
            />
            <aside class="map-panel">
              <strong>{{ hoverInfo?.name || 'Brasil' }}</strong>
              <span class="map-panel-value">{{
                hoverInfo ? hoverInfo.value.toLocaleString('pt-BR') : totalBrasil.toLocaleString('pt-BR')
              }}</span>
              <small>Transformadores</small>
            </aside>
          </div>
        </div>
      </section>
    </div>

    <TransformerModal :open="modalOpen" :transformer="store.selectedTransformer" @close="closeModal" />
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
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 16px;
  align-items: center;
}

.map-hover{
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  min-width: 190px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255,255,255,0.96);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.18);
  display: grid;
  gap: 4px;
  text-align: center;
  pointer-events: none;
  z-index: 4;
}

.map-hover strong{
  font-size: 13px;
  color: rgba(15, 23, 42, 0.78);
}

.map-hover-value{
  font-size: 20px;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.95);
}

.map-hover small{
  font-size: 11px;
  color: rgba(15, 23, 42, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.map-panel{
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255,255,255,0.9);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
  padding: 16px;
  display: grid;
  gap: 6px;
  text-align: left;
}

.map-panel strong{
  font-size: 13px;
  color: rgba(15, 23, 42, 0.75);
}

.map-panel-value{
  font-size: 26px;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.9);
}

.map-panel small{
  font-size: 12px;
  color: rgba(15, 23, 42, 0.55);
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
