<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

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
const chartStyle = computed(() => {
  if (!props.chart?.segments?.length) return {}
  const total = props.chart.segments.reduce((acc, seg) => acc + seg.value, 0) || 1
  let acc = 0
  const stops = props.chart.segments.map((seg) => {
    const start = (acc / total) * 100
    acc += seg.value
    const end = (acc / total) * 100
    return `${seg.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`
  })
  return { background: `conic-gradient(${stops.join(', ')})` }
})

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
        <div class="chart-pie" :style="chartStyle"></div>
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
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.1);
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
.title small.tone-success{ color: rgba(21, 128, 61, 0.95); }
.title small.tone-warning{ color: rgba(161, 98, 7, 0.95); }
.title small.tone-danger{ color: rgba(185, 28, 28, 0.95); }
.title small.tone-info{ color: rgba(37, 99, 235, 0.95); }

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
  background: conic-gradient(#e2e8f0 0% 100%);
  border: 1px solid rgba(15, 23, 42, 0.08);
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
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: #f5f6f8;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.7);
  position: relative;
}

.row.tone-success{
  border-color: rgba(22, 163, 74, 0.25);
  background: rgba(22, 163, 74, 0.12);
  color: rgba(21, 128, 61, 0.95);
}

.row.tone-warning{
  border-color: rgba(234, 179, 8, 0.3);
  background: rgba(234, 179, 8, 0.14);
  color: rgba(161, 98, 7, 0.95);
}

.row.tone-danger{
  border-color: rgba(239, 68, 68, 0.25);
  background: rgba(239, 68, 68, 0.12);
  color: rgba(185, 28, 28, 0.95);
}

.row.tone-info{
  border-color: rgba(59, 130, 246, 0.2);
  background: rgba(59, 130, 246, 0.12);
  color: rgba(37, 99, 235, 0.95);
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
  background: rgba(22, 163, 74, 0.18);
  border-color: rgba(22, 163, 74, 0.35);
  color: rgba(21, 128, 61, 0.95);
}

.row-tag.tone-warning{
  background: rgba(234, 179, 8, 0.2);
  border-color: rgba(234, 179, 8, 0.4);
  color: rgba(161, 98, 7, 0.95);
}

.row-tag.tone-danger{
  background: rgba(239, 68, 68, 0.18);
  border-color: rgba(239, 68, 68, 0.35);
  color: rgba(185, 28, 28, 0.95);
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
  background: rgba(22, 163, 74, 0.18);
  color: rgba(21, 128, 61, 0.95);
}

.row-hover-cell-head.tone-warning{
  background: rgba(234, 179, 8, 0.2);
  color: rgba(161, 98, 7, 0.95);
}

.row-hover-cell-head.tone-danger{
  background: rgba(239, 68, 68, 0.18);
  color: rgba(185, 28, 28, 0.95);
}
.row b{ font-weight: 600; }
</style>
