<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import trafoPlaceholder from '@/assets/Trafo_3D.svg'
import siaroLogo from '@/assets/logo_siaro.png'
const placeholderText = 'Visualização 3D indisponível no momento'

type TrafoPayload = { id?: string; lat?: number; lng?: number; munCode?: string }

const trafoId = ref<string | null>(null)
const munCode = ref<string>('3106200')
const isEmbed = ref(false)
const showWatermark = ref(false)

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
  isEmbed.value = params.get('embed') === '1'
  showWatermark.value = params.get('watermark') === '1'
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
  <div class="viewer" :class="{ embed: isEmbed }">
    <header v-if="!isEmbed" class="viewer-header">
      <div class="viewer-title">{{ viewerTitle }}</div>
      <button class="viewer-close" type="button" @click="closeViewer">Fechar</button>
    </header>
    <div class="viewer-canvas">
      <img class="viewer-placeholder-image" :src="trafoPlaceholder" alt="Transformador 3D" />
      <img v-if="showWatermark" class="viewer-watermark" :src="siaroLogo" alt="Siaro" />
      <div class="viewer-placeholder">{{ placeholderText }}</div>
    </div>
  </div>
</template>

<style scoped>
:global(html),
:global(body),
:global(#app){
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.viewer{
  min-height: 100%;
  height: 100%;
  width: 100%;
  background: var(--color-surface, #ffffff);
  color: var(--color-text, #0f172a);
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
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
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, 0.04);
  gap: 10px;
  padding: 20px;
}

.viewer-placeholder-image{
  width: min(680px, 92%);
  height: auto;
  object-fit: contain;
}

.viewer-placeholder{
  font-size: 14px;
  color: rgba(15, 23, 42, 0.6);
}

.viewer-watermark{
  position: absolute;
  right: 24px;
  bottom: 24px;
  width: 120px;
  height: auto;
  opacity: 0.35;
  pointer-events: none;
}

.viewer.embed{
  min-height: 100%;
  height: 100%;
  width: 100%;
  display: block;
  grid-template-rows: 1fr;
}

.viewer.embed .viewer-canvas{
  position: relative;
  width: 100%;
  height: 100%;
  padding: 0;
  gap: 0;
  overflow: hidden;
}

.viewer.embed .viewer-placeholder-image{
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  object-fit: contain;
}

.viewer.embed .viewer-placeholder{
  display: none;
}
</style>
