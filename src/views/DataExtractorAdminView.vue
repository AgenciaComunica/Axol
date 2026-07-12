<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import SideMenu from '@/components/SideMenu.vue'
import {
  defaultExtractorConfig,
  extractorConfigKey,
  loadJson,
  normalizeExtractorConfig,
  parsePackageSchema,
  saveJson,
  type AnalysisPackage,
  type ExtractorDataType,
  type ExtractorFieldSchema,
  type ExtractorConfig,
} from '@/utils/smartDocExtractor'

type SchemaItemRow = { id: string; key: string; type: string }
type SchemaBlockDraft = Omit<ExtractorFieldSchema, 'aliases' | 'item_schema'> & {
  id: string
  aliasesText: string
  itemSchemaRows: SchemaItemRow[]
}

const router = useRouter()
const config = ref<ExtractorConfig>(defaultExtractorConfig())
const showApiKey = ref(false)
const isTestingConnection = ref(false)
const saveMessage = ref('')
const validationErrors = ref<string[]>([])
const healthState = ref<{ status: 'idle' | 'online' | 'offline' | 'unauthorized'; application?: string; latency?: number; message?: string }>({ status: 'idle' })
const selectedModuleIndex = ref<number | null>(null)
const rulesModalOpen = ref(false)
const schemaViewMode = ref<'blocks' | 'json'>('blocks')
const schemaBlocks = ref<SchemaBlockDraft[]>([])
const expandedSchemaBlocks = ref<string[]>([])
const schemaDataTypes: ExtractorDataType[] = ['string', 'number', 'integer', 'boolean', 'date', 'percentage', 'array', 'list']
let saveMessageTimeout: ReturnType<typeof setTimeout> | null = null

const activePackageCount = computed(() => config.value.packages.filter((pkg) => pkg.active).length)
const selectedModule = computed(() =>
  selectedModuleIndex.value == null ? null : config.value.packages[selectedModuleIndex.value] || null
)

onMounted(() => {
  config.value = normalizeExtractorConfig(loadJson(extractorConfigKey, defaultExtractorConfig()))
  saveJson(extractorConfigKey, config.value)
})

onBeforeUnmount(() => {
  if (saveMessageTimeout) clearTimeout(saveMessageTimeout)
})

watch(schemaBlocks, () => {
  if (schemaViewMode.value === 'blocks') syncBlocksToSchemaText()
}, { deep: true })

function addPackage() {
  const nextModule = {
    id: `modulo-${Date.now().toString(36)}`,
    name: 'Novo módulo',
    description: '',
    active: true,
    schemaText: '[]',
  }
  config.value.packages.push(nextModule)
  selectedModuleIndex.value = config.value.packages.length - 1
  loadSchemaBlocks()
}

function removePackage(index: number) {
  config.value.packages.splice(index, 1)
  if (selectedModuleIndex.value === index) selectedModuleIndex.value = null
  if (selectedModuleIndex.value != null && selectedModuleIndex.value > index) selectedModuleIndex.value -= 1
}

function validateConfig() {
  const errors: string[] = []
  if (!config.value.apiBaseUrl.trim()) errors.push('URL base da API é obrigatória.')
  if (!config.value.apiKey.trim()) errors.push('API Key é obrigatória.')
  if (!activePackageCount.value) errors.push('Ative pelo menos um módulo de documento.')
  config.value.packages.forEach((pkg) => {
    if (!pkg.id.trim()) errors.push('Todo pacote precisa de id.')
    if (!pkg.name.trim()) errors.push(`Módulo ${pkg.id || '(sem id)'} precisa de nome.`)
    try {
      parsePackageSchema(pkg)
    } catch (error) {
      errors.push(`${pkg.name}: ${error instanceof Error ? error.message : 'schema inválido.'}`)
    }
  })
  validationErrors.value = errors
  return errors.length === 0
}

function saveConfig() {
  saveMessage.value = ''
  if (saveMessageTimeout) clearTimeout(saveMessageTimeout)
  if (!validateConfig()) return
  config.value.apiBaseUrl = config.value.apiBaseUrl.trim().replace(/\/$/, '')
  config.value.apiKey = config.value.apiKey.trim()
  config.value = normalizeExtractorConfig(config.value)
  saveJson(extractorConfigKey, config.value)
  showSaveMessage('Configurações salvas com sucesso.')
  void testConnection()
}

function saveModule() {
  const module = selectedModule.value
  if (!module) return
  if (schemaViewMode.value === 'blocks') syncBlocksToSchemaText()

  const errors: string[] = []
  let normalizedSchema: ReturnType<typeof parsePackageSchema> | null = null
  if (!module.id.trim()) errors.push('O ID do módulo é obrigatório.')
  if (!module.name.trim()) errors.push('O nome do documento é obrigatório.')
  if (config.value.packages.some((pkg) => pkg !== module && pkg.id.trim() === module.id.trim())) {
    errors.push('Já existe outro módulo com este ID.')
  }
  try {
    normalizedSchema = parsePackageSchema(module)
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Schema inválido.')
  }

  validationErrors.value = errors
  if (errors.length) return
  module.schemaText = JSON.stringify(normalizedSchema, null, 2)
  config.value = normalizeExtractorConfig(config.value)
  saveJson(extractorConfigKey, config.value)
  showSaveMessage('Módulo salvo com sucesso.')
}

function showSaveMessage(message: string) {
  if (saveMessageTimeout) clearTimeout(saveMessageTimeout)
  saveMessage.value = message
  saveMessageTimeout = setTimeout(() => {
    saveMessage.value = ''
    saveMessageTimeout = null
  }, 2000)
}

async function testConnection() {
  if (isTestingConnection.value) return
  isTestingConnection.value = true
  healthState.value = { status: 'idle', message: 'Testando...' }
  const started = performance.now()
  const baseUrl = config.value.apiBaseUrl.trim().replace(/\/$/, '')
  const apiKey = config.value.apiKey.trim()
  try {
    const healthResponse = await fetch(`${baseUrl}/health`)
    if (!healthResponse.ok) throw new Error(`HTTP ${healthResponse.status}`)
    const data = await healthResponse.json().catch(() => ({}))

    const authForm = new FormData()
    authForm.append('file', new File(['%PDF-1.4\n%%EOF'], 'auth-check.pdf', { type: 'application/pdf' }))
    authForm.append('fields', '[]')
    authForm.append('analysis_package', 'quimico')
    authForm.append('use_llm', 'false')
    const authResponse = await fetch(`${baseUrl}/extract-pdf`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
      body: authForm,
    })
    const latency = Math.round(performance.now() - started)
    if (authResponse.status === 401 || authResponse.status === 403) {
      const errorBody = await authResponse.json().catch(() => ({}))
      healthState.value = {
        status: 'unauthorized',
        application: data.application || data.app || 'Smart Doc Extractor',
        latency,
        message: errorBody.detail || 'API Key inválida.',
      }
      return
    }
    healthState.value = {
      status: 'online',
      application: data.application || data.app || 'Smart Doc Extractor',
      latency,
      message: 'Chave validada',
    }
  } catch (error) {
    healthState.value = {
      status: 'offline',
      latency: Math.round(performance.now() - started),
      message: error instanceof Error ? error.message : 'Falha no teste de conexão.',
    }
  } finally {
    isTestingConnection.value = false
  }
}

async function copyApiKey() {
  await navigator.clipboard?.writeText(config.value.apiKey)
}

function openModule(index: number) {
  selectedModuleIndex.value = index
  saveMessage.value = ''
  validationErrors.value = []
  schemaViewMode.value = 'blocks'
  loadSchemaBlocks()
}

function closeModule() {
  if (schemaViewMode.value === 'blocks') syncBlocksToSchemaText()
  rulesModalOpen.value = false
  selectedModuleIndex.value = null
}

function setSchemaViewMode(mode: 'blocks' | 'json') {
  if (mode === schemaViewMode.value) return
  if (mode === 'blocks') {
    if (!loadSchemaBlocks()) return
  } else {
    syncBlocksToSchemaText()
  }
  validationErrors.value = []
  schemaViewMode.value = mode
}

function loadSchemaBlocks() {
  const module = selectedModule.value
  if (!module) return false
  try {
    schemaBlocks.value = parsePackageSchema(module).map((field, index) => ({
      id: `field-${Date.now().toString(36)}-${index}`,
      key: field.key,
      label: field.label,
      aliasesText: field.aliases.join(', '),
      required: field.required,
      data_type: field.data_type,
      unit: field.unit,
      itemSchemaRows: Object.entries(field.item_schema || {}).map(([key, type], rowIndex) => ({
        id: `item-${Date.now().toString(36)}-${index}-${rowIndex}`,
        key,
        type: String(type),
      })),
    }))
    expandedSchemaBlocks.value = []
    return true
  } catch (error) {
    validationErrors.value = [error instanceof Error ? error.message : 'Schema JSON inválido.']
    schemaViewMode.value = 'json'
    return false
  }
}

function syncBlocksToSchemaText() {
  const module = selectedModule.value
  if (!module) return
  const fields = schemaBlocks.value.map((block) => {
    const field: Record<string, unknown> = {
      key: block.key,
      label: block.label,
      aliases: block.aliasesText.split(',').map((alias) => alias.trim()).filter(Boolean),
      required: block.required,
      data_type: block.data_type,
    }
    if (block.unit?.trim()) field.unit = block.unit.trim()
    if (block.data_type === 'array' || block.data_type === 'list') {
      field.item_schema = Object.fromEntries(
        block.itemSchemaRows.filter((row) => row.key.trim()).map((row) => [row.key.trim(), row.type.trim() || 'string']),
      )
    }
    return field
  })
  module.schemaText = JSON.stringify(fields, null, 2)
}

function addSchemaBlock() {
  const id = `field-${Date.now().toString(36)}`
  schemaBlocks.value.push({
    id,
    key: '',
    label: 'Novo parâmetro',
    aliasesText: '',
    required: false,
    data_type: 'string',
    itemSchemaRows: [],
  })
  expandedSchemaBlocks.value.push(id)
}

function removeSchemaBlock(index: number) {
  const [removed] = schemaBlocks.value.splice(index, 1)
  if (removed) expandedSchemaBlocks.value = expandedSchemaBlocks.value.filter((id) => id !== removed.id)
}

function moveSchemaBlock(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= schemaBlocks.value.length) return
  const [field] = schemaBlocks.value.splice(index, 1)
  if (field) schemaBlocks.value.splice(target, 0, field)
}

function toggleSchemaBlock(id: string) {
  expandedSchemaBlocks.value = expandedSchemaBlocks.value.includes(id)
    ? expandedSchemaBlocks.value.filter((item) => item !== id)
    : [...expandedSchemaBlocks.value, id]
}

function addItemSchemaRow(block: SchemaBlockDraft) {
  block.itemSchemaRows.push({ id: `item-${Date.now().toString(36)}`, key: '', type: 'string' })
}

function removeItemSchemaRow(block: SchemaBlockDraft, index: number) {
  block.itemSchemaRows.splice(index, 1)
}

function moduleFieldCount(pkg: AnalysisPackage) {
  try {
    return parsePackageSchema(pkg).length
  } catch {
    return 0
  }
}

function moduleRequiredCount(pkg: AnalysisPackage) {
  try {
    return parsePackageSchema(pkg).filter((field) => field.required).length
  } catch {
    return 0
  }
}

function moduleSchemaStatus(pkg: AnalysisPackage) {
  try {
    parsePackageSchema(pkg)
    return 'Schema válido'
  } catch {
    return 'Schema inválido'
  }
}
</script>

<template>
  <SideMenu />
  <main class="admin-page">
    <AppHeader
      eyebrow="Configurações"
      title="Extrator de Dados"
      subtitle="Configuração local da integração com a API Smart Doc Extractor."
      :secondary-action="{ label: 'Extrações', onClick: () => router.push({ name: 'data-extractions' }) }"
    />

    <section class="admin-shell">
      <article class="admin-card">
        <h2>Integração com API</h2>
        <div class="form-grid">
          <label>URL base da API<input v-model="config.apiBaseUrl" placeholder="https://..." /></label>
          <label>API Key
            <div class="input-action">
              <input v-model="config.apiKey" :type="showApiKey ? 'text' : 'password'" placeholder="X-API-Key" />
              <button type="button" @click="showApiKey = !showApiKey">{{ showApiKey ? 'Ocultar' : 'Mostrar' }}</button>
              <button type="button" @click="copyApiKey">Copiar</button>
            </div>
          </label>
        </div>
        <div class="admin-actions">
          <button class="secondary-btn test-connection-btn" type="button" :disabled="isTestingConnection" @click="testConnection">
            <span v-if="isTestingConnection" class="button-spinner" aria-hidden="true"></span>
            {{ isTestingConnection ? 'Testando' : 'Testar conexão' }}
          </button>
          <div class="connection-actions">
            <span v-if="healthState.status !== 'idle'" class="health-pill" :class="healthState.status">
              {{ healthState.status === 'online' ? 'Online' : healthState.status === 'unauthorized' ? 'Não autorizado' : 'Offline' }}
              <template v-if="healthState.latency"> · {{ healthState.latency }}ms</template>
              <template v-if="healthState.application"> · {{ healthState.application }}</template>
              <template v-if="healthState.message"> · {{ healthState.message }}</template>
            </span>
            <button class="primary-btn" type="button" @click="saveConfig">Salvar configurações</button>
          </div>
        </div>
      </article>

      <article v-if="selectedModuleIndex === null" class="admin-card">
        <div class="section-head">
          <div><h2>Módulos de Documento</h2><p>Módulos locais usados pela tela de extração para definir parâmetros esperados.</p></div>
          <div class="document-module-actions">
            <label class="ai-switch">
              <span>Extrair com IA</span>
              <input v-model="config.useLlm" type="checkbox" />
              <span class="ai-switch-track" aria-hidden="true"><span></span></span>
            </label>
            <button class="primary-btn" type="button" @click="addPackage">+ Módulo</button>
          </div>
        </div>
        <div class="document-module-grid">
          <button
            v-for="(pkg, index) in config.packages"
            :key="pkg.id"
            type="button"
            class="document-module-card"
            @click="openModule(index)"
          >
            <div class="document-module-top">
              <span class="module-status" :class="{ active: pkg.active }">{{ pkg.active ? 'Ativo' : 'Inativo' }}</span>
              <span class="module-schema-status">{{ moduleSchemaStatus(pkg) }}</span>
            </div>
            <h3>{{ pkg.name }}</h3>
            <p>{{ pkg.description || 'Sem descrição cadastrada.' }}</p>
            <div class="module-meta">
              <span><b>{{ pkg.id }}</b>ID do módulo</span>
              <span><b>{{ moduleFieldCount(pkg) }}</b>Parâmetros</span>
              <span><b>{{ moduleRequiredCount(pkg) }}</b>Obrigatórios</span>
            </div>
          </button>
          <button type="button" class="document-module-card add-card" @click="addPackage">
            <strong>+ Novo módulo</strong>
            <span>Criar configuração para outro tipo de documento.</span>
          </button>
        </div>
      </article>

      <article v-else-if="selectedModule" class="admin-card module-editor-card">
        <div class="module-editor-head">
          <div>
            <button class="back-btn" type="button" @click="closeModule">← Voltar aos módulos</button>
            <h2>{{ selectedModule.name }}</h2>
            <p>Edite os metadados e o contrato de parâmetros enviado para a API.</p>
          </div>
          <div class="module-editor-actions">
            <label class="switch-row"><input v-model="selectedModule.active" type="checkbox" /> Ativo</label>
            <button class="primary-btn" type="button" @click="saveModule">Salvar módulo</button>
            <button class="danger-btn" type="button" @click="removePackage(selectedModuleIndex!)">Remover módulo</button>
          </div>
        </div>
        <div class="form-grid three">
          <label>ID do módulo<input v-model="selectedModule.id" /></label>
          <label>Documento<input v-model="selectedModule.name" /></label>
          <label>Descrição<input v-model="selectedModule.description" /></label>
        </div>
        <div class="module-editor-body">
          <div class="schema-editor">
            <div class="schema-editor-head">
              <label :for="schemaViewMode === 'json' ? 'module-schema' : undefined">Parâmetros esperados pela API</label>
              <div class="schema-editor-tools">
                <div class="schema-view-switch" role="group" aria-label="Visualização do schema">
                  <button type="button" :class="{ active: schemaViewMode === 'blocks' }" @click="setSchemaViewMode('blocks')">Blocos</button>
                  <button type="button" :class="{ active: schemaViewMode === 'json' }" @click="setSchemaViewMode('json')">JSON</button>
                </div>
                <button class="secondary-btn" type="button" @click="rulesModalOpen = true">Ver regras</button>
              </div>
            </div>
            <textarea v-if="schemaViewMode === 'json'" id="module-schema" v-model="selectedModule.schemaText" rows="22"></textarea>
            <div v-else class="schema-block-editor">
              <div class="schema-block-summary">
                <span><b>{{ schemaBlocks.length }}</b> parâmetros configurados</span>
                <button class="primary-btn" type="button" @click="addSchemaBlock">+ Parâmetro</button>
              </div>
              <div v-if="schemaBlocks.length" class="schema-block-list">
                <section v-for="(block, index) in schemaBlocks" :key="block.id" class="schema-block" :class="{ expanded: expandedSchemaBlocks.includes(block.id) }">
                  <div class="schema-block-head">
                    <button class="schema-block-toggle" type="button" @click="toggleSchemaBlock(block.id)">
                      <span class="schema-block-chevron" :class="{ expanded: expandedSchemaBlocks.includes(block.id) }">›</span>
                      <span class="schema-block-title">
                        <b>{{ block.label || 'Parâmetro sem nome' }}</b>
                        <small>{{ block.key || 'Chave não definida' }} · {{ block.data_type }}</small>
                      </span>
                    </button>
                    <button
                      class="required-field-pill"
                      :class="{ optional: !block.required }"
                      type="button"
                      :title="block.required ? 'Alterar para opcional' : 'Alterar para obrigatório'"
                      @click="block.required = !block.required"
                    >{{ block.required ? 'Obrigatório' : 'Opcional' }}</button>
                    <div class="schema-block-actions">
                      <button type="button" title="Mover para cima" :disabled="index === 0" @click="moveSchemaBlock(index, -1)">↑</button>
                      <button type="button" title="Mover para baixo" :disabled="index === schemaBlocks.length - 1" @click="moveSchemaBlock(index, 1)">↓</button>
                      <button class="remove" type="button" title="Remover parâmetro" @click="removeSchemaBlock(index)">🗑</button>
                    </div>
                  </div>
                  <div v-if="expandedSchemaBlocks.includes(block.id)" class="schema-block-content">
                    <div class="schema-block-grid">
                      <label>Chave<input v-model="block.key" placeholder="Ex.: hidrogenio" /></label>
                      <label>Nome do parâmetro<input v-model="block.label" placeholder="Ex.: Hidrogênio" /></label>
                      <label>Tipo
                        <select v-model="block.data_type">
                          <option v-for="dataType in schemaDataTypes" :key="dataType" :value="dataType">{{ dataType }}</option>
                        </select>
                      </label>
                      <label v-if="['number', 'integer', 'percentage'].includes(block.data_type) || block.unit">Unidade opcional<input v-model="block.unit" placeholder="Ex.: ppm, kV, %" /></label>
                    </div>
                    <label>Aliases separados por vírgula<input v-model="block.aliasesText" placeholder="Ex.: H2, Hidrogênio ppm" /></label>
                    <div v-if="block.data_type === 'array' || block.data_type === 'list'" class="item-schema-editor">
                      <div class="item-schema-head">
                        <div><b>Estrutura de cada item</b><small>Defina as propriedades internas da lista.</small></div>
                        <button type="button" @click="addItemSchemaRow(block)">+ Propriedade</button>
                      </div>
                      <div v-for="(row, rowIndex) in block.itemSchemaRows" :key="row.id" class="item-schema-row">
                        <input v-model="row.key" placeholder="Nome da propriedade" />
                        <input v-model="row.type" placeholder="Tipo, ex.: string" />
                        <button type="button" title="Remover propriedade" @click="removeItemSchemaRow(block, rowIndex)">🗑</button>
                      </div>
                      <p v-if="!block.itemSchemaRows.length">Nenhuma propriedade configurada.</p>
                    </div>
                  </div>
                </section>
              </div>
              <button v-else class="empty-schema-blocks" type="button" @click="addSchemaBlock">+ Adicionar primeiro parâmetro</button>
            </div>
            <div v-if="validationErrors.length" class="schema-validation-errors" role="alert">
              <strong>Não foi possível salvar o módulo:</strong>
              <ul>
                <li v-for="error in validationErrors" :key="error">{{ error }}</li>
              </ul>
            </div>
          </div>
        </div>
      </article>

      <article v-if="validationErrors.length && selectedModuleIndex === null" class="admin-card feedback-card">
        <ul><li v-for="error in validationErrors" :key="error">{{ error }}</li></ul>
      </article>
    </section>

    <div v-if="rulesModalOpen && selectedModule" class="rules-modal-backdrop" @click="rulesModalOpen = false">
      <section class="rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-modal-title" @click.stop>
        <header>
          <div>
            <h3 id="rules-modal-title">Contrato do parâmetro</h3>
            <p>Regras do schema enviado ao Smart Doc Extractor.</p>
          </div>
          <button class="modal-close-btn" type="button" title="Fechar" aria-label="Fechar regras" @click="rulesModalOpen = false">✕</button>
        </header>
        <div class="rules-modal-content schema-guide">
          <p><b>key</b>, <b>label</b>, <b>aliases</b>, <b>required</b> e <b>data_type</b> são obrigatórios. Use <b>unit</b> somente quando houver unidade de medida.</p>
          <p><b>item_schema</b> é exclusivo e obrigatório para parâmetros do tipo <b>array</b> ou <b>list</b>.</p>
          <div class="rules-examples">
            <section>
              <h4>Parâmetro simples</h4>
              <pre>{
  "key": "hidrogenio",
  "label": "Hidrogênio",
  "aliases": ["H2", "Hidrogênio ppm"],
  "required": false,
  "data_type": "number",
  "unit": "ppm"
}</pre>
            </section>
            <section>
              <h4>Parâmetro de lista</h4>
              <pre>{
  "key": "checklistCampo",
  "label": "Checklist",
  "aliases": ["Checklist de Campo"],
  "required": true,
  "data_type": "array",
  "item_schema": {
    "item": "string",
    "condicao": "string",
    "registro": "string"
  }
}</pre>
            </section>
          </div>
          <div class="module-meta">
            <span><b>{{ moduleFieldCount(selectedModule) }}</b>Parâmetros configurados</span>
            <span><b>{{ moduleRequiredCount(selectedModule) }}</b>Parâmetros obrigatórios</span>
            <span><b>{{ moduleSchemaStatus(selectedModule) }}</b>Status</span>
          </div>
        </div>
      </section>
    </div>

    <Transition name="success-modal">
      <div v-if="saveMessage" class="success-modal-backdrop" role="status" aria-live="polite">
        <div class="success-modal">
          <span class="success-modal-icon" aria-hidden="true">✓</span>
          <div>
            <strong>Configurações salvas</strong>
            <p>{{ saveMessage }}</p>
          </div>
        </div>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.admin-page{ min-height:100vh; padding:28px 32px; background:linear-gradient(135deg,#d8e3ec,#edf3f7 42%,#c7d5e0); }
.admin-shell{ display:grid; gap:14px; }
.admin-card{ border:1px solid rgba(15,23,42,.08); border-radius:18px; background:#fff; padding:16px; box-shadow:0 18px 40px rgba(15,23,42,.08); }
h2{ margin:0 0 12px; font-size:18px; color:#123a6d; } p{ margin:4px 0 0; color:#64748b; }
.form-grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.form-grid.three{ grid-template-columns:1fr 1.2fr 2fr; }
label{ display:grid; gap:6px; color:#123a6d; font-weight:700; font-size:12px; }
input,textarea,select{ border:1px solid #dbe3ee; border-radius:10px; padding:10px; font:inherit; color:#0f172a; background:#fff; }
textarea{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; }
.switch-row{ display:flex; align-items:center; gap:8px; }
.ai-switch{ display:inline-flex; grid-template-columns:none; align-items:center; gap:8px; color:#123a6d; font-size:12px; font-weight:700; cursor:pointer; }
.ai-switch input{ position:absolute; width:1px; height:1px; padding:0; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
.ai-switch-track{ width:38px; height:22px; flex:0 0 38px; display:flex; align-items:center; border-radius:999px; padding:3px; box-sizing:border-box; background:#cbd5e1; transition:background .18s ease,box-shadow .18s ease; }
.ai-switch-track span{ width:16px; height:16px; border-radius:50%; background:#fff; box-shadow:0 1px 4px rgba(15,23,42,.2); transition:transform .18s ease; }
.ai-switch input:checked + .ai-switch-track{ background:#86efac; }
.ai-switch input:checked + .ai-switch-track span{ transform:translateX(16px); }
.ai-switch input:focus-visible + .ai-switch-track{ box-shadow:0 0 0 3px rgba(30,78,139,.18); }
.document-module-actions{ display:flex; align-items:center; justify-content:flex-end; gap:12px; flex-wrap:wrap; }
.input-action{ display:grid; grid-template-columns:1fr auto auto; gap:8px; }
button{ border-radius:999px; border:1px solid #dbe3ee; background:#fff; padding:8px 12px; cursor:pointer; font-weight:700; font-size:12px; }
.primary-btn{ background:#1e4e8b; border-color:#1e4e8b; color:#fff; }.secondary-btn{ background:#fff; }.danger-btn{ color:#991b1b; background:#fee2e2; border-color:#fecaca; }
.test-connection-btn{ min-width:116px; display:inline-flex; align-items:center; justify-content:center; gap:7px; }
.test-connection-btn:disabled{ opacity:.65; cursor:not-allowed; }
.button-spinner{ width:12px; height:12px; border:2px solid #bfdbfe; border-top-color:#1e4e8b; border-radius:50%; animation:admin-spin .7s linear infinite; }
@keyframes admin-spin{ to{ transform:rotate(360deg); } }
.admin-actions,.section-head,.package-head{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
.admin-actions{ margin-top:14px; }
.connection-actions{ display:flex; align-items:center; justify-content:flex-end; gap:12px; min-width:0; }
.health-pill{ display:inline-flex; border-radius:999px; padding:6px 10px; font-weight:700; font-size:12px; background:#f1f5f9; color:#334155; }
.health-pill.online{ background:#dcfce7; color:#166534; }.health-pill.offline{ background:#fee2e2; color:#991b1b; }
.health-pill.unauthorized{ background:#fef3c7; color:#92400e; }
.document-module-grid{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
.document-module-card{ border:1px solid #e2e8f0; border-radius:14px; background:#fff; padding:14px; display:grid; gap:12px; text-align:left; color:#0f172a; box-shadow:0 10px 24px rgba(15,23,42,.04); transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
.document-module-card:hover{ transform:translateY(-2px); border-color:rgba(30,78,139,.35); box-shadow:0 16px 34px rgba(15,23,42,.1); }
.document-module-card h3{ margin:0; color:#123a6d; font-size:16px; }
.document-module-card p{ min-height:38px; }
.document-module-card.add-card{ align-content:center; justify-items:start; border-style:dashed; background:#f8fafc; color:#1e4e8b; }
.document-module-card.add-card strong{ font-size:15px; }
.document-module-card.add-card span{ color:#64748b; font-weight:600; }
.document-module-top{ display:flex; justify-content:space-between; align-items:center; gap:8px; }
.module-status,.module-schema-status{ display:inline-flex; border-radius:999px; padding:4px 8px; font-size:11px; font-weight:800; background:#fee2e2; color:#991b1b; }
.module-status.active{ background:#dcfce7; color:#166534; }
.module-schema-status{ background:#f1f5f9; color:#334155; }
.module-meta{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
.module-meta span{ border:1px solid #e2e8f0; border-radius:10px; padding:8px; display:grid; gap:2px; color:#64748b; font-size:11px; font-weight:700; }
.module-meta b{ color:#123a6d; font-size:14px; }
.module-meta.vertical{ grid-template-columns:1fr; margin-top:12px; }
.module-editor-card{ display:grid; gap:14px; }
.module-editor-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
.module-editor-head h2{ margin-top:8px; }
.module-editor-actions{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
.back-btn{ border:0; padding:0; color:#1e4e8b; background:transparent; border-radius:0; }
.module-editor-body{ display:block; }
.schema-editor{ display:grid; gap:6px; }
.schema-editor-head{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
.schema-editor-head label{ display:block; }
.schema-editor-tools{ display:flex; align-items:center; justify-content:flex-end; gap:8px; }
.schema-view-switch{ display:inline-flex; align-items:center; border:1px solid #dbe3ee; border-radius:999px; padding:3px; background:#f1f5f9; }
.schema-view-switch button{ border:0; border-radius:999px; padding:6px 12px; background:transparent; color:#64748b; box-shadow:none; }
.schema-view-switch button.active{ background:#1e4e8b; color:#fff; }
.schema-editor textarea{ width:100%; box-sizing:border-box; resize:vertical; }
.schema-block-editor{ display:grid; gap:10px; }
.schema-block-summary{ display:flex; align-items:center; justify-content:space-between; gap:12px; border-bottom:1px solid #e2e8f0; padding:4px 0 10px; color:#64748b; font-size:12px; }
.schema-block-summary b{ color:#123a6d; }
.schema-block-list{ display:grid; gap:8px; }
.schema-block{ border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; background:#fff; transition:border-color .18s ease,box-shadow .18s ease; }
.schema-block.expanded{ border-color:#93b4dc; box-shadow:0 8px 22px rgba(15,23,42,.06); }
.schema-block-head{ min-height:52px; display:grid; grid-template-columns:minmax(0,1fr) auto auto; align-items:center; gap:10px; padding:7px 9px; background:#f8fafc; }
.schema-block-toggle{ min-width:0; display:flex; align-items:center; gap:8px; border:0; border-radius:7px; padding:4px; background:transparent; text-align:left; }
.schema-block-chevron{ width:20px; height:20px; flex:0 0 20px; display:grid; place-items:center; color:#1e4e8b; font-size:20px; transition:transform .18s ease; }
.schema-block-chevron.expanded{ transform:rotate(90deg); }
.schema-block-title{ min-width:0; display:grid; gap:2px; }
.schema-block-title b{ overflow:hidden; color:#123a6d; font-size:13px; text-overflow:ellipsis; white-space:nowrap; }
.schema-block-title small{ overflow:hidden; color:#64748b; font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
.required-field-pill{ display:inline-flex; align-items:center; border:1px solid #bfdbfe; border-radius:999px; padding:4px 8px; background:#dbeafe; color:#1d4ed8; box-shadow:none; font-size:10px; font-weight:800; white-space:nowrap; }
.required-field-pill.optional{ border-color:#e2e8f0; background:#f1f5f9; color:#64748b; }
.schema-block-actions{ display:flex; align-items:center; gap:5px; }
.schema-block-actions button{ width:28px; height:28px; display:grid; place-items:center; border-radius:7px; padding:0; color:#475569; }
.schema-block-actions button:disabled{ opacity:.3; cursor:not-allowed; }
.schema-block-actions .remove{ border-color:#fecaca; background:#fee2e2; color:#991b1b; font-size:11px; }
.schema-block-content{ display:grid; gap:12px; border-top:1px solid #e2e8f0; padding:12px; }
.schema-block-grid{ display:grid; grid-template-columns:1fr 1.4fr .8fr 1fr; gap:10px; }
.schema-block-content select{ min-height:38px; padding:8px 10px; }
.required-toggle{ display:flex; align-items:center; gap:8px; justify-self:start; }
.item-schema-editor{ display:grid; gap:8px; border:1px solid #e2e8f0; border-radius:10px; padding:10px; background:#f8fafc; }
.item-schema-head{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
.item-schema-head>div{ display:grid; gap:2px; color:#123a6d; font-size:12px; }
.item-schema-head small{ color:#64748b; font-weight:600; }
.item-schema-head button{ color:#1e4e8b; }
.item-schema-row{ display:grid; grid-template-columns:1fr 1fr 34px; gap:8px; }
.item-schema-row button{ width:34px; height:38px; display:grid; place-items:center; border-color:#fecaca; border-radius:8px; padding:0; background:#fee2e2; color:#991b1b; font-size:11px; }
.item-schema-editor p{ font-size:11px; }
.empty-schema-blocks{ min-height:90px; border:1px dashed #93b4dc; border-radius:10px; background:#eff6ff; color:#1e4e8b; }
.schema-validation-errors{ border:1px solid #fecaca; border-radius:10px; padding:10px 12px; background:#fef2f2; color:#991b1b; font-size:12px; }
.schema-validation-errors ul{ margin:6px 0 0; padding-left:18px; }
.rules-modal-backdrop{ position:fixed; inset:0; z-index:1250; display:grid; place-items:center; padding:20px; background:rgba(15,23,42,.38); backdrop-filter:blur(3px); }
.rules-modal{ width:min(820px,100%); max-height:min(760px,calc(100vh - 40px)); overflow:auto; border:1px solid #e2e8f0; border-radius:16px; background:#fff; box-shadow:0 28px 80px rgba(15,23,42,.28); }
.rules-modal>header{ position:sticky; top:0; z-index:1; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; padding:16px 18px; border-bottom:1px solid #e2e8f0; background:#fff; }
.rules-modal>header h3{ margin:0; color:#123a6d; font-size:17px; }
.rules-modal>header p{ font-size:12px; }
.modal-close-btn{ width:32px; height:32px; padding:0; display:grid; place-items:center; color:#475569; font-size:14px; }
.schema-guide{ padding:18px; background:#f8fafc; }
.schema-guide h3{ margin:0 0 6px; color:#123a6d; font-size:14px; }
.schema-guide h4{ margin:14px 0 0; color:#334155; font-size:12px; }
.schema-guide pre{ margin:12px 0 0; border-radius:12px; background:#0f172a; color:#e2e8f0; padding:12px; overflow:auto; font-size:11px; }
.rules-examples{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.rules-modal-content>.module-meta{ margin-top:14px; }
.feedback-card ul{ color:#991b1b; font-weight:700; margin:0; }
.success-modal-backdrop{ position:fixed; inset:0; z-index:1200; display:grid; place-items:center; padding:20px; background:rgba(15,23,42,.18); backdrop-filter:blur(2px); }
.success-modal{ width:min(360px,100%); display:flex; align-items:center; gap:12px; border:1px solid #bbf7d0; border-radius:14px; padding:16px; background:#fff; box-shadow:0 24px 64px rgba(15,23,42,.2); }
.success-modal-icon{ width:38px; height:38px; flex:0 0 38px; display:grid; place-items:center; border-radius:50%; background:#dcfce7; color:#15803d; font-size:20px; font-weight:800; }
.success-modal strong{ display:block; color:#123a6d; font-size:14px; }
.success-modal p{ margin-top:3px; color:#475569; font-size:12px; }
.success-modal-enter-active,.success-modal-leave-active{ transition:opacity .18s ease; }
.success-modal-enter-active .success-modal,.success-modal-leave-active .success-modal{ transition:transform .18s ease,opacity .18s ease; }
.success-modal-enter-from,.success-modal-leave-to{ opacity:0; }
.success-modal-enter-from .success-modal,.success-modal-leave-to .success-modal{ opacity:0; transform:translateY(8px) scale(.98); }
@media(max-width:1100px){ .document-module-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); }.schema-block-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media(max-width:900px){ .admin-page{ padding:86px 14px 20px; }.form-grid,.form-grid.three,.document-module-grid,.rules-examples,.schema-block-grid{ grid-template-columns:1fr; }.section-head,.admin-actions,.module-editor-head,.schema-editor-head{ align-items:flex-start; flex-direction:column; }.document-module-actions{ width:100%; justify-content:space-between; }.schema-editor-tools{ width:100%; justify-content:space-between; }.schema-block-head{ grid-template-columns:minmax(0,1fr) auto; }.schema-block-actions{ grid-column:1/-1; justify-content:flex-end; }.connection-actions{ width:100%; justify-content:space-between; flex-wrap:wrap; } .module-editor-actions{ justify-content:flex-start; } }
</style>
