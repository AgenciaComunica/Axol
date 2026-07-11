<script setup lang="ts">
type HeaderAction = {
  label: string
  onClick: () => void
  icon?: 'oil' | 'map' | 'settings' | 'back'
}

defineProps<{
  eyebrow: string
  title: string
  subtitle?: string
  action?: HeaderAction
  secondaryAction?: HeaderAction
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
    <div v-if="action || secondaryAction" class="header-actions">
      <button v-if="secondaryAction" type="button" class="ghost-btn" @click="secondaryAction.onClick">
        <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path v-if="(secondaryAction.icon || 'oil') === 'settings'" d="M19.4 13a7.8 7.8 0 0 0 .1-2l2-1.5-2-3.4-2.3.8a7.6 7.6 0 0 0-1.7-1L15 2h-4l-.5 3a7.6 7.6 0 0 0-1.7 1l-2.3-.8-2 3.4L6.6 11a7.8 7.8 0 0 0 .1 2l-2 1.5 2 3.4 2.3-.8a7.6 7.6 0 0 0 1.7 1l.5 3h4l.5-3a7.6 7.6 0 0 0 1.7-1l2.3.8 2-3.4-2-1.5zM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"></path>
          <path v-else-if="secondaryAction.icon === 'map'" d="M20.5 3.5a1 1 0 0 0-.95-.07L15 5.1 9 3 3.45 4.84A1 1 0 0 0 3 5.78v13.72a1 1 0 0 0 1.32.95L9 18.9l6 2.1 5.55-1.84a1 1 0 0 0 .95-.95V4.5a1 1 0 0 0-1-1zM10 5.47l4 1.4v11.06l-4-1.4V5.47zm-5 1.38 3-1v11.68l-3 1V6.85zm14 12.3-3 1V7.13l3-1v13.02z"></path>
          <path v-else d="M12 2.5c2.7 3.1 6.5 7.8 6.5 11.1a6.5 6.5 0 1 1-13 0C5.5 10.3 9.3 5.6 12 2.5zm0 4.7c-1.8 2.3-4 5.4-4 6.9a4 4 0 0 0 8 0c0-1.5-2.2-4.6-4-6.9z"></path>
        </svg>
        {{ secondaryAction.label }}
      </button>
      <button v-if="action" type="button" class="ghost-btn" @click="action.onClick">
        <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path v-if="action.icon === 'back'" d="M20 11v2H8l5.5 5.5-1.4 1.4L4.2 12l7.9-7.9 1.4 1.4L8 11h12z"></path>
          <path v-else-if="action.icon === 'settings'" d="M19.4 13a7.8 7.8 0 0 0 .1-2l2-1.5-2-3.4-2.3.8a7.6 7.6 0 0 0-1.7-1L15 2h-4l-.5 3a7.6 7.6 0 0 0-1.7 1l-2.3-.8-2 3.4L6.6 11a7.8 7.8 0 0 0 .1 2l-2 1.5 2 3.4 2.3-.8a7.6 7.6 0 0 0 1.7 1l.5 3h4l.5-3a7.6 7.6 0 0 0 1.7-1l2.3.8 2-3.4-2-1.5zM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"></path>
          <path v-else d="M20.5 3.5a1 1 0 0 0-.95-.07L15 5.1 9 3 3.45 4.84A1 1 0 0 0 3 5.78v13.72a1 1 0 0 0 1.32.95L9 18.9l6 2.1 5.55-1.84a1 1 0 0 0 .95-.95V4.5a1 1 0 0 0-1-1zM10 5.47l4 1.4v11.06l-4-1.4V5.47zm-5 1.38 3-1v11.68l-3 1V6.85zm14 12.3-3 1V7.13l3-1v13.02z"></path>
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
  gap: 10px;
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

.action-icon{
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
