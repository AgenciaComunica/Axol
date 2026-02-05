<script setup lang="ts">
type HeaderAction = {
  label: string
  onClick: () => void
}

defineProps<{
  eyebrow: string
  title: string
  subtitle?: string
  action?: HeaderAction
}>()
</script>

<template>
  <header class="app-header">
    <div class="header-title">
      <div class="top-logo">
        <img src="@/assets/logo_siaro.png" alt="Siaro" />
      </div>
      <div>
        <span class="eyebrow">{{ eyebrow }}</span>
        <h1>{{ title }}</h1>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
    </div>
    <div v-if="action" class="header-actions">
      <button type="button" class="ghost-btn" @click="action.onClick">
        <svg class="map-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.5 3.5a1 1 0 0 0-.95-.07L15 5.1 9 3 3.45 4.84A1 1 0 0 0 3 5.78v13.72a1 1 0 0 0 1.32.95L9 18.9l6 2.1 5.55-1.84a1 1 0 0 0 .95-.95V4.5a1 1 0 0 0-1-1zM10 5.47l4 1.4v11.06l-4-1.4V5.47zm-5 1.38 3-1v11.68l-3 1V6.85zm14 12.3-3 1V7.13l3-1v13.02z"></path>
        </svg>
        {{ action.label }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header{
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

.header-title{
  display: flex;
  align-items: center;
  gap: 16px;
}

.top-logo{
  display: flex;
  justify-content: center;
  margin: 0;
}

.top-logo img{
  width: 86px;
  height: auto;
  object-fit: contain;
}

.header-title h1{
  margin: 6px 0 6px;
  font-size: 28px;
}

.header-title p{
  margin: 0;
  color: rgba(15, 23, 42, 0.65);
  font-size: 14px;
}

.eyebrow{
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: rgba(15, 23, 42, 0.5);
  font-weight: 600;
}

.header-actions{
  display: flex;
  justify-content: flex-end;
}

.ghost-btn{
  border: 1px solid rgba(15, 23, 42, 0.15);
  background: rgba(255,255,255,0.7);
  border-radius: 999px;
  padding: 10px 18px;
  font-size: 13px;
  cursor: pointer;
  color: rgba(15, 23, 42, 0.8);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.map-icon{
  width: 16px;
  height: 16px;
  fill: currentColor;
}

@media (max-width: 900px){
  .app-header{
    flex-direction: column;
    align-items: flex-start;
  }
  .header-title{
    align-items: flex-start;
  }
  .header-actions{
    justify-content: flex-start;
  }
  .top-logo img{
    width: 70px;
  }
}
</style>
