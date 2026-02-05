<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const trafoId = String(route.params.id || '')
</script>

<template>
  <div class="report-view">
    <h1>Relatório do Transformador</h1>
    <p>Em construção.</p>
    <p v-if="trafoId">ID: {{ trafoId }}</p>
  </div>
</template>

<style scoped>
.report-view{
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 24px;
  color: var(--color-text, #0f172a);
}
.report-view h1{
  font-size: 24px;
  margin-bottom: 12px;
}
</style>
