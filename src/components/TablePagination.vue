<script setup lang="ts">
defineProps<{
  page: number
  totalPages: number
  rowsPerPage: number
  rowsPerPageOptions: number[]
  pageRangeLabel: string
}>()

const emit = defineEmits<{
  'update:page': [value: number]
  'update:rowsPerPage': [value: number]
}>()
</script>

<template>
  <div class="table-pagination">
    <label class="rows-per-page">
      <span>Itens por página</span>
      <select :value="rowsPerPage" @change="emit('update:rowsPerPage', Number(($event.target as HTMLSelectElement).value))">
        <option v-for="size in rowsPerPageOptions" :key="`rows-${size}`" :value="size">
          {{ size }}
        </option>
      </select>
    </label>
    <span class="page-range">{{ pageRangeLabel }}</span>
    <button type="button" class="page-btn" :disabled="page <= 1" @click="emit('update:page', page - 1)">
      Anterior
    </button>
    <span class="page-current">Página {{ page }} de {{ totalPages }}</span>
    <button type="button" class="page-btn" :disabled="page >= totalPages" @click="emit('update:page', page + 1)">
      Próxima
    </button>
  </div>
</template>

<style scoped>
.table-pagination {
  margin-top: 12px;
  padding: 8px 6px 6px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.rows-per-page {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.rows-per-page span {
  font-size: 11px;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.72);
}

.rows-per-page select {
  height: 30px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  background: #fff;
  color: rgba(15, 23, 42, 0.8);
  font-size: 12px;
  padding: 0 8px;
}

.page-range,
.page-current {
  font-size: 12px;
  color: rgba(15, 23, 42, 0.75);
}

.page-btn {
  height: 30px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.9);
  color: rgba(15, 23, 42, 0.82);
  font-size: 12px;
  font-weight: 600;
  padding: 0 10px;
  cursor: pointer;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
