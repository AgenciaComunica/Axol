<script setup lang="ts">
export type TransformerPickerItem = {
  id: string
  serial: string
  [key: string]: unknown
}

export type TransformerPickerGroup = {
  substation: string
  items: TransformerPickerItem[]
  filteredItems: TransformerPickerItem[]
  groupMatch: boolean
}

export type TransformerPickerEntry =
  | { kind: 'group'; key: string; index: number; group: TransformerPickerGroup }
  | { kind: 'item'; key: string; index: number; group: TransformerPickerGroup; item: TransformerPickerItem }

const props = defineProps<{
  entries: TransformerPickerEntry[]
  selectedId: string | null
  selectedLabel: string
  open: boolean
  search: string
  isGroupExpanded: (group: TransformerPickerGroup) => boolean
  visibleItems: (group: TransformerPickerGroup) => TransformerPickerItem[]
}>()

const emit = defineEmits<{
  toggle: []
  'open-picker': []
  'update:search': [value: string]
  keydown: [event: KeyboardEvent]
  'search-keydown': [direction: 'up' | 'down']
  selectItem: [item: TransformerPickerItem]
  toggleGroup: [substation: string]
}>()
</script>

<template>
  <div class="selector">
    <label for="trafo-picker-trigger">Selecionar transformador</label>
    <button
      id="trafo-picker-trigger"
      type="button"
      class="transformer-picker-trigger"
      :aria-expanded="open ? 'true' : 'false'"
      aria-haspopup="listbox"
      @click="emit('toggle')"
      @keydown.down.prevent="emit('open-picker')"
    >
      <span class="transformer-picker-trigger-label">{{ selectedLabel }}</span>
      <i aria-hidden="true">{{ open ? '▴' : '▾' }}</i>
    </button>
    <div
      v-if="open"
      class="transformer-picker-menu"
      @keydown="emit('keydown', $event)"
    >
      <div class="transformer-picker-search-wrap">
        <input
          :value="search"
          type="text"
          class="transformer-picker-search"
          placeholder="Buscar subestação ou transformador..."
          aria-label="Buscar subestação ou transformador"
          @input="emit('update:search', ($event.target as HTMLInputElement).value)"
          @keydown.down.prevent="emit('search-keydown', 'down')"
          @keydown.up.prevent="emit('search-keydown', 'up')"
        />
      </div>
      <div class="transformer-picker-list" role="listbox" aria-label="Transformadores por subestação">
        <template v-for="entry in entries" :key="entry.key">
          <button
            v-if="entry.kind === 'group'"
            type="button"
            class="transformer-picker-group"
            :data-trafo-index="entry.index"
            :aria-expanded="props.isGroupExpanded(entry.group) ? 'true' : 'false'"
            @click="emit('toggleGroup', entry.group.substation)"
          >
            <span class="transformer-picker-group-main">
              <i class="transformer-picker-caret" aria-hidden="true">
                {{ props.isGroupExpanded(entry.group) ? '−' : '+' }}
              </i>
              {{ entry.group.substation }}
            </span>
            <small>{{ props.visibleItems(entry.group).length }}</small>
          </button>
          <button
            v-else
            type="button"
            class="transformer-picker-item"
            :class="{ active: entry.item.id === selectedId }"
            :data-trafo-index="entry.index"
            @click="emit('selectItem', entry.item)"
          >
            <span>{{ entry.item.id }}</span>
            <small>{{ entry.item.serial }}</small>
          </button>
        </template>
        <div v-if="!entries.length" class="transformer-picker-empty">
          Nenhum transformador encontrado.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.selector {
  display: grid;
  gap: 6px;
  position: relative;
}

.selector label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(15, 23, 42, 0.55);
}

.transformer-picker-trigger {
  min-width: 340px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: #fff;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: rgba(15, 23, 42, 0.82);
  cursor: pointer;
}

.transformer-picker-trigger-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.transformer-picker-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 48;
  width: min(420px, 92vw);
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: #fff;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
  padding: 8px;
  display: grid;
  gap: 8px;
}

.transformer-picker-search-wrap {
  padding: 2px;
}

.transformer-picker-search {
  width: 100%;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  padding: 0 10px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.82);
  outline: none;
}

.transformer-picker-search:focus {
  border-color: #1e4e8b;
  box-shadow: 0 0 0 2px rgba(30, 78, 139, 0.14);
}

.transformer-picker-list {
  max-height: 320px;
  overflow: auto;
  display: grid;
  gap: 4px;
  padding-right: 2px;
}

.transformer-picker-group,
.transformer-picker-item {
  width: 100%;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: #fff;
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  text-align: left;
  cursor: pointer;
  color: rgba(15, 23, 42, 0.8);
}

.transformer-picker-group-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
}

.transformer-picker-caret {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-style: normal;
  font-size: 12px;
  line-height: 1;
}

.transformer-picker-group small,
.transformer-picker-item small {
  font-size: 11px;
  color: rgba(15, 23, 42, 0.55);
}

.transformer-picker-item {
  padding-left: 34px;
}

.transformer-picker-item.active {
  border-color: rgba(30, 78, 139, 0.45);
  background: rgba(30, 78, 139, 0.08);
}

.transformer-picker-group:hover,
.transformer-picker-item:hover {
  background: rgba(15, 23, 42, 0.04);
}

.transformer-picker-group:focus-visible,
.transformer-picker-item:focus-visible {
  outline: 2px solid rgba(30, 78, 139, 0.4);
  outline-offset: 1px;
}

.transformer-picker-empty {
  padding: 10px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.55);
  text-align: center;
}

@media (max-width: 700px) {
  .transformer-picker-trigger {
    min-width: 200px;
  }

  .transformer-picker-menu {
    width: 92vw;
  }
}
</style>
