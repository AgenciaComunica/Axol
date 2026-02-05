<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const open = ref(false)
const router = useRouter()

function toggleMenu() {
  open.value = !open.value
}

function goToTransformers() {
  router.push({ name: 'transformer-list' })
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
      <div class="item static">Início</div>
      <div class="item-heading">Óleo Isolante</div>
      <button class="item" type="button" @click="goToTransformers">Transformadores</button>
      <div class="item static">Transformadores Normais</div>
      <div class="item static">Transformadores em Alerta</div>
      <div class="item static">Transformadores em Críticos</div>
      <div class="item static">Próximas Coletas</div>
      <div class="item static">Tratamento de Óleo</div>
      <div class="item-heading">Cadastro OLTC</div>
      <div class="item static">OLTC</div>
      <div class="item static">Físicos Químicos</div>
      <div class="item static">Cromatografias</div>
      <div class="item static">Físicos Químicos</div>
      <div class="item static">Ensaios Especiais</div>
      <div class="item-heading">Sair</div>
    </div>
  </div>
</template>

<style scoped>
.side-menu{
  position: fixed;
  top: 24px;
  left: 24px;
  z-index: 30;
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
}
.item.static{
  cursor: default;
}
.item:hover{ background: rgba(15, 23, 42, 0.06); border-color: rgba(15, 23, 42, 0.08); transform: translateY(-1px); }

.item-heading{
  font-size: 12px;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.65);
  padding: 10px 12px 4px;
}

.mobile-menu-head{
  display: none;
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
