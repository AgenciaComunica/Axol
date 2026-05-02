<script setup lang="ts">
defineProps<{ title?: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div class="modal-overlay" @click="emit('close')">
    <div class="modal-card" @click.stop>
      <h4 v-if="title">{{ title }}</h4>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.52);
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 20px;
}

.modal-card {
  width: min(760px, 100%);
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: #fff;
  box-shadow: 0 24px 50px rgba(15, 23, 42, 0.2);
  padding: 16px;
}

.modal-card h4 {
  margin: 0 0 12px;
}
</style>
