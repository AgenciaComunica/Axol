<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import transformersData from '@/assets/transformadores.json'

const open = ref(false)
const router = useRouter()
const configOpen = ref(false)
const transformerOpen = ref(false)

const firstTransformerId = (() => {
  const firstSubstation = (transformersData as any)?.subestacoes?.[0]
  const firstTransformer = firstSubstation?.transformadores?.[0]
  if (!firstTransformer) return ''
  return `${String(firstTransformer.TAG || '')}-${String(firstTransformer.SERIAL || '')}`
})()

function toggleMenu() {
  open.value = !open.value
}

function toggleConfig() {
  configOpen.value = !configOpen.value
}

function toggleTransformers() {
  transformerOpen.value = !transformerOpen.value
}

function goToTransformers() {
  router.push({ name: 'transformer-list' })
  open.value = false
}

function goToDashboard() {
  router.push({ name: 'dashboard' })
  open.value = false
}

function goToReport(section: string) {
  if (!firstTransformerId) return
  router.push({
    name: 'transformer-report',
    params: { id: firstTransformerId },
    query: { section },
  })
  open.value = false
}

function goToAnalisesView() {
  router.push({ name: 'analises-view' })
  open.value = false
}

function goToTratamentoOleoView() {
  router.push({ name: 'tratamento-oleo-view' })
  open.value = false
}

function updateBodyLock(isOpen: boolean) {
  if (typeof window === 'undefined') return
  if (window.innerWidth > 900) return
  document.body.classList.toggle('menu-open', isOpen)
}

watch(open, (isOpen) => {
  updateBodyLock(isOpen)
})

onBeforeUnmount(() => {
  document.body.classList.remove('menu-open')
})
</script>

<template>
  <div class="side-menu">
    <div class="menu-backdrop" :class="{ open }" @click="toggleMenu"></div>
    <button class="menu-btn" :class="{ open }" type="button" @click="toggleMenu">
      <div v-if="!open" class="hamburger" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span v-else class="menu-text">MENU</span>
    </button>

    <div class="dropdown" :class="{ open }">
      <div class="mobile-menu-head">
        <img class="mobile-menu-logo" src="@/assets/logo_siaro.png" alt="Siaro" />
        <button class="mobile-menu-close" type="button" @click="toggleMenu">✕</button>
      </div>
      <button class="item" type="button" @click="goToDashboard">
        <svg class="item-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.5 3.5a1 1 0 0 0-.95-.07L15 5.1 9 3 3.45 4.84A1 1 0 0 0 3 5.78v13.72a1 1 0 0 0 1.32.95L9 18.9l6 2.1 5.55-1.84a1 1 0 0 0 .95-.95V4.5a1 1 0 0 0-1-1zM10 5.47l4 1.4v11.06l-4-1.4V5.47zm-5 1.38 3-1v11.68l-3 1V6.85zm14 12.3-3 1V7.13l3-1v13.02z"></path>
        </svg>
        Painel
      </button>
      <div class="item static">
        <svg class="item-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.5c2.7 3.1 6.5 7.8 6.5 11.1a6.5 6.5 0 1 1-13 0C5.5 10.3 9.3 5.6 12 2.5zm0 4.7c-1.8 2.3-4 5.4-4 6.9a4 4 0 0 0 8 0c0-1.5-2.2-4.6-4-6.9z"></path>
        </svg>
        Start Oleo
      </div>
      <button class="item item-with-submenu" :class="{ open: transformerOpen }" type="button" @click="toggleTransformers">
        <div class="item-label">
          <span class="item-link">
            <svg class="item-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16v2H4V7zm2 4h12v2H6v-2zm-2 4h16v2H4v-2z"></path>
            </svg>
            Operações
          </span>
          <span class="submenu-chevron" :class="{ open: transformerOpen }">{{ transformerOpen ? '−' : '+' }}</span>
        </div>
        <div v-if="transformerOpen" class="submenu">
          <button class="submenu-item" type="button" @click.stop="goToTransformers">
            <svg class="submenu-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 10h18v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8zm2-5h14l2 3H3l2-3zm2 13h3v2H7v-2zm7 0h3v2h-3v-2z"></path>
            </svg>
            Transformadores
          </button>
          <button class="submenu-item" type="button" @click.stop="goToReport('Avaliação Completa')">
            <svg class="submenu-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 3h10l4 4v14H5V3zm9 1.5V8h3.5L14 4.5zM8 11h8v2H8v-2zm0 4h8v2H8v-2z"></path>
            </svg>
            Relatórios
          </button>
          <button class="submenu-item" type="button" @click.stop="goToAnalisesView">
            <svg class="submenu-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 5h18v2H3V5zm0 6h12v2H3v-2zm0 6h18v2H3v-2zm14-6h4v8h-4v-8z"></path>
            </svg>
            Análises
          </button>
          <button class="submenu-item" type="button" @click.stop="goToTratamentoOleoView">
            <svg class="submenu-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.5c2.7 3.1 6.5 7.8 6.5 11.1a6.5 6.5 0 1 1-13 0C5.5 10.3 9.3 5.6 12 2.5zm0 4.7c-1.8 2.3-4 5.4-4 6.9a4 4 0 0 0 8 0c0-1.5-2.2-4.6-4-6.9z"></path>
            </svg>
            Tratamento Óleo
          </button>
        </div>
      </button>
      <button class="item item-with-submenu" :class="{ open: configOpen }" type="button" @click="toggleConfig">
        <div class="item-label">
          <svg class="item-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19.4 13a7.8 7.8 0 0 0 .1-2l2-1.5-2-3.4-2.3.8a7.6 7.6 0 0 0-1.7-1L15 2h-4l-.5 3a7.6 7.6 0 0 0-1.7 1l-2.3-.8-2 3.4L6.6 11a7.8 7.8 0 0 0 .1 2l-2 1.5 2 3.4 2.3-.8a7.6 7.6 0 0 0 1.7 1l.5 3h4l.5-3a7.6 7.6 0 0 0 1.7-1l2.3.8 2-3.4-2-1.5zM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"></path>
          </svg>
          Configurações
          <span class="submenu-chevron" :class="{ open: configOpen }">{{ configOpen ? '−' : '+' }}</span>
        </div>
        <div v-if="configOpen" class="submenu">
          <div class="submenu-item">
            <svg class="submenu-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16v12H4V6zm4 3h8v2H8V9zm0 4h8v2H8v-2z"></path>
            </svg>
            Empresas
          </div>
          <div class="submenu-item">
            <svg class="submenu-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-7 8a7 7 0 0 1 14 0H5z"></path>
            </svg>
            Usuários
          </div>
          <div class="submenu-item">
            <svg class="submenu-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 10a3 3 0 1 1 3-3 3 3 0 0 1-3 3zm10 0a3 3 0 1 1 3-3 3 3 0 0 1-3 3zM2 20a5 5 0 0 1 10 0H2zm10 0a5 5 0 0 1 10 0H12z"></path>
            </svg>
            Grupos
          </div>
          <div class="submenu-item">
            <svg class="submenu-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2 3 6v6c0 5 3.6 9.7 9 10 5.4-.3 9-5 9-10V6l-9-4zm-1 6h2v7h-2V8zm0 9h2v2h-2v-2z"></path>
            </svg>
            Permissões
          </div>
          <div class="submenu-item">
            <svg class="submenu-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 5h16v14H4V5zm3 3h10v2H7V8zm0 4h10v2H7v-2z"></path>
            </svg>
            Logs do sistema
          </div>
        </div>
      </button>
      <button class="item item-danger" type="button">
        <svg class="item-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 17v-3H4v-4h6V7l5 5-5 5zm2-13h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6v-2h6V6h-6V4z"></path>
        </svg>
        Sair
      </button>
    </div>
  </div>
</template>

<style scoped>
.side-menu{
  position: fixed;
  top: 24px;
  left: 24px;
  z-index: 30;
  pointer-events: none;
}

.menu-btn,
.dropdown,
.menu-backdrop{
  pointer-events: auto;
}

.menu-btn{
  width: 56px;
  height: 56px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  background: rgba(255,255,255,0.65);
  backdrop-filter: blur(10px);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: width 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
  overflow: hidden;
}
.menu-btn:hover{ transform: translateY(-1px); box-shadow: 0 16px 34px rgba(15, 23, 42, 0.16); }
.menu-btn.open{ width: 96px; }

.hamburger{ width: 22px; height: 14px; display: grid; gap: 4px; }
.hamburger span{ height: 2px; border-radius: 999px; background: rgba(15, 23, 42, 0.7); }

.menu-text{
  font-size: 11px;
  letter-spacing: 0.25em;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.7);
}

.dropdown{
  margin-top: 12px;
  width: 220px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.12);
  padding: 8px;
  display: grid;
  gap: 6px;
  transform-origin: top left;
  transform: translateY(-10px) scale(0.98);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.dropdown.open{
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.item{
  appearance: none;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: rgba(15, 23, 42, 0.03);
  cursor: pointer;
  font-size: 13px;
  color: rgba(15, 23, 42, 0.82);
  transition: background 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.item.static{
  cursor: default;
}
.item:hover{ background: rgba(15, 23, 42, 0.06); border-color: rgba(15, 23, 42, 0.08); transform: translateY(-1px); }

.item-danger{
  color: #dc2626;
}

.item-danger:hover{
  background: rgba(220, 38, 38, 0.1);
  border-color: rgba(220, 38, 38, 0.2);
}

.item-heading{
  font-size: 12px;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.65);
  padding: 10px 12px 4px;
}

.item-with-submenu{
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  background: rgba(15, 23, 42, 0.02);
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.item-with-submenu.open{
  background: #ffffff;
  border-color: rgba(15, 23, 42, 0.1);
}

.item-with-submenu.open:hover{
  background: #ffffff;
  border-color: rgba(15, 23, 42, 0.1);
  transform: none;
}

.item-label{
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
}

.item-link{
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 0;
  margin: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.submenu-toggle{
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 6px 10px;
  margin: -6px -10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.submenu-toggle:hover{
  background: rgba(15, 23, 42, 0.06);
}

.submenu-chevron{
  margin-left: auto;
  font-size: 16px;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.65);
  transition: color 0.15s ease;
  line-height: 1;
}

.submenu-chevron.open{
  color: rgba(15, 23, 42, 0.85);
}

.submenu{
  display: grid;
  gap: 6px;
  padding: 0 2px 6px 24px;
}

.submenu-item{
  appearance: none;
  border: 1px solid transparent;
  width: 100%;
  text-align: left;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.82);
  background: rgba(15, 23, 42, 0.03);
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
}

.submenu-item:hover{
  background: rgba(15, 23, 42, 0.06);
  border-color: rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.submenu-icon{
  width: 14px;
  height: 14px;
  fill: currentColor;
  flex: 0 0 auto;
}

.item-icon{
  width: 16px;
  height: 16px;
  fill: currentColor;
  flex: 0 0 auto;
}

.menu-backdrop{
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.menu-backdrop.open{
  opacity: 1;
  pointer-events: auto;
}

.mobile-menu-head{
  display: none;
}

@media (max-width: 900px){
  .side-menu{
    top: 16px;
    left: 16px;
    z-index: 60;
  }
  .dropdown{
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(86vw, 360px);
    margin: 0;
    border-radius: 18px 0 0 18px;
    padding: 18px 20px 20px;
    gap: 5px;
    background: #ffffff;
    transform: translateX(20px);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
  }
  .dropdown.open{
    transform: translateX(0);
  }
  .mobile-menu-head{
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
  }
  .mobile-menu-logo{
    width: 72px;
    height: auto;
    object-fit: contain;
  }
  .mobile-menu-close{
    position: absolute;
    right: 0;
  }
  .mobile-menu-title{
    font-size: 12px;
    letter-spacing: 0.3em;
    font-weight: 600;
    color: rgba(15, 23, 42, 0.7);
  }
  .mobile-menu-close{
    width: 36px;
    height: 36px;
    border-radius: 999px;
    border: 1px solid rgba(15, 23, 42, 0.14);
    background: rgba(255,255,255,0.7);
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  .item{
    text-align: center;
    font-size: 14px;
    padding: 8px 12px;
    height: 38px;
  }
}
</style>
