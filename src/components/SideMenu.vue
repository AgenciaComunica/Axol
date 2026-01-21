<script setup lang="ts">
import { ref } from 'vue'

const open = ref(false)

function toggleMenu() {
  open.value = !open.value
}
</script>

<template>
  <div class="side-menu">
    <button class="menu-btn" :class="{ open }" type="button" @click="toggleMenu">
      <div v-if="!open" class="hamburger" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span v-else class="menu-text">MENU</span>
    </button>

    <div class="dropdown" :class="{ open }">
      <button class="item" type="button">Visao Geral</button>
      <button class="item" type="button">Alertas</button>
      <button class="item" type="button">Relatorios</button>
      <button class="item" type="button">Configuracoes</button>
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
  background: rgba(255,255,255,0.85);
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
.item:hover{ background: rgba(15, 23, 42, 0.06); border-color: rgba(15, 23, 42, 0.08); transform: translateY(-1px); }
</style>
