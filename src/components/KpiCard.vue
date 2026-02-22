<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import type { ApexOptions } from 'apexcharts'

type KpiRow = {
  label: string
  value: string
  tone?: 'success' | 'warning' | 'danger' | 'info'
  tags?: { tone: 'success' | 'warning' | 'danger'; value: string }[]
  hover?: { columns: string[]; values: string[]; tones?: ('success' | 'warning' | 'danger')[] }
}

const props = defineProps<{
  title: string
  value: string
  subtitle: string
  rows: KpiRow[]
  defaultOpen?: boolean
  subtitleTone?: 'success' | 'warning' | 'danger' | 'info'
  chart?: {
    segments: { label: string; value: number; color: string }[]
  }
}>()

const open = ref(props.defaultOpen ?? true)
const bodyRef = ref<HTMLDivElement | null>(null)
const bodyHeight = ref(0)
const isOpen = computed(() => open.value)
const chartSeries = computed(() => props.chart?.segments?.map((segment) => segment.value) || [])
const chartOptions = computed<ApexOptions>(() => ({
  chart: {
    type: 'donut',
    sparkline: { enabled: true },
    animations: { enabled: false },
    toolbar: { show: false },
    parentHeightOffset: 0,
  },
  labels: props.chart?.segments?.map((segment) => segment.label) || [],
  colors: props.chart?.segments?.map((segment) => segment.color) || [],
  dataLabels: { enabled: false },
  legend: { show: false },
  tooltip: { enabled: false },
  states: {
    hover: { filter: { type: 'none', value: 0 } },
    active: { filter: { type: 'none', value: 0 } },
  },
  stroke: {
    width: 1,
    colors: ['#ffffff'],
  },
  plotOptions: {
    pie: {
      donut: {
        size: '62%',
      },
    },
  },
}))

const bodyStyle = computed(() => ({
  maxHeight: isOpen.value ? `${bodyHeight.value}px` : '0px',
  opacity: isOpen.value ? '1' : '0',
}))

function toggleOpen() {
  open.value = !open.value
}

async function syncHeight() {
  await nextTick()
  bodyHeight.value = bodyRef.value?.scrollHeight || 0
}

watch(
  () => props.rows,
  () => {
    syncHeight()
  },
  { deep: true }
)

watch(open, () => {
  syncHeight()
})

onMounted(() => {
  syncHeight()
})
</script>

<template>
  <div class="card" :class="{ open: isOpen }">
    <button class="header" type="button" @pointerdown.stop @click.stop="toggleOpen">
      <div class="title">
        <strong>{{ title }}</strong>
        <span>{{ value }}</span>
        <small :class="subtitleTone ? `tone-${subtitleTone}` : ''">{{ subtitle }}</small>
      </div>
      <div class="chev">⌄</div>
    </button>
    <div ref="bodyRef" class="body" :style="bodyStyle">
      <div v-if="chart?.segments?.length" class="chart-block">
        <div class="chart-pie">
          <VueApexCharts type="donut" width="56" height="56" :options="chartOptions" :series="chartSeries" />
        </div>
        <div class="chart-legend">
          <div v-for="segment in chart.segments" :key="segment.label" class="chart-legend-item">
            <span class="chart-dot" :style="{ background: segment.color }"></span>
            <span>{{ segment.label }}</span>
            <b>{{ segment.value.toFixed(0) }}%</b>
          </div>
        </div>
      </div>
      <div class="row" :class="row.tone ? `tone-${row.tone}` : ''" v-for="row in rows" :key="row.label">
        <b>{{ row.label }}</b>
        <span v-if="!row.tags?.length">{{ row.value }}</span>
        <div v-else class="row-tags">
          <span
            v-for="tag in row.tags"
            :key="`${row.label}-${tag.tone}`"
            class="row-tag"
            :class="`tone-${tag.tone}`"
          >
            {{ tag.value }}
          </span>
        </div>
        <div v-if="row.hover" class="row-hover">
          <div class="row-hover-head">
            <span>{{ row.label }}</span>
          </div>
          <div class="row-hover-grid">
          <div
            v-for="(column, index) in row.hover.columns"
            :key="column"
            class="row-hover-cell row-hover-cell-head"
            :class="row.hover.tones?.[index] ? `tone-${row.hover.tones[index]}` : ''"
          >
            {{ column }}
          </div>
            <div
              v-for="(value, index) in row.hover.values"
              :key="`${row.label}-hover-${index}`"
              class="row-hover-cell"
            >
              {{ value }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card{
  border-radius: 18px;
  border: 1px solid rgba(59, 130, 246, 0.45);
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.2);
  overflow: visible;
}
.card.open{
  padding-bottom: 20px;
}

.header{
  width: 100%;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  text-align: left;
  pointer-events: auto;
  touch-action: manipulation;
}

.title{
  display: grid;
  gap: 2px;
}

.title strong{ font-size: 12px; color: rgba(15, 23, 42, 0.65); }
.title span{ font-size: 20px; color: rgba(15, 23, 42, 0.9); letter-spacing: 0.2px; }
.title small{ font-size: 12px; color: rgba(15, 23, 42, 0.45); }
.title small.tone-success{ color: #15803d; }
.title small.tone-warning{ color: #a16207; }
.title small.tone-danger{ color: #b91c1c; }
.title small.tone-info{ color: #1d4ed8; }

.chev{
  width: 26px;
  height: 26px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(15, 23, 42, 0.03);
  display: grid;
  place-items: center;
  color: rgba(15, 23, 42, 0.7);
  transition: transform 0.18s ease;
}
.card.open .chev{ transform: rotate(180deg); }

.body{
  overflow: visible;
  padding: 0 14px 40px;
  display: grid;
  gap: 8px;
  transition: max-height 0.22s ease, opacity 0.2s ease;
}
.card:not(.open) .body{
  pointer-events: none;
}

.chart-block{
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 12px;
  align-items: center;
  padding: 4px 0 8px;
}

.chart-pie{
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 1px solid rgba(132, 152, 171, 0.35);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.92);
}

.chart-pie :deep(.apexcharts-canvas){
  width: 56px !important;
  height: 56px !important;
}

.chart-pie :deep(svg){
  display: block;
}

.chart-legend{
  display: grid;
  gap: 6px;
  font-size: 11px;
  color: rgba(15, 23, 42, 0.7);
}

.chart-legend-item{
  display: flex;
  align-items: center;
  gap: 6px;
}

.chart-legend-item b{
  margin-left: auto;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.9);
}

.chart-dot{
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.row{
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(132, 152, 171, 0.28);
  background: rgba(255, 255, 255, 0.84);
  font-size: 12px;
  color: rgba(15, 23, 42, 0.7);
  position: relative;
}

.row.tone-success{
  border-color: #4ade80;
  background: #86efac;
  color: #14532d;
}

.row.tone-warning{
  border-color: #facc15;
  background: #fde68a;
  color: #78350f;
}

.row.tone-danger{
  border-color: #f87171;
  background: #fca5a5;
  color: #7f1d1d;
}

.row.tone-info{
  border-color: #60a5fa;
  background: #93c5fd;
  color: #1e3a8a;
}

.row-tags{
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.row-tag{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: #0f172a;
  background: #e2e8f0;
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.row-tag.tone-success{
  background: #86efac;
  border-color: #4ade80;
  color: #14532d;
}

.row-tag.tone-warning{
  background: #fde68a;
  border-color: #facc15;
  color: #78350f;
}

.row-tag.tone-danger{
  background: #fca5a5;
  border-color: #f87171;
  color: #7f1d1d;
}

.row-hover{
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 220px;
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.12);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.15);
  border-radius: 12px;
  padding: 10px 12px;
  display: none;
  z-index: 200;
}

.row:hover .row-hover{
  display: block;
}

.row-hover-head{
  font-size: 12px;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.85);
  margin-bottom: 8px;
}

.row-hover-grid{
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  font-size: 11px;
  color: rgba(15, 23, 42, 0.7);
}

.row-hover-cell{
  padding: 4px 6px;
  border-radius: 8px;
  background: #f5f6f8;
  text-align: center;
}

.row-hover-cell-head{
  font-weight: 600;
  color: rgba(15, 23, 42, 0.85);
  background: rgba(15, 23, 42, 0.06);
}

.row-hover-cell-head.tone-success{
  background: #86efac;
  color: #14532d;
}

.row-hover-cell-head.tone-warning{
  background: #fde68a;
  color: #78350f;
}

.row-hover-cell-head.tone-danger{
  background: #fca5a5;
  color: #7f1d1d;
}
.row b{ font-weight: 600; }
</style>
