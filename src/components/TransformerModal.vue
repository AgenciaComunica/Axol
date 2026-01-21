<script setup lang="ts">
type Transformer = {
  id: string
  name: string
  status: string
  power: string
  voltage: string
  oil: string
  location: string
}

const props = defineProps<{ open: boolean; transformer: Transformer | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="emit('close')">
    <div class="modal" role="dialog" aria-modal="true">
      <div class="head">
        <strong>{{ transformer?.name || 'Transformador' }}</strong>
        <button class="close" type="button" @click="emit('close')">X</button>
      </div>
      <div class="body">
        <div class="frame">IFRAME 3D DO TRANSFORMADOR (placeholder)</div>
        <div class="facts">
          <div class="kv"><span>ID</span><b>{{ transformer?.id }}</b></div>
          <div class="kv"><span>Status</span><b>{{ transformer?.status }}</b></div>
          <div class="kv"><span>Potencia</span><b>{{ transformer?.power }}</b></div>
          <div class="kv"><span>Nivel de tensao</span><b>{{ transformer?.voltage }}</b></div>
          <div class="kv"><span>Oleo</span><b>{{ transformer?.oil }}</b></div>
          <div class="kv"><span>Local</span><b>{{ transformer?.location }}</b></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop{
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  padding: 18px;
  z-index: 40;
}

.modal{
  width: min(920px, 100%);
  border-radius: 22px;
  background: rgba(255,255,255,0.95);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 30px 80px rgba(15, 23, 42, 0.2);
  overflow: hidden;
}

.head{
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}
.head strong{ font-size: 14px; color: rgba(15, 23, 42, 0.8); }

.close{
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(15, 23, 42, 0.04);
  cursor: pointer;
}

.body{
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 16px;
  padding: 16px;
}

.frame{
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(15, 23, 42, 0.03);
  min-height: 300px;
  display: grid;
  place-items: center;
  color: rgba(15, 23, 42, 0.55);
  font-size: 12px;
}

.facts{
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255,255,255,0.8);
  padding: 12px;
  display: grid;
  gap: 10px;
}

.kv{
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(15, 23, 42, 0.02);
  font-size: 12px;
}
.kv span{ color: rgba(15, 23, 42, 0.55); }

@media (max-width: 900px){
  .body{ grid-template-columns: 1fr; }
}
</style>
