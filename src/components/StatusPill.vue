<script setup lang="ts">
import { statusTone } from '@/composables/useStatusUtils'

defineProps<{ status?: string }>()
</script>

<template>
  <span class="status-pill" :class="statusTone(status)">{{ status || '-' }}</span>
</template>

<style scoped>
.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.status-pill.tone-normal {
  background: var(--level-n1, rgba(0, 200, 0, 0.18));
  color: #064e06;
}

.status-pill.tone-warning {
  background: var(--level-n3, rgba(255, 220, 0, 0.22));
  color: #5c5900;
}

.status-pill.tone-danger {
  background: var(--level-n5, rgba(200, 0, 0, 0.18));
  color: #ffffff;
}

.status-pill.tone-neutral {
  background: #94a3b8;
  color: #0f172a;
}
</style>
