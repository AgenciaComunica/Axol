<script setup lang="ts">
import BaseModal from './BaseModal.vue'

export type EditForm = {
  serial: string
  tag: string
  substation: string
  unit: string
  power: string
  voltage: string
  manufacturer: string
  year: string
  latitude: string
  longitude: string
}

const props = defineProps<{ form: EditForm }>()
const emit = defineEmits<{ close: []; save: [] }>()
</script>

<template>
  <BaseModal title="Editar Transformador" @close="emit('close')">
    <div class="modal-grid">
      <label>
        <span>Serial</span>
        <input v-model="props.form.serial" type="text" />
      </label>
      <label>
        <span>TAG</span>
        <input v-model="props.form.tag" type="text" />
      </label>
      <label class="full">
        <span>Subestação</span>
        <input v-model="props.form.substation" type="text" />
      </label>
      <label>
        <span>Unidade</span>
        <input v-model="props.form.unit" type="text" />
      </label>
      <label>
        <span>Potência</span>
        <input v-model="props.form.power" type="text" />
      </label>
      <label>
        <span>Tensão</span>
        <input v-model="props.form.voltage" type="text" />
      </label>
      <label>
        <span>Fabricante</span>
        <input v-model="props.form.manufacturer" type="text" />
      </label>
      <label>
        <span>Ano</span>
        <input v-model="props.form.year" type="text" />
      </label>
      <label>
        <span>Latitude</span>
        <input v-model="props.form.latitude" type="text" />
      </label>
      <label>
        <span>Longitude</span>
        <input v-model="props.form.longitude" type="text" />
      </label>
    </div>
    <div class="modal-actions">
      <button type="button" class="modal-btn secondary" @click="emit('close')">Cancelar</button>
      <button type="button" class="modal-btn primary" @click="emit('save')">Salvar</button>
    </div>
  </BaseModal>
</template>

<style scoped>
.modal-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.modal-grid label {
  display: grid;
  gap: 6px;
}

.modal-grid label span {
  font-size: 12px;
  color: rgba(15, 23, 42, 0.72);
  font-weight: 600;
}

.modal-grid input {
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  padding: 0 10px;
  font-size: 13px;
}

.modal-grid .full {
  grid-column: 1 / -1;
}

.modal-actions {
  margin-top: 14px;
  display: inline-flex;
  gap: 8px;
}

.modal-btn {
  height: 34px;
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 0 14px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.modal-btn.secondary {
  background: rgba(15, 23, 42, 0.06);
  color: rgba(15, 23, 42, 0.8);
  border-color: rgba(15, 23, 42, 0.12);
}

.modal-btn.primary {
  background: #1e4e8b;
  color: #fff;
}

@media (max-width: 900px) {
  .modal-grid {
    grid-template-columns: 1fr;
  }

  .modal-grid .full {
    grid-column: auto;
  }
}
</style>
