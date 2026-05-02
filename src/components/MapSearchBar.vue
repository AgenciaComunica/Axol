<script setup lang="ts">
export type SearchSuggestion = {
  kind: 'transformer' | 'substation' | 'place'
  label: string
  transformer?: unknown
  substation?: string
  place?: unknown
}

const props = defineProps<{
  modelValue: string
  loading: boolean
  ready: boolean
  error: string
  suggestions: SearchSuggestion[]
  suggestOpen: boolean
  suggestLoading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:suggestOpen': [value: boolean]
  submit: []
  blur: []
  selectSuggestion: [suggestion: SearchSuggestion]
}>()

function onFocus() {
  if (props.suggestions.length > 0) {
    emit('update:suggestOpen', true)
  }
}
</script>

<template>
  <div class="search-under-logo">
    <div class="search-wrap">
      <form class="search-bar" @submit.prevent="emit('submit')">
        <div class="search-input-wrap">
          <input
            :value="modelValue"
            type="search"
            placeholder="Pesquisar endereço"
            aria-label="Pesquisar endereço"
            @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
            @focus="onFocus"
            @blur="emit('blur')"
          />
          <div v-if="suggestOpen" class="search-suggest">
            <div
              v-for="suggestion in suggestions"
              :key="suggestion.label"
              class="search-suggest-item"
              @mousedown.prevent="emit('selectSuggestion', suggestion)"
            >
              {{ suggestion.label }}
            </div>
            <div v-if="suggestLoading" class="search-suggest-loading">Carregando...</div>
          </div>
        </div>
        <button type="submit" :disabled="loading || !ready">
          {{ !ready ? 'Carregando...' : loading ? 'Buscando...' : 'Buscar' }}
        </button>
      </form>
      <span v-if="error" class="search-error">{{ error }}</span>
    </div>
  </div>
</template>

<style scoped>
.search-under-logo {
  display: flex;
  justify-content: center;
  position: relative;
  z-index: 6;
  margin-top: -10px;
  pointer-events: none;
}

.search-wrap {
  display: grid;
  justify-items: end;
  gap: 6px;
  pointer-events: auto;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
  min-width: 320px;
}

.search-input-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}

.search-bar input {
  border: none;
  background: transparent;
  padding: 6px 10px;
  font-size: 12px;
  width: 100%;
  min-width: 0;
  color: rgba(15, 23, 42, 0.8);
}

.search-bar input:focus {
  outline: none;
}

.search-bar button {
  border: none;
  background: var(--color-accent, #1e4e8b);
  color: #ffffff;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  min-width: 88px;
}

.search-bar button:disabled {
  opacity: 0.6;
  cursor: default;
}

.search-error {
  font-size: 11px;
  color: rgba(180, 20, 20, 0.8);
}

.search-suggest {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  width: 100%;
  box-sizing: border-box;
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 12px;
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.12);
  padding: 4px;
  display: grid;
  gap: 4px;
  max-height: 240px;
  overflow: auto;
  z-index: 10;
}

.search-suggest-item {
  background: transparent;
  text-align: left;
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.8);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-suggest-item:hover {
  background: rgba(15, 23, 42, 0.06);
}

.search-suggest-loading {
  padding: 6px 10px;
  font-size: 11px;
  color: rgba(15, 23, 42, 0.5);
}
</style>
