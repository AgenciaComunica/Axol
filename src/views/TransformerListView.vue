<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import SideMenu from '@/components/SideMenu.vue'
import AppHeader from '@/components/AppHeader.vue'
import transformersData from '@/assets/transformadores.json'

const router = useRouter()
const rawSubstations = (transformersData as any)?.subestacoes || []

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
  status: string
  analystStatus?: string
  power: string
  primaryVoltage?: string
  voltage: string
  year?: string
  manufacturer?: string
  location?: string
}

const transformers = computed<TableTransformer[]>(() => {
  return rawSubstations.flatMap((substation: any) => {
    const name = substation?.NOME || substation?.SUBESTACAO || 'Subestação'
    const reference = substation?.REFERENCIA ? ` • ${substation.REFERENCIA}` : ''
    return (substation?.transformadores || []).map((trafo: any) => ({
      id: trafo?.TAG ? `${trafo.TAG}-${trafo.SERIAL}` : String(trafo?.SERIAL || ''),
      tag: trafo?.TAG,
      serial: trafo?.SERIAL,
      substation: trafo?.SUBESTACAO || name,
      unit: trafo?.UNIDADE,
      status: pickWorstStatus(trafo?.ESTADO, trafo?.ESTADO_ANALISTA),
      analystStatus: trafo?.ESTADO_ANALISTA ? pickWorstStatus(trafo?.ESTADO_ANALISTA) : 'Normal',
      primaryVoltage: trafo?.T_PRIMARIA ? `${trafo.T_PRIMARIA}` : '-',
      power: trafo?.POTENCIA ? `${trafo.POTENCIA} MVA` : '-',
      voltage: trafo?.T_MAIOR ? `${trafo.T_MAIOR} kV` : '-',
      year: trafo?.ANO_FABRICACAO,
      manufacturer: trafo?.FABRICANTE,
      location: `${name}${reference}`,
    }))
  })
})

const orderedTransformers = computed(() => {
  return [...transformers.value].sort((a, b) => {
    const aRank = statusRank[normalizeStatus(a.status)] || 0
    const bRank = statusRank[normalizeStatus(b.status)] || 0
    if (aRank !== bRank) return bRank - aRank
    const aId = `${a.tag || ''}${a.serial || a.id}`
    const bId = `${b.tag || ''}${b.serial || b.id}`
    return aId.localeCompare(bId)
  })
})

const page = ref(1)
const pageSize = 20
const visibleTransformers = computed(() => orderedTransformers.value.slice(0, page.value * pageSize))

const openActionId = ref<string | null>(null)
const exportMenuOpen = ref(false)

function toggleActions(id: string) {
  openActionId.value = openActionId.value === id ? null : id
}

function locateOnMap(transformer: TableTransformer) {
  openActionId.value = null
  router.push({ name: 'dashboard', query: { transformer: transformer.id } })
}

function openReport(transformer: TableTransformer) {
  openActionId.value = null
  router.push({ name: 'transformer-report', params: { id: transformer.id } })
}

function closeActions() {
  openActionId.value = null
  exportMenuOpen.value = false
}

function loadMore() {
  page.value += 1
}

function toggleExportMenu() {
  exportMenuOpen.value = !exportMenuOpen.value
}
</script>

<template>
  <div class="transformer-list">
    <SideMenu />
    <AppHeader
      eyebrow="Gestão de Transformadores"
      title="Transformadores"
      subtitle="Ordenados por risco operacional (sem exposição de score)."
      :action="{ label: 'Voltar ao Painel', onClick: () => router.push({ name: 'dashboard' }) }"
    />

    <section class="table-shell" @mouseleave="closeActions">
      <div class="table-head">
        <span>Listagem completa</span>
        <div class="table-head-right">
          <div class="export-wrap">
            <button type="button" class="ghost-btn export-btn" @click="toggleExportMenu">
              Exportar
            </button>
            <div v-if="exportMenuOpen" class="export-menu">
              <button type="button">Transformadores</button>
              <button type="button">Níveis</button>
              <button type="button">Níveis Variáveis</button>
            </div>
          </div>
          <span class="count">{{ orderedTransformers.length }} itens</span>
        </div>
      </div>

      <div class="table-scroll">
        <table class="transformer-table">
          <thead>
            <tr>
              <th class="text-center">No. Série</th>
              <th class="text-right">Subestacao</th>
              <th class="text-right">Unidade</th>
              <th class="text-right">TAG</th>
              <th class="text-left">T. Primária (kV)</th>
              <th class="text-left">Potencia (kVA)</th>
              <th class="text-center">Status TR-Óleo</th>
              <th class="text-center">Status Analista</th>
              <th class="text-center">N1</th>
              <th class="text-center">N2</th>
              <th class="text-center">N3</th>
              <th class="text-center">N4</th>
              <th class="text-center">N5</th>
              <th class="text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in visibleTransformers" :key="item.id" :class="statusTone(item.status)">
              <td class="text-center">{{ item.serial || '-' }}</td>
              <td class="text-right">{{ item.substation || '-' }}</td>
              <td class="text-right">{{ item.unit || '-' }}</td>
              <td class="text-right">{{ item.tag || '-' }}</td>
              <td class="text-left">{{ item.primaryVoltage || '-' }}</td>
              <td class="text-left">{{ item.power === '-' ? '-' : item.power.replace('MVA', 'kVA') }}</td>
              <td class="text-center">
                <span class="status-pill" :class="statusTone(item.status)">{{ item.status }}</span>
              </td>
              <td class="text-center">
                <span class="status-pill" :class="statusTone(item.analystStatus)">{{ item.analystStatus || '-' }}</span>
              </td>
              <td class="text-center">-</td>
              <td class="text-center">-</td>
              <td class="text-center">-</td>
              <td class="text-center">-</td>
              <td class="text-center">-</td>
              <td class="actions-cell text-center">
                <button class="action-trigger" type="button" @click.stop="toggleActions(item.id)">⋯</button>
                <div v-if="openActionId === item.id" class="action-menu">
                  <button type="button" @click="locateOnMap(item)">Localizar no mapa</button>
                  <button type="button" @click="openReport(item)">Abrir relatório</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="visibleTransformers.length < orderedTransformers.length" class="load-more">
        <button type="button" class="ghost-btn" @click="loadMore">Carregar mais</button>
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
          <button type="button" class="ghost" @click="openReport(item)">Abrir relatório</button>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.transformer-list{
  min-height: 100vh;
  background: radial-gradient(circle at 20% 20%, #f5f7ff 0%, #f8fafc 45%, #ffffff 100%);
  padding: 32px 32px 60px 96px;
  color: #0f172a;
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

.table-head-right{
  display: inline-flex;
  align-items: center;
  gap: 12px;
  position: relative;
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
}

.table-scroll{
  overflow: auto;
  max-height: 70vh;
}

.transformer-table{
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.transformer-table th,
.transformer-table td{
  padding: 12px 10px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  text-align: center;
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
  background: rgba(15, 23, 42, 0.02);
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

.tone-normal{
  background: rgba(30, 78, 139, 0.1);
  color: #1e4e8b;
}

.status-pill.tone-normal{
  color: #16a34a;
}

.tone-warning{
  background: rgba(245, 159, 0, 0.18);
  color: #b45309;
}

.tone-danger{
  background: rgba(220, 38, 38, 0.16);
  color: #b91c1c;
}

.transformer-table tr.tone-warning td:first-child,
.transformer-table tr.tone-danger td:first-child{
  position: relative;
}

.transformer-table tr.tone-warning td:first-child::before,
.transformer-table tr.tone-danger td:first-child::before{
  content: '';
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 3px;
  border-radius: 999px;
}

.transformer-table tr.tone-warning td:first-child::before{ background: #f59f00; }
.transformer-table tr.tone-danger td:first-child::before{ background: #dc2626; }

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

.load-more{
  padding: 12px 6px 6px;
}

.mobile-cards{
  display: none;
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
