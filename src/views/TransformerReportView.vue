<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SideMenu from '@/components/SideMenu.vue'
import AppHeader from '@/components/AppHeader.vue'
import transformersData from '@/assets/transformadores.json'
import oltcData from '../../ArquivoExtRef/oltc.json'
import cromatografiasRaw from '../../ArquivoExtRef/cromatografias.json?raw'
import fisicoQuimicosRaw from '../../ArquivoExtRef/fisicoquimicos.json?raw'
import fisicoQuimicosOltcRaw from '../../ArquivoExtRef/fisicoquimicos_oltc.json?raw'

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
  'Avaliação do Especialista',
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

const cromatografiasRows = computed(() => {
  const data = parseLooseJson<BaseRow[]>(cromatografiasRaw)
  return [...data]
    .sort((a, b) => parseBrDate(b.DATA_COLETA) - parseBrDate(a.DATA_COLETA))
    .slice(0, 8)
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

  cromatografiasRows.value.forEach((row) => {
    const time = parseBrDate(row.DATA_COLETA)
    if (!time) return
    add(new Date(time).getFullYear(), 'cromatografias')
  })

  fisicoRows.value.forEach((row) => {
    const time = parseBrDate(row.DATA_COLETA)
    if (!time) return
    add(new Date(time).getFullYear(), 'fisicoQuimicos')
  })

  fisicoOltcRows.value.forEach((row) => {
    const time = parseBrDate(row.DATA_COLETA)
    if (!time) return
    add(new Date(time).getFullYear(), 'fisicoOltc')
  })

  return [...byYear.values()].sort((a, b) => a.year - b.year)
})

const historyMax = computed(() =>
  Math.max(
    1,
    ...historyRows.value.map((row) => Math.max(row.cromatografias, row.fisicoQuimicos, row.fisicoOltc))
  )
)

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

function statusClass(value: string) {
  const text = (value || '').toLowerCase()
  if (text.includes('crit')) return 'tone-danger'
  if (text.includes('alert') || text.includes('alta')) return 'tone-warning'
  if (text.includes('pend')) return 'tone-neutral'
  return 'tone-normal'
}
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

      <section v-if="activeTab === 'Histórico de Análises'" class="panel table-panel">
        <table class="table">
          <thead>
            <tr>
              <th>Ano</th>
              <th>Cromatografias</th>
              <th>Físico-Químicos</th>
              <th>Físico-Químicos OLTC</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in historyRows" :key="row.year">
              <td>{{ row.year }}</td>
              <td>{{ row.cromatografias }}</td>
              <td>{{ row.fisicoQuimicos }}</td>
              <td>{{ row.fisicoOltc }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="historyRows.length" class="history-chart">
          <article v-for="row in historyRows" :key="`chart-${row.year}`" class="history-column">
            <div class="history-bars">
              <div
                class="history-bar history-crom"
                :style="{ height: `${Math.round((row.cromatografias / historyMax) * 100)}%` }"
                :title="`Cromatografias: ${row.cromatografias}`"
              ></div>
              <div
                class="history-bar history-fq"
                :style="{ height: `${Math.round((row.fisicoQuimicos / historyMax) * 100)}%` }"
                :title="`Físico-Químicos: ${row.fisicoQuimicos}`"
              ></div>
              <div
                class="history-bar history-fqoltc"
                :style="{ height: `${Math.round((row.fisicoOltc / historyMax) * 100)}%` }"
                :title="`Físico-Químicos OLTC: ${row.fisicoOltc}`"
              ></div>
            </div>
            <small>{{ row.year }}</small>
          </article>
        </div>
        <div v-if="historyRows.length" class="history-legend">
          <span><i class="history-dot history-crom"></i>Cromatografias</span>
          <span><i class="history-dot history-fq"></i>Físico-Químicos</span>
          <span><i class="history-dot history-fqoltc"></i>Físico-Químicos OLTC</span>
        </div>
        <p v-else class="empty">Sem histórico suficiente para gráfico.</p>
      </section>

      <section v-else-if="activeTab === 'Avaliação Completa'" class="panel">
        <article class="tile">
          <h4>Resumo de risco operacional</h4>
          <p><b>Status TR-Óleo:</b> {{ selectedTransformer?.status || '-' }}</p>
          <p><b>Status Analista:</b> {{ selectedTransformer?.statusAnalyst || '-' }}</p>
          <p><b>Modo de falha:</b> {{ selectedTransformer?.failureMode || '-' }}</p>
          <p><b>Observação do analista:</b> {{ selectedTransformer?.analystNote || '-' }}</p>
        </article>
        <article class="tile">
          <h4>Indicadores rápidos</h4>
          <p><b>Potência:</b> {{ selectedTransformer?.power || '-' }}</p>
          <p><b>Nível de tensão:</b> {{ selectedTransformer?.voltage || '-' }}</p>
          <p><b>Carregamento:</b> {{ selectedTransformer?.load || '-' }}</p>
          <p><b>Tratamento de óleo:</b> {{ selectedTransformer?.treatment || '-' }}</p>
        </article>
      </section>

      <section v-else-if="activeTab === 'Avaliação do Especialista'" class="panel">
        <article class="tile">
          <h4>Checklist do especialista</h4>
          <p><b>Integridade de buchas:</b> Conforme inspeção visual</p>
          <p><b>Condição do comutador:</b> {{ selectedTransformer?.commutator || '-' }}</p>
          <p><b>Histórico de intervenções:</b> Validar registros recentes do ativo</p>
          <p><b>Conclusão técnica:</b> {{ selectedTransformer?.analystNote || 'Sem observações adicionais.' }}</p>
        </article>
        <article class="tile">
          <h4>Ações recomendadas</h4>
          <p>1. Confirmar aderência do plano de coletas para o transformador selecionado.</p>
          <p>2. Revisar sinais de aquecimento e comportamento de carregamento.</p>
          <p>3. Registrar parecer final para encerramento da análise especializada.</p>
        </article>
      </section>

      <section v-else-if="activeTab === 'Avaliação IEEE'" class="panel table-panel">
        <table class="table">
          <thead>
            <tr>
              <th>Critério IEEE</th>
              <th>Descrição</th>
              <th>Situação atual</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Condição do óleo isolante</td>
              <td>Verificação de degradação, umidade e contaminação</td>
              <td>{{ selectedTransformer?.status || '-' }}</td>
            </tr>
            <tr>
              <td>Desempenho térmico</td>
              <td>Avaliação de carga e resposta térmica do ativo</td>
              <td>{{ selectedTransformer?.load || '-' }}</td>
            </tr>
            <tr>
              <td>Sistema de comutação</td>
              <td>Condição operacional do OLTC/comutador</td>
              <td>{{ selectedTransformer?.commutator || '-' }}</td>
            </tr>
            <tr>
              <td>Diagnóstico geral</td>
              <td>Consolidação do risco e recomendação técnica</td>
              <td>{{ selectedTransformer?.statusAnalyst || '-' }}</td>
            </tr>
          </tbody>
        </table>
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
    </section>
  </div>
</template>

<style scoped>
.report-view{
  min-height: 100vh;
  background: radial-gradient(circle at 20% 10%, #f4f7ff 0%, #f8fafc 45%, #ffffff 100%);
  padding: 32px 32px 60px 96px;
  color: #0f172a;
}

.report-shell{
  border-radius: 20px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: #fff;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
  padding: 18px;
}

.report-toolbar{
  display: flex;
  justify-content: space-between;
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

.summary-grid{
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 12px;
  margin-bottom: 14px;
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
  background: #fff;
}

.tile h4{
  margin: 0 0 8px;
}

.tile p{
  margin: 4px 0;
  font-size: 13px;
}

.table{
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.table th,
.table td{
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  padding: 10px 8px;
  text-align: left;
}

.table th{
  color: rgba(15, 23, 42, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
}

.table.compact th,
.table.compact td{
  padding: 8px 6px;
}

.empty{
  margin: 8px 0 0;
  color: rgba(15, 23, 42, 0.65);
}

.history-chart{
  margin-top: 14px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(248, 250, 252, 0.85);
  display: flex;
  align-items: end;
  gap: 14px;
  min-height: 220px;
}

.history-column{
  flex: 1 1 0;
  display: grid;
  gap: 8px;
  justify-items: center;
}

.history-bars{
  width: 100%;
  max-width: 56px;
  height: 170px;
  display: flex;
  align-items: end;
  justify-content: center;
  gap: 5px;
}

.history-bar{
  width: 12px;
  min-height: 2px;
  border-radius: 8px 8px 2px 2px;
}

.history-crom{ background: #2563eb; }
.history-fq{ background: #f59e0b; }
.history-fqoltc{ background: #10b981; }

.history-legend{
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 8px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.75);
}

.history-legend span{
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.history-dot{
  width: 10px;
  height: 10px;
  border-radius: 999px;
}

@media (max-width: 900px) {
  .report-view{
    padding: 90px 16px 40px;
  }
  .selector select{
    min-width: 100%;
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
  .panel.table-panel.split{
    grid-template-columns: 1fr;
  }
  .history-chart{
    overflow-x: auto;
    min-height: 200px;
  }
  .history-column{
    min-width: 54px;
  }
}
</style>
