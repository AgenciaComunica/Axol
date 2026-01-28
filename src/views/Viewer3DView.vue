<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
const placeholderText = 'Visualização 3D indisponível no momento'

type TrafoPayload = { id?: string; lat?: number; lng?: number; munCode?: string }

const trafoId = ref<string | null>(null)
const munCode = ref<string>('3106200')

const viewerTitle = computed(() =>
  trafoId.value ? `Trafo ${trafoId.value} — Visualização 3D` : 'Visualização 3D'
)

function applyTrafo(payload: TrafoPayload) {
  if (payload.id) trafoId.value = payload.id
  if (payload.munCode) munCode.value = payload.munCode
}

function handleMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin) return
  const data = event.data
  if (!data || typeof data !== 'object') return
  if (data.type === 'SET_TRAFO') {
    applyTrafo(data.payload || {})
  }
}

function closeViewer() {
  window.parent.postMessage({ type: 'CLOSE_VIEWER' }, window.location.origin)
}

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const id = params.get('trafoId')
  const code = params.get('munCode')
  if (id) trafoId.value = id
  if (code) munCode.value = code
  window.addEventListener('message', handleMessage)
  window.parent.postMessage({ type: 'READY' }, window.location.origin)
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage)
})
</script>

<template>
  <div class="viewer">
    <header class="viewer-header">
      <div class="viewer-title">{{ viewerTitle }}</div>
      <button class="viewer-close" type="button" @click="closeViewer">Fechar</button>
    </header>
    <div class="viewer-canvas">
      <div class="viewer-placeholder">{{ placeholderText }}</div>
    </div>
  </div>
</template>

<style scoped>
.viewer{
  min-height: 100vh;
  background: var(--color-surface, #ffffff);
  color: var(--color-text, #0f172a);
  display: grid;
  grid-template-rows: auto 1fr;
}

.viewer-header{
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(10px);
}

.viewer-title{
  font-size: 14px;
  font-weight: 600;
}

.viewer-close{
  border: 1px solid rgba(15, 23, 42, 0.14);
  background: rgba(255,255,255,0.8);
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
}

.viewer-canvas{
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, 0.04);
}

.viewer-placeholder{
  font-size: 14px;
  color: rgba(15, 23, 42, 0.6);
}
</style>
