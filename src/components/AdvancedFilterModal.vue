<script setup lang="ts">
import BaseModal from './BaseModal.vue'

export type AdvancedOperator = '=' | '!=' | '>' | '<' | '>=' | '<='
export type AdvancedConnector = 'AND' | 'OR'

export type AdvancedFilterRule = {
  id: number
  field: string
  operator: AdvancedOperator
  value: string
  connector: AdvancedConnector
}

export type FieldOption = { value: string; label: string }

const props = defineProps<{
  rules: AdvancedFilterRule[]
  fieldOptions: FieldOption[]
  getFieldValueOptions: (field: string) => string[]
}>()

const emit = defineEmits<{
  close: []
  apply: []
  clear: []
  addRule: []
  removeRule: [id: number]
}>()
</script>

<template>
  <BaseModal title="Filtro Avançado" @close="emit('close')">
    <div class="advanced-filter-modal-inner">
      <div class="advanced-filter-rules">
        <div
          v-for="(rule, index) in props.rules"
          :key="`advanced-rule-${rule.id}`"
          class="advanced-filter-row"
        >
          <select v-if="index > 0" v-model="rule.connector" aria-label="Operador lógico">
            <option value="AND">E</option>
            <option value="OR">OU</option>
          </select>
          <span v-else class="advanced-filter-first">SE</span>
          <select v-model="rule.field" aria-label="Campo">
            <option
              v-for="option in props.fieldOptions"
              :key="`advanced-field-${option.value}`"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          <select v-model="rule.operator" aria-label="Operador">
            <option value="=">==</option>
            <option value="!=">!=</option>
            <option value=">">&gt;</option>
            <option value="<">&lt;</option>
            <option value=">=">&gt;=</option>
            <option value="<=">&lt;=</option>
          </select>
          <select
            v-if="props.getFieldValueOptions(rule.field).length"
            v-model="rule.value"
            aria-label="Valor da expressão"
          >
            <option value="">Selecione</option>
            <option
              v-for="option in props.getFieldValueOptions(rule.field)"
              :key="`advanced-value-${rule.id}-${option}`"
              :value="option"
            >
              {{ option }}
            </option>
          </select>
          <input
            v-else
            v-model="rule.value"
            type="text"
            placeholder="Valor"
            aria-label="Valor da expressão"
          />
          <button type="button" class="advanced-filter-remove" @click="emit('removeRule', rule.id)">
            Remover
          </button>
        </div>
      </div>
      <div class="advanced-filter-footer">
        <button type="button" class="modal-btn secondary" @click="emit('addRule')">+ Condição</button>
        <div class="advanced-filter-footer-right">
          <button type="button" class="modal-btn secondary" @click="emit('clear')">Limpar</button>
          <button type="button" class="modal-btn secondary" @click="emit('close')">Cancelar</button>
          <button type="button" class="modal-btn primary" @click="emit('apply')">Aplicar</button>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.advanced-filter-modal-inner :deep(.modal-card) {
  width: min(980px, 100%);
}

.advanced-filter-rules {
  display: grid;
  gap: 10px;
  max-height: min(52vh, 440px);
  overflow: auto;
  padding-right: 4px;
}

.advanced-filter-row {
  display: grid;
  grid-template-columns: 92px minmax(170px, 1fr) 90px minmax(180px, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.advanced-filter-row select,
.advanced-filter-row input {
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  padding: 0 10px;
  font-size: 13px;
  color: rgba(15, 23, 42, 0.84);
  background: #fff;
}

.advanced-filter-first {
  height: 36px;
  border-radius: 10px;
  border: 1px dashed rgba(15, 23, 42, 0.2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.65);
}

.advanced-filter-remove {
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(220, 38, 38, 0.35);
  background: rgba(220, 38, 38, 0.08);
  color: #b91c1c;
  font-size: 12px;
  font-weight: 700;
  padding: 0 10px;
  cursor: pointer;
}

.advanced-filter-footer {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.advanced-filter-footer-right {
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
  .advanced-filter-row {
    grid-template-columns: 1fr;
  }
}
</style>
