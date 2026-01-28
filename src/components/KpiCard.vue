<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

type KpiRow = { label: string; value: string }

const props = defineProps<{
  title: string
  value: string
  subtitle: string
  rows: KpiRow[]
  defaultOpen?: boolean
}>()

const open = ref(Boolean(props.defaultOpen))
const bodyRef = ref<HTMLDivElement | null>(null)
const bodyHeight = ref(0)
const isOpen = computed(() => open.value)

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
        <small>{{ subtitle }}</small>
      </div>
      <div class="chev">⌄</div>
    </button>
    <div ref="bodyRef" class="body" :style="bodyStyle">
      <div class="row" v-for="row in rows" :key="row.label">
        <b>{{ row.label }}</b>
        <span>{{ row.value }}</span>
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
  overflow: hidden;
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
  overflow: hidden;
  padding: 0 14px 12px;
  display: grid;
  gap: 8px;
  transition: max-height 0.22s ease, opacity 0.2s ease;
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
}
.row b{ font-weight: 600; }
</style>
