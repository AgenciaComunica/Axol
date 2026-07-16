<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import SideMenu from '@/components/SideMenu.vue'
import TablePagination from '@/components/TablePagination.vue'
import {
  createExtractionBatch,
  ExtractorApiError,
  getExtractionBatch,
  getExtractionBatchItemResult,
} from '@/utils/smartDocExtractorApi'
import {
  applyFallbackAliases,
  defaultExtractorConfig,
  extractorConfigKey,
  extractorFeedbackKey,
  extractorLogsKey,
  loadJson,
  normalizeApiResponse,
  normalizeExtractorConfig,
  parsePackageSchema,
  resolveExtractionStatus,
  saveJson,
  type ExtractedField,
  type ExtractionLog,
  type ExtractorConfig,
  type ExtractorFeedback,
} from '@/utils/smartDocExtractor'

const router = useRouter()
const config = ref<ExtractorConfig>(defaultExtractorConfig())
const logs = ref<ExtractionLog[]>([])
const feedbacks = ref<ExtractorFeedback[]>([])
const selectedIds = ref<string[]>([])
const newModalOpen = ref(false)
const jsonModalLog = ref<ExtractionLog | null>(null)
const reviewLog = ref<ExtractionLog | null>(null)
const selectedFiles = ref<File[]>([])
const selectedPackageId = ref('')
const schemaDraft = ref('')
const submitError = ref('')
const isSubmitting = ref(false)
const activeUploadLogIds = ref<string[]>([])
const fieldsExpanded = ref(false)
const actionMenuLog = ref<ExtractionLog | null>(null)
const actionMenuPosition = ref({ top: 0, left: 0 })
const logPendingDeletion = ref<ExtractionLog | null>(null)
const fallbackEditorField = ref<{ packageId: string; key: string; label: string } | null>(null)
const fallbackDraft = ref<string[]>([])
const draggedFallbackIndex = ref<number | null>(null)
const fallbackDropIndex = ref<number | null>(null)
const fallbackConfiguredKeys = ref<string[]>([])
const missingShortcutPage = ref(0)
const bulkDeletionPending = ref(false)
const sortMenuOpen = ref(false)
const reportSearchQuery = ref('')
const sortField = ref('createdAt')
const sortDirection = ref<'asc' | 'desc'>('desc')
const page = ref(1)
const rowsPerPage = ref(10)
const rowsPerPageOptions = [10, 20, 30, 50]
const compactFieldLimit = 8
const missingShortcutPageSize = 5
const activeBatchPolls = new Set<string>()
let viewActive = false
const extractionFieldOptions = [
  { value: 'fileName', label: 'Arquivo' },
  { value: 'packageName', label: 'Tipo de Documento' },
  { value: 'status', label: 'Status' },
  { value: 'extractionPercent', label: '% extração' },
  { value: 'qualityScore', label: 'Score' },
  { value: 'required', label: 'Obrigatórios' },
  { value: 'createdAt', label: 'Data/hora' },
]

const activePackages = computed(() => config.value.packages.filter((pkg) => pkg.active))
const selectedPackage = computed(() => activePackages.value.find((pkg) => pkg.id === selectedPackageId.value) || activePackages.value[0])
const selectedSchemaFields = computed(() => {
  try {
    return selectedPackage.value
      ? applyFallbackAliases(parsePackageSchema({ ...selectedPackage.value, schemaText: schemaDraft.value }), selectedPackage.value.id, feedbacks.value)
      : []
  } catch {
    return []
  }
})
const visibleSchemaFields = computed(() =>
  fieldsExpanded.value ? selectedSchemaFields.value : selectedSchemaFields.value.slice(0, compactFieldLimit)
)
const hiddenSchemaFieldCount = computed(() => Math.max(0, selectedSchemaFields.value.length - compactFieldLimit))
const selectedFilesLabel = computed(() => {
  if (!selectedFiles.value.length) return 'Nenhum arquivo selecionado'
  if (selectedFiles.value.length === 1) return selectedFiles.value[0]?.name || '1 arquivo selecionado'
  return `${selectedFiles.value.length} arquivos selecionados`
})
const activeUploadLogs = computed(() => activeUploadLogIds.value
  .map((id) => logs.value.find((log) => log.id === id))
  .filter((log): log is ExtractionLog => Boolean(log)))
const acceptedUploadCount = computed(() => activeUploadLogs.value.filter((log) => log.status === 'Processando').length)
const canBulkSync = computed(() => {
  const selected = logs.value.filter((log) => selectedIds.value.includes(log.id))
  return selected.length > 0 && selected.every((log) => log.status === 'Pronto para sincronizar')
})
const orderedLogs = computed(() => [...logs.value]
  .filter((log) => log.fileName.toLocaleLowerCase('pt-BR').includes(reportSearchQuery.value.trim().toLocaleLowerCase('pt-BR')))
  .sort((left, right) => compareLogs(left, right)))
const totalPages = computed(() => Math.max(1, Math.ceil(orderedLogs.value.length / rowsPerPage.value)))
const visibleLogs = computed(() => {
  const start = (page.value - 1) * rowsPerPage.value
  return orderedLogs.value.slice(start, start + rowsPerPage.value)
})
const pageRangeLabel = computed(() => {
  const total = orderedLogs.value.length
  if (!total) return '0 de 0'
  const start = (page.value - 1) * rowsPerPage.value + 1
  return `${start}-${Math.min(page.value * rowsPerPage.value, total)} de ${total}`
})
const allVisibleLogsSelected = computed(() => visibleLogs.value.length > 0 && visibleLogs.value.every((log) => selectedIds.value.includes(log.id)))
const missingReviewFields = computed(() => reviewLog.value?.fields.filter((field) => isMissingReviewField(field)) || [])
const missingShortcutPageCount = computed(() => Math.ceil(missingReviewFields.value.length / missingShortcutPageSize))
const visibleMissingShortcuts = computed(() => {
  const start = missingShortcutPage.value * missingShortcutPageSize
  return missingReviewFields.value.slice(start, start + missingShortcutPageSize)
})

onMounted(() => {
  viewActive = true
  reloadExtractorConfig()
  logs.value = loadJson(extractorLogsKey, [])
  const interruptedUploads = logs.value.some((log) => log.status === 'Enviando' && !log.batchId)
  if (interruptedUploads) {
    logs.value = logs.value.map((log) => log.status === 'Enviando' && !log.batchId
      ? { ...log, status: 'Erro', errorMessage: 'Envio interrompido antes da confirmação da API.' }
      : log)
    persistLogs()
  }
  feedbacks.value = loadJson(extractorFeedbackKey, [])
  resumePendingBatches()
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  viewActive = false
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

onBeforeRouteLeave(() => {
  if (!isSubmitting.value) return true
  return window.confirm('Os arquivos ainda estão sendo enviados. Aguarde a conclusão antes de sair desta página. Deseja sair mesmo assim?')
})

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!isSubmitting.value) return
  event.preventDefault()
  event.returnValue = true
}

watch([reportSearchQuery, sortField, sortDirection, rowsPerPage], () => {
  page.value = 1
})

watch(totalPages, (value) => {
  page.value = Math.min(page.value, value)
})

function reloadExtractorConfig() {
  config.value = normalizeExtractorConfig(loadJson(extractorConfigKey, defaultExtractorConfig()))
  saveJson(extractorConfigKey, config.value)
}

function persistLogs() {
  saveJson(extractorLogsKey, logs.value)
}

function persistFeedbacks() {
  saveJson(extractorFeedbackKey, feedbacks.value)
}

function openNewExtraction() {
  reloadExtractorConfig()
  const first = activePackages.value[0]
  selectedPackageId.value = first?.id || ''
  schemaDraft.value = first?.schemaText || '[]'
  selectedFiles.value = []
  fieldsExpanded.value = false
  submitError.value = ''
  newModalOpen.value = true
}

function onPackageChange() {
  if (selectedPackage.value) schemaDraft.value = selectedPackage.value.schemaText
  fieldsExpanded.value = false
}

function onFileChange(event: Event) {
  selectedFiles.value = Array.from((event.target as HTMLInputElement).files || [])
}

function toggleSelected(id: string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((item) => item !== id)
    : [...selectedIds.value, id]
}

function toggleAllVisibleLogs() {
  const visibleIds = new Set(visibleLogs.value.map((log) => log.id))
  if (allVisibleLogsSelected.value) {
    selectedIds.value = selectedIds.value.filter((id) => !visibleIds.has(id))
    return
  }
  selectedIds.value = Array.from(new Set([...selectedIds.value, ...visibleIds]))
}

function logFieldValue(log: ExtractionLog, field: string) {
  if (field === 'status') return statusLabel(log.status)
  if (field === 'qualityScore') return Math.round(log.qualityScore * 100)
  if (field === 'required') return `${log.requiredFound}/${log.requiredTotal}`
  return (log as unknown as Record<string, unknown>)[field]
}

function comparableNumber(value: unknown) {
  const parsed = Number(String(value ?? '').trim().replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function compareLogs(left: ExtractionLog, right: ExtractionLog) {
  const leftValue = logFieldValue(left, sortField.value)
  const rightValue = logFieldValue(right, sortField.value)
  let result = 0
  if (sortField.value === 'createdAt') {
    result = new Date(String(leftValue)).getTime() - new Date(String(rightValue)).getTime()
  } else {
    const leftNumber = comparableNumber(leftValue)
    const rightNumber = comparableNumber(rightValue)
    result = leftNumber != null && rightNumber != null
      ? leftNumber - rightNumber
      : String(leftValue ?? '').localeCompare(String(rightValue ?? ''), 'pt-BR', { sensitivity: 'base' })
  }
  return sortDirection.value === 'asc' ? result : -result
}

function requestSelectedDeletion() {
  if (!selectedIds.value.length) return
  bulkDeletionPending.value = true
}

function deleteSelectedLogs() {
  const selected = new Set(selectedIds.value)
  logs.value = logs.value.filter((log) => !selected.has(log.id))
  selectedIds.value = []
  persistLogs()
  bulkDeletionPending.value = false
}

function toggleActionMenu(event: MouseEvent, log: ExtractionLog) {
  if (actionMenuLog.value?.id === log.id) {
    actionMenuLog.value = null
    return
  }
  const trigger = event.currentTarget as HTMLElement
  const rect = trigger.getBoundingClientRect()
  const menuWidth = 176
  const menuHeight = 172
  const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8)
  let top = rect.bottom + 6
  if (top + menuHeight > window.innerHeight - 8) top = Math.max(8, rect.top - menuHeight - 6)
  actionMenuPosition.value = { top, left }
  actionMenuLog.value = log
}

function closeActionMenu() {
  actionMenuLog.value = null
}

function requestLogDeletion(log: ExtractionLog) {
  logPendingDeletion.value = log
  closeActionMenu()
}

function deleteLog() {
  const log = logPendingDeletion.value
  if (!log) return
  logs.value = logs.value.filter((item) => item.id !== log.id)
  selectedIds.value = selectedIds.value.filter((id) => id !== log.id)
  if (jsonModalLog.value?.id === log.id) jsonModalLog.value = null
  if (reviewLog.value?.id === log.id) reviewLog.value = null
  persistLogs()
  logPendingDeletion.value = null
}

function scoreLabel(score: number) {
  if (score >= 0.85) return 'Alto'
  if (score >= 0.65) return 'Médio'
  return 'Baixo'
}

function scoreClass(score: number) {
  if (score >= 0.85) return 'tone-good'
  if (score >= 0.65) return 'tone-warn'
  return 'tone-bad'
}

function statusLabel(status: ExtractionLog['status']) {
  if (status === 'Erro de autenticação') return 'Autenticação'
  if (status === 'Revisão necessária') return 'Revisar'
  if (status === 'Pronto para sincronizar') return 'Sincronizável'
  if (status === 'Erro') return 'Insuficiente'
  return status
}

function statusClass(status: ExtractionLog['status']) {
  if (status === 'Erro de autenticação') return 'status-auth'
  if (status === 'Enviando') return 'status-sent'
  if (status === 'Revisão necessária') return 'status-review'
  if (status === 'Pronto para sincronizar') return 'status-syncable'
  if (status === 'Sincronizado') return 'status-synced'
  if (status === 'Erro') return 'status-insufficient'
  return 'status-processing'
}

async function executeExtraction() {
  reloadExtractorConfig()
  if (!selectedFiles.value.length || !selectedPackage.value) {
    submitError.value = 'Selecione ao menos um PDF e um tipo de documento.'
    return
  }
  if (!config.value.apiBaseUrl || !config.value.apiKey) {
    submitError.value = 'Configure URL da API e API Key em Configurações > Extrator de Dados.'
    return
  }

  let schema
  try {
    schema = applyFallbackAliases(parsePackageSchema({ ...selectedPackage.value, schemaText: schemaDraft.value }), selectedPackage.value.id, feedbacks.value)
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : 'Schema inválido.'
    return
  }

  const files = [...selectedFiles.value]
  const pkg = selectedPackage.value
  const apiOptions = {
    apiBaseUrl: config.value.apiBaseUrl.trim(),
    apiKey: config.value.apiKey.trim(),
  }
  const useLlm = config.value.useLlm
  const analysisPackage = resolveApiPackage(pkg.id, pkg.name)
  const timestamp = Date.now()
  const uploadLogs = files.map((file, index) => ({
    id: `upload-${timestamp.toString(36)}-${index}`,
    fileName: file.name,
    packageId: pkg.id,
    packageName: pkg.name,
    status: 'Enviando',
    extractionPercent: 0,
    qualityScore: 0,
    requiredFound: 0,
    requiredTotal: schema.filter((field) => field.required).length,
    createdAt: new Date(timestamp + index).toISOString(),
    fields: [],
    missingFields: [],
  } satisfies ExtractionLog))
  logs.value = [...uploadLogs, ...logs.value]
  activeUploadLogIds.value = uploadLogs.map((log) => log.id)
  persistLogs()
  isSubmitting.value = true
  submitError.value = ''
  newModalOpen.value = false

  try {
    const acceptedBatchIds: string[] = []
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const uploadLog = uploadLogs[index]
      if (!file || !uploadLog) continue
      try {
        const batch = await createExtractionBatch(apiOptions, {
          files: [file],
          fields: schema,
          analysisPackage,
          useLlm,
        })
        const batchItem = batch.items?.[0] || batch.items?.find((item) => item.file_name === file.name)
        updateLog(uploadLog.id, {
          batchId: batch.batch_id,
          batchItemId: batchItem?.item_id,
          status: 'Processando',
          createdAt: batchItem?.created_at || uploadLog.createdAt,
          errorMessage: undefined,
          apiErrorEndpoint: undefined,
        })
        acceptedBatchIds.push(batch.batch_id)
      } catch (error) {
        updateLog(uploadLog.id, {
          status: error instanceof ExtractorApiError && error.status === 401 ? 'Erro de autenticação' : 'Erro',
          errorMessage: extractionRequestErrorMessage(error, file),
          rawResponse: error instanceof ExtractorApiError ? error.responseBody : undefined,
          apiErrorEndpoint: error instanceof ExtractorApiError ? error.endpoint : '/batches',
        })
      }
    }
    acceptedBatchIds.forEach((batchId) => void pollBatch(batchId))
    selectedFiles.value = []
  } finally {
    isSubmitting.value = false
  }
}

function extractionRequestErrorMessage(error: unknown, file: File) {
  if (error instanceof ExtractorApiError && error.status === 401) return 'API Key ausente ou inválida.'
  if (error instanceof ExtractorApiError && error.responseBody) return error.message
  const message = error instanceof Error ? error.message : 'Falha de rede.'
  return `${message} ao enviar ${file.name}. A API pode ter encerrado a requisição com erro 5xx sem headers CORS.`
}

function resumePendingBatches() {
  const batchIds = new Set(
    logs.value
      .filter((log) => log.status === 'Processando' && log.batchId)
      .map((log) => log.batchId as string),
  )
  batchIds.forEach((batchId) => void pollBatch(batchId))
}

async function pollBatch(batchId: string) {
  if (activeBatchPolls.has(batchId)) return
  activeBatchPolls.add(batchId)
  try {
    while (viewActive) {
      try {
        reloadExtractorConfig()
        const apiOptions = { apiBaseUrl: config.value.apiBaseUrl, apiKey: config.value.apiKey }
        const batch = await getExtractionBatch(apiOptions, batchId)
        if (batch.status === 'failed') {
          logs.value = logs.value.map((log) => log.batchId === batchId && log.status === 'Processando'
            ? { ...log, status: 'Erro', errorMessage: 'A API não conseguiu processar o lote.' }
            : log)
          persistLogs()
          return
        }
        for (const item of batch.items) {
          const log = logs.value.find((entry) => entry.batchId === batchId && entry.batchItemId === item.item_id)
          if (!log || log.status !== 'Processando') continue
          if (item.status === 'queued') {
            updateLog(log.id, { status: 'Processando', errorMessage: undefined, apiErrorEndpoint: undefined })
            continue
          }
          if (item.status === 'processing') {
            updateLog(log.id, { status: 'Processando', errorMessage: undefined, apiErrorEndpoint: undefined })
            continue
          }
          if (item.status === 'failed') {
            updateLog(log.id, { status: 'Erro', errorMessage: item.error || 'A API não conseguiu processar este arquivo.' })
            continue
          }
          if (item.status === 'completed' && item.result_available) {
            let response
            try {
              response = await getExtractionBatchItemResult(apiOptions, batchId, item.item_id)
            } catch (error) {
              if (error instanceof ExtractorApiError && error.status === 401) {
                updateLog(log.id, {
                  errorMessage: 'API Key ausente ou inválida.',
                  apiErrorEndpoint: error.endpoint,
                  rawResponse: error.responseBody,
                })
                continue
              }
              if (error instanceof ExtractorApiError && error.responseBody) {
                updateLog(log.id, {
                  status: 'Erro',
                  errorMessage: error.message,
                  rawResponse: error.responseBody,
                  apiErrorEndpoint: error.endpoint,
                })
                continue
              }
              throw error
            }
            const pkg = config.value.packages.find((entry) => entry.id === log.packageId)
            if (!pkg) {
              updateLog(log.id, { status: 'Erro', errorMessage: 'Módulo de documento não encontrado.' })
              continue
            }
            const schema = applyFallbackAliases(parsePackageSchema(pkg), pkg.id, feedbacks.value)
            const normalized = normalizeApiResponse(response, schema)
            updateLog(log.id, {
              ...normalized,
              rawResponse: response,
              errorMessage: undefined,
              apiErrorEndpoint: undefined,
              status: resolveExtractionStatus({ ...log, ...normalized, status: 'Pendente' }),
            })
          }
        }
        const terminal = ['completed', 'completed_with_errors', 'failed'].includes(batch.status)
        const stillProcessing = logs.value.some((log) => log.batchId === batchId && log.status === 'Processando')
        if (terminal && !stillProcessing) return
      } catch (error) {
        const isAuthenticationError = error instanceof ExtractorApiError && error.status === 401
        const message = isAuthenticationError ? 'API Key ausente ou inválida.' : error instanceof Error ? error.message : 'Falha ao consultar o lote.'
        logs.value = logs.value.map((log) => log.batchId === batchId && log.status === 'Processando'
          ? {
              ...log,
              errorMessage: isAuthenticationError ? message : `Aguardando reconexão: ${message}`,
              apiErrorEndpoint: error instanceof ExtractorApiError ? error.endpoint : `/batches/${batchId}`,
            }
          : log)
        persistLogs()
      }
      await waitForBatchPoll(2500)
    }
  } finally {
    activeBatchPolls.delete(batchId)
  }
}

function waitForBatchPoll(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function resolveApiPackage(packageId: string, packageName: string) {
  const identity = `${packageId} ${packageName}`.toLocaleLowerCase('pt-BR')
  if (identity.includes('fisico') || identity.includes('físico') || identity.includes('rota')) return 'fisico'
  if (identity.includes('quimico') || identity.includes('químico') || identity.includes('óleo') || identity.includes('oleo')) return 'quimico'
  return packageId
}

function updateLog(id: string, patch: Partial<ExtractionLog>) {
  logs.value = logs.value.map((log) => (log.id === id ? { ...log, ...patch } : log))
  persistLogs()
}

function openReview(log: ExtractionLog) {
  reloadExtractorConfig()
  const review = JSON.parse(JSON.stringify(log)) as ExtractionLog
  review.fields = review.fields.map((field) => ({
    ...field,
    manualValue: isMissingReviewField(field) ? 'Não Encontrado' : formatReviewValue(field.value),
  }))
  const pkg = config.value.packages.find((item) => item.id === review.packageId)
  fallbackConfiguredKeys.value = pkg
    ? parsePackageSchema(pkg).filter((field) => field.aliases.length > 0).map((field) => field.key)
    : []
  missingShortcutPage.value = 0
  reviewLog.value = review
}

function isMissingReviewField(field: ExtractedField) {
  return field.value == null
    || field.value === ''
    || ['not_found', 'empty', 'invalid_format', 'error'].includes(field.status || '')
}

function formatReviewValue(value: unknown) {
  if (value == null || value === '') return 'Não Encontrado'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function hasReviewValue(field: ExtractedField) {
  const value = field.manualValue?.trim()
  return Boolean(value && value !== 'Não Encontrado')
}

function reviewFieldState(field: ExtractedField) {
  if (hasReviewValue(field)) return 'complete'
  return field.required ? 'required-missing' : 'missing'
}

function missingShortcutState(field: ExtractedField) {
  const hasFallback = fallbackConfiguredKeys.value.includes(field.key)
  if (hasReviewValue(field)) return 'complete'
  if (hasFallback) return 'configured'
  return field.required ? 'required-missing' : 'missing'
}

function focusReviewField(field: ExtractedField) {
  const input = document.getElementById(`review-${field.key}`)
  input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  window.setTimeout(() => input?.focus(), 250)
}

function openFallbackEditor(field: ExtractedField) {
  if (!reviewLog.value) return
  reloadExtractorConfig()
  const pkg = config.value.packages.find((item) => item.id === reviewLog.value?.packageId)
  const schemaField = pkg ? parsePackageSchema(pkg).find((item) => item.key === field.key) : null
  fallbackEditorField.value = {
    packageId: reviewLog.value.packageId,
    key: field.key,
    label: schemaField?.label || field.label,
  }
  fallbackDraft.value = [...(schemaField?.aliases || [])]
}

function addFallback() {
  fallbackDraft.value.push('')
}

function removeFallback(index: number) {
  fallbackDraft.value.splice(index, 1)
}

function startFallbackDrag(event: DragEvent, index: number) {
  draggedFallbackIndex.value = index
  fallbackDropIndex.value = index
  const row = (event.currentTarget as HTMLElement).closest('.fallback-row') as HTMLElement | null
  if (row && event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
    event.dataTransfer.setDragImage(row, 24, row.offsetHeight / 2)
  }
}

function enterFallbackDropZone(index: number) {
  if (draggedFallbackIndex.value != null) fallbackDropIndex.value = index
}

function finishFallbackDrag() {
  draggedFallbackIndex.value = null
  fallbackDropIndex.value = null
}

function dropFallback(index: number) {
  const fromIndex = draggedFallbackIndex.value
  finishFallbackDrag()
  if (fromIndex == null || fromIndex === index) return
  const [movedItem] = fallbackDraft.value.splice(fromIndex, 1)
  if (movedItem != null) fallbackDraft.value.splice(index, 0, movedItem)
}

function saveFallbacks() {
  const editor = fallbackEditorField.value
  if (!editor) return
  reloadExtractorConfig()
  const pkg = config.value.packages.find((item) => item.id === editor.packageId)
  if (!pkg) return

  const aliases = fallbackDraft.value
    .map((alias) => alias.trim())
    .filter((alias, index, list) => alias && list.findIndex((item) => item.toLocaleLowerCase('pt-BR') === alias.toLocaleLowerCase('pt-BR')) === index)
  const schema = parsePackageSchema(pkg).map((field) => field.key === editor.key ? { ...field, aliases } : field)
  pkg.schemaText = JSON.stringify(schema, null, 2)
  config.value = normalizeExtractorConfig(config.value)
  saveJson(extractorConfigKey, config.value)
  fallbackConfiguredKeys.value = aliases.length
    ? Array.from(new Set([...fallbackConfiguredKeys.value, editor.key]))
    : fallbackConfiguredKeys.value.filter((key) => key !== editor.key)
  fallbackEditorField.value = null
  fallbackDraft.value = []
}

function closeFallbackEditor() {
  fallbackEditorField.value = null
  fallbackDraft.value = []
  finishFallbackDrag()
}

function saveReview() {
  if (!reviewLog.value) return
  const reviewed = reviewLog.value
  const fields = reviewed.fields.map((field) => {
    const manualValue = field.manualValue?.trim()
    if (!manualValue || manualValue === 'Não Encontrado') {
      return { ...field, value: null, manualValue: undefined, status: 'not_found', confidence: 0 }
    }
    if (manualValue === formatReviewValue(field.value)) return { ...field, manualValue: undefined }
    return { ...field, value: manualValue, manualValue: undefined, source: 'user_feedback', status: 'found', confidence: 1 }
  })
  const missingFields = fields.filter((field) => field.value == null || field.value === '')
  const requiredTotal = fields.filter((field) => field.required).length
  const requiredFound = fields.filter((field) => field.required && field.value != null && field.value !== '').length
  const nextLog: ExtractionLog = {
    ...reviewed,
    fields,
    missingFields,
    requiredTotal,
    requiredFound,
    extractionPercent: fields.length ? Math.round(((fields.length - missingFields.length) / fields.length) * 100) : 0,
  }
  nextLog.status = resolveExtractionStatus(nextLog)
  logs.value = logs.value.map((log) => (log.id === nextLog.id ? nextLog : log))

  persistLogs()
  reviewLog.value = null
}

function syncLog(log: ExtractionLog) {
  if (log.status !== 'Pronto para sincronizar') return
  updateLog(log.id, { status: 'Sincronizado', syncedAt: new Date().toISOString() })
}

function syncSelected() {
  if (!canBulkSync.value) return
  const now = new Date().toISOString()
  logs.value = logs.value.map((log) => selectedIds.value.includes(log.id) ? { ...log, status: 'Sincronizado', syncedAt: now } : log)
  selectedIds.value = []
  persistLogs()
}
</script>

<template>
  <SideMenu />
  <main class="extractor-page">
    <AppHeader
      eyebrow="Smart Doc Extractor"
      title="Extrações"
      subtitle="Importação assistida de dados via PDF para análises dos transformadores."
      :secondary-action="{ label: 'Configurar Extrator', icon: 'settings', onClick: () => router.push({ name: 'data-extractor-admin' }) }"
      :action="{ label: 'Voltar ao Painel', icon: 'map', onClick: () => router.push({ name: 'dashboard' }) }"
    />

    <section class="extractor-shell">
      <div class="extractor-list-head">
        <div>
          <h2>Últimas extrações</h2>
          <p>Histórico local de testes salvo no navegador.</p>
        </div>
        <button class="new-extraction-btn" type="button" @click="openNewExtraction">
          <span aria-hidden="true">＋</span>
          Nova Extração
        </button>
      </div>

      <div class="extraction-toolbar">
        <div class="toolbar-controls">
          <div class="extraction-search-wrap">
            <input v-model="reportSearchQuery" type="search" placeholder="Pesquisar relatório..." aria-label="Pesquisar relatório" />
          </div>
          <div class="sort-wrap">
            <button class="toolbar-btn" type="button" @click="sortMenuOpen = !sortMenuOpen">Ordenar por</button>
            <div v-if="sortMenuOpen" class="sort-menu-dismiss" @click="sortMenuOpen = false"></div>
            <div v-if="sortMenuOpen" class="sort-menu">
              <label class="sort-option">Coluna
                <select v-model="sortField">
                  <option v-for="option in extractionFieldOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
              </label>
              <div class="sort-option">
                <span>Ordem</span>
                <div class="sort-radio-group">
                  <label class="sort-radio-option"><input v-model="sortDirection" type="radio" value="asc" /> Crescente</label>
                  <label class="sort-radio-option"><input v-model="sortDirection" type="radio" value="desc" /> Decrescente</label>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="selectedIds.length" class="bulk-actions">
          <button class="delete-selected-btn" type="button" @click="requestSelectedDeletion">Excluir</button>
          <button class="primary-btn" type="button" :disabled="!canBulkSync" @click="syncSelected">Sincronizar</button>
        </div>
      </div>

      <div class="extractor-table-wrap">
        <table class="extractor-table">
          <thead>
            <tr>
              <th class="selection-header">
                <input
                  class="select-all-checkbox"
                  type="checkbox"
                  :checked="allVisibleLogsSelected"
                  :aria-label="allVisibleLogsSelected ? 'Desmarcar todos da página' : 'Selecionar todos da página'"
                  :title="allVisibleLogsSelected ? 'Desmarcar todos' : 'Selecionar todos'"
                  @change="toggleAllVisibleLogs"
                />
              </th>
              <th>Arquivo</th>
              <th>Tipo de Documento</th>
              <th>Status</th>
              <th>% extração</th>
              <th>Score</th>
              <th>Obrigatórios</th>
              <th>Data/hora</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in visibleLogs" :key="log.id">
              <td><input type="checkbox" :checked="selectedIds.includes(log.id)" @change="toggleSelected(log.id)" /></td>
              <td>
                <strong>{{ log.fileName }}</strong>
                <small v-if="log.status !== 'Processando' && log.errorMessage">{{ log.errorMessage }}</small>
                <small v-if="log.status !== 'Processando' && log.apiErrorEndpoint" class="api-error-endpoint">Endpoint: {{ log.apiErrorEndpoint }}</small>
              </td>
              <td>{{ log.packageName }}</td>
              <td><span class="status-pill" :class="statusClass(log.status)"><span v-if="log.status === 'Enviando' || log.status === 'Processando'" class="loading-spinner" aria-hidden="true"></span>{{ statusLabel(log.status) }}</span></td>
              <td>{{ log.extractionPercent }}%</td>
              <td><span class="score-pill" :class="scoreClass(log.qualityScore)">{{ scoreLabel(log.qualityScore) }} {{ Math.round(log.qualityScore * 100) }}%</span></td>
              <td>{{ log.requiredFound }}/{{ log.requiredTotal }}</td>
              <td>{{ new Date(log.createdAt).toLocaleString('pt-BR') }}</td>
              <td class="actions-column">
                <div class="row-actions">
                  <button class="row-menu-trigger" type="button" title="Ações" aria-label="Abrir ações da extração" :aria-expanded="actionMenuLog?.id === log.id" @click="toggleActionMenu($event, log)">⋯</button>
                </div>
              </td>
            </tr>
            <tr v-if="!visibleLogs.length">
              <td colspan="9" class="empty-cell">{{ logs.length ? 'Nenhuma extração corresponde ao filtro.' : 'Nenhuma extração executada ainda.' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <TablePagination
        :page="page"
        :total-pages="totalPages"
        :rows-per-page="rowsPerPage"
        :rows-per-page-options="rowsPerPageOptions"
        :page-range-label="pageRangeLabel"
        @update:page="page = $event"
        @update:rows-per-page="rowsPerPage = $event"
      />
    </section>

    <Teleport to="body">
      <div v-if="actionMenuLog" class="action-menu-dismiss" @click="closeActionMenu"></div>
      <div
        v-if="actionMenuLog"
        class="row-action-menu"
        :style="{ top: `${actionMenuPosition.top}px`, left: `${actionMenuPosition.left}px` }"
        role="menu"
      >
        <button class="action-item action-json" type="button" role="menuitem" @click="jsonModalLog = actionMenuLog; closeActionMenu()">
          <span class="action-icon" aria-hidden="true">📄</span>JSON
        </button>
        <button class="action-item action-review" type="button" role="menuitem" @click="openReview(actionMenuLog); closeActionMenu()">
          <span class="action-icon" aria-hidden="true">✎</span>Revisar
        </button>
        <button class="action-item action-remove" type="button" role="menuitem" @click="requestLogDeletion(actionMenuLog)">
          <span class="action-icon" aria-hidden="true">🗑</span>Excluir
        </button>
        <button class="action-item action-sync" type="button" role="menuitem" :disabled="actionMenuLog.status !== 'Pronto para sincronizar'" @click="syncLog(actionMenuLog); closeActionMenu()">
          <span class="action-icon" aria-hidden="true">↻</span>Sincronizar
        </button>
      </div>
    </Teleport>

    <div v-if="newModalOpen" class="modal-backdrop" @click="newModalOpen = false">
      <section class="extractor-modal" @click.stop>
        <header><h3>Nova extração</h3><button type="button" @click="newModalOpen = false">✕</button></header>
        <label>Tipo de Documento
          <select v-model="selectedPackageId" @change="onPackageChange">
            <option v-for="pkg in activePackages" :key="pkg.id" :value="pkg.id">{{ pkg.name }}</option>
          </select>
        </label>
        <section class="schema-preview">
          <div class="schema-preview-head">
            <span>Campos</span>
            <small>{{ selectedSchemaFields.length }} campos configurados</small>
          </div>
          <div class="schema-pill-list">
            <span
              v-for="field in visibleSchemaFields"
              :key="field.key"
              class="schema-pill"
              :class="{ required: field.required }"
              :title="field.aliases.length ? `Aliases: ${field.aliases.join(', ')}` : undefined"
            >
              {{ field.label }}
              <small>{{ field.required ? 'Obrigatório' : 'Opcional' }}</small>
            </span>
            <button
              v-if="hiddenSchemaFieldCount"
              class="schema-pill schema-toggle-pill"
              type="button"
              :aria-expanded="fieldsExpanded"
              @click="fieldsExpanded = !fieldsExpanded"
            >
              {{ fieldsExpanded ? 'Ver menos' : 'Ver todos' }}
            </button>
            <span v-if="!selectedSchemaFields.length" class="schema-empty">Nenhum campo configurado para este tipo de documento.</span>
          </div>
        </section>
        <div class="file-field">
          <span class="file-field-label">Escolher arquivo</span>
          <div class="file-picker-shell" :class="{ selected: selectedFiles.length }">
            <label class="file-picker-btn" for="extraction-pdf">Selecionar PDFs</label>
            <span class="file-picker-name" :title="selectedFiles.map((file) => file.name).join(', ')">
              {{ selectedFilesLabel }}
            </span>
            <input id="extraction-pdf" class="file-picker-input" type="file" accept="application/pdf" multiple @change="onFileChange" />
          </div>
        </div>
        <p v-if="submitError" class="error-msg">{{ submitError }}</p>
        <footer>
          <button class="secondary-btn" type="button" @click="newModalOpen = false">Cancelar</button>
          <button class="primary-btn" type="button" :disabled="isSubmitting" @click="executeExtraction">
            {{ isSubmitting ? 'Enviando...' : selectedFiles.length > 1 ? `Extrair ${selectedFiles.length} arquivos` : 'Extrair' }}
          </button>
        </footer>
      </section>
    </div>

    <div v-if="jsonModalLog" class="modal-backdrop" @click="jsonModalLog = null">
      <section class="extractor-modal wide" @click.stop>
        <header><h3>JSON retornado</h3><button type="button" @click="jsonModalLog = null">✕</button></header>
        <pre>{{ JSON.stringify(jsonModalLog.rawResponse || jsonModalLog, null, 2) }}</pre>
      </section>
    </div>

    <div v-if="logPendingDeletion" class="modal-backdrop" @click="logPendingDeletion = null">
      <section class="extractor-modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-log-title" @click.stop>
        <header><h3 id="delete-log-title">Excluir extração</h3><button type="button" @click="logPendingDeletion = null">✕</button></header>
        <p>O histórico de <strong>{{ logPendingDeletion.fileName }}</strong> será removido deste navegador.</p>
        <footer>
          <button class="secondary-btn" type="button" @click="logPendingDeletion = null">Cancelar</button>
          <button class="delete-btn" type="button" @click="deleteLog">Excluir</button>
        </footer>
      </section>
    </div>

    <div v-if="bulkDeletionPending" class="modal-backdrop" @click="bulkDeletionPending = false">
      <section class="extractor-modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-selected-title" @click.stop>
        <header><h3 id="delete-selected-title">Excluir extrações</h3><button type="button" @click="bulkDeletionPending = false">✕</button></header>
        <p>Os {{ selectedIds.length }} históricos selecionados serão removidos deste navegador.</p>
        <footer>
          <button class="secondary-btn" type="button" @click="bulkDeletionPending = false">Cancelar</button>
          <button class="delete-btn" type="button" @click="deleteSelectedLogs">Excluir</button>
        </footer>
      </section>
    </div>

    <div v-if="reviewLog" class="modal-backdrop" @click="reviewLog = null">
      <section class="extractor-modal wide" @click.stop>
        <header>
          <div class="review-modal-title">
            <h3>Revisar campos</h3>
            <span class="score-pill" :class="scoreClass(reviewLog.qualityScore)">Score {{ Math.round(reviewLog.qualityScore * 100) }}%</span>
          </div>
          <button type="button" @click="reviewLog = null">✕</button>
        </header>
        <section v-if="missingReviewFields.length" class="missing-shortcuts">
          <div class="missing-shortcuts-head">
            <strong>Campos não encontrados</strong>
            <span>{{ missingReviewFields.length }} campo(s)</span>
          </div>
          <div class="missing-shortcuts-carousel">
            <button
              v-if="missingShortcutPageCount > 1"
              class="shortcut-nav-btn"
              type="button"
              title="Campos anteriores"
              aria-label="Campos anteriores"
              :disabled="missingShortcutPage === 0"
              @click="missingShortcutPage--"
            >‹</button>
            <div class="missing-shortcut-list">
              <button
                v-for="field in visibleMissingShortcuts"
                :key="field.key"
                class="missing-shortcut-pill"
                :class="missingShortcutState(field)"
                type="button"
                @click="focusReviewField(field)"
              >
                <span aria-hidden="true">{{ missingShortcutState(field) === 'complete' ? '✓' : missingShortcutState(field) === 'required-missing' ? '✕' : '!' }}</span>
                {{ field.label }}
              </button>
            </div>
            <button
              v-if="missingShortcutPageCount > 1"
              class="shortcut-nav-btn"
              type="button"
              title="Próximos campos"
              aria-label="Próximos campos"
              :disabled="missingShortcutPage >= missingShortcutPageCount - 1"
              @click="missingShortcutPage++"
            >›</button>
          </div>
          <div v-if="missingShortcutPageCount > 1" class="shortcut-page-indicator">
            {{ missingShortcutPage + 1 }} / {{ missingShortcutPageCount }}
          </div>
        </section>
        <div class="review-grid">
          <article v-for="field in reviewLog.fields" :key="field.key" class="review-field" :class="reviewFieldState(field)">
            <label :for="`review-${field.key}`">
              <span class="review-field-state-icon" :class="reviewFieldState(field)" aria-hidden="true">
                {{ reviewFieldState(field) === 'complete' ? '✓' : reviewFieldState(field) === 'required-missing' ? '✕' : '!' }}
              </span>
              {{ field.label }} <b v-if="field.required">*</b>
            </label>
            <div class="review-value-row">
              <input :id="`review-${field.key}`" v-model="field.manualValue" />
              <button
                class="fallback-edit-btn"
                type="button"
                title="Configurar nomes alternativos para este parâmetro"
                :aria-label="`Configurar nomes alternativos para ${field.label}`"
                @click="openFallbackEditor(field)"
              >✎</button>
            </div>
          </article>
        </div>
        <footer>
          <button class="secondary-btn" type="button" @click="reviewLog = null">Cancelar</button>
          <button class="primary-btn" type="button" @click="saveReview">Salvar revisão</button>
        </footer>
      </section>
    </div>

    <div v-if="fallbackEditorField" class="modal-backdrop fallback-modal-backdrop" @click="closeFallbackEditor">
      <section class="extractor-modal fallback-modal" role="dialog" aria-modal="true" aria-labelledby="fallback-modal-title" @click.stop>
        <header>
          <div>
            <h3 id="fallback-modal-title">Configurar fallbacks</h3>
            <p>Defina os nomes alternativos na ordem em que a API deve procurá-los.</p>
          </div>
          <button type="button" @click="closeFallbackEditor">✕</button>
        </header>
        <label>Parâmetro padrão
          <input :value="fallbackEditorField.label" readonly />
          <small>Chave: {{ fallbackEditorField.key }}</small>
        </label>
        <div class="fallback-list-head">
          <span>Fallbacks</span>
          <small>{{ fallbackDraft.length }} configurado(s)</small>
        </div>
        <div v-if="fallbackDraft.length" class="fallback-list">
          <div
            v-for="(fallback, index) in fallbackDraft"
            :key="index"
            class="fallback-row"
            :class="{ dragging: draggedFallbackIndex === index, 'drop-target': fallbackDropIndex === index && draggedFallbackIndex !== index }"
            @dragenter.prevent="enterFallbackDropZone(index)"
            @dragover.prevent
            @drop="dropFallback(index)"
          >
            <span class="fallback-drag-handle" draggable="true" title="Arrastar para reordenar" aria-hidden="true" @dragstart="startFallbackDrag($event, index)" @dragend="finishFallbackDrag">⠿</span>
            <input v-model="fallbackDraft[index]" :aria-label="`Fallback ${index + 1}`" :placeholder="`Fallback ${index + 1}`" />
            <button class="fallback-icon-btn remove" type="button" title="Remover fallback" :aria-label="`Remover fallback ${index + 1}`" @click="removeFallback(index)">🗑</button>
            <button v-if="index === fallbackDraft.length - 1" class="fallback-icon-btn add" type="button" title="Adicionar fallback" aria-label="Adicionar fallback" @click="addFallback">+</button>
            <span v-else class="fallback-icon-spacer" aria-hidden="true"></span>
          </div>
        </div>
        <button v-else class="add-first-fallback" type="button" @click="addFallback">+ Adicionar fallback</button>
        <footer>
          <button class="secondary-btn" type="button" @click="closeFallbackEditor">Cancelar</button>
          <button class="primary-btn" type="button" @click="saveFallbacks">Salvar fallbacks</button>
        </footer>
      </section>
    </div>

    <Teleport to="body">
      <div v-if="isSubmitting" class="upload-lock-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="upload-lock-title">
        <section class="upload-lock-modal">
          <span class="upload-lock-spinner" aria-hidden="true"></span>
          <div class="upload-lock-content">
            <h3 id="upload-lock-title">Enviando PDFs</h3>
            <p>Não saia desta tela nem feche o navegador enquanto os arquivos estão sendo enviados.</p>
            <small>Após o envio, o processamento continuará em segundo plano.</small>
            <div class="upload-lock-progress">
              <strong>{{ acceptedUploadCount }} de {{ activeUploadLogs.length }} enviados</strong>
              <ul>
                <li v-for="log in activeUploadLogs" :key="log.id">
                  <span class="upload-file-name" :title="log.fileName">{{ log.fileName }}</span>
                  <span class="upload-file-status" :class="statusClass(log.status)">
                    <span v-if="log.status === 'Enviando' || log.status === 'Processando'" class="loading-spinner" aria-hidden="true"></span>
                    {{ statusLabel(log.status) }}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </Teleport>

  </main>
</template>

<style scoped>
.extractor-page{ min-height:100vh; padding:28px 32px; background:linear-gradient(135deg,#d8e3ec,#edf3f7 42%,#c7d5e0); }
.extractor-shell{ border:1px solid rgba(15,23,42,.08); border-radius:18px; background:#fff; padding:16px; box-shadow:0 18px 40px rgba(15,23,42,.08); }
.extractor-list-head{ display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:14px; }
.new-extraction-btn{ display:inline-flex; align-items:center; gap:7px; border:1px solid rgba(15,23,42,.12); border-radius:999px; padding:8px 14px; background:#fff; color:#1e4e8b; box-shadow:0 6px 14px rgba(15,23,42,.08); font-size:12px; font-weight:700; cursor:pointer; }
.new-extraction-btn span{ font-size:16px; line-height:1; }
.bulk-actions{ display:flex; align-items:center; justify-content:flex-end; gap:8px; }
.delete-selected-btn{ border:1px solid #fecaca; border-radius:999px; padding:8px 12px; background:#fee2e2; color:#b91c1c; font-size:12px; font-weight:700; cursor:pointer; }
.extraction-toolbar{ display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:12px; }
.toolbar-controls{ min-width:0; flex:1 1 auto; display:flex; align-items:center; gap:8px; flex-wrap:nowrap; }
.extraction-search-wrap{ min-width:0; flex:0 1 320px; }
.extraction-search-wrap input{ width:100%; height:34px; box-sizing:border-box; border:1px solid rgba(15,23,42,.12); border-radius:999px; padding:0 14px; background:rgba(255,255,255,.8); color:#334155; box-shadow:0 6px 14px rgba(15,23,42,.08); font-size:12px; outline:none; }
.extraction-search-wrap input:focus{ border-color:#93b4dc; box-shadow:0 0 0 3px rgba(30,78,139,.08); }
.toolbar-btn{ height:34px; display:inline-flex; align-items:center; gap:7px; border:1px solid rgba(15,23,42,.12); border-radius:999px; padding:0 14px; background:rgba(255,255,255,.7); color:rgba(15,23,42,.8); box-sizing:border-box; box-shadow:0 6px 14px rgba(15,23,42,.08); font-size:12px; font-weight:700; cursor:pointer; }
.sort-wrap{ position:relative; display:flex; align-items:center; }
.sort-menu-dismiss{ position:fixed; inset:0; z-index:60; }
.sort-menu{ position:absolute; left:0; top:40px; z-index:61; min-width:340px; display:grid; gap:10px; border:1px solid rgba(15,23,42,.12); border-radius:12px; padding:12px; background:#fff; box-shadow:0 16px 32px rgba(15,23,42,.12); }
.sort-option{ display:grid; gap:6px; color:rgba(15,23,42,.72); font-size:12px; font-weight:700; }
.sort-option select{ height:34px; border:1px solid rgba(15,23,42,.14); border-radius:10px; padding:0 10px; background:#fff; color:rgba(15,23,42,.86); font-size:13px; }
.sort-radio-group{ display:flex; align-items:center; gap:14px; border:1px solid rgba(15,23,42,.1); border-radius:10px; padding:8px 10px; background:#f8fafc; }
.sort-radio-option{ display:inline-flex; align-items:center; gap:7px; margin:0!important; color:rgba(15,23,42,.86)!important; font-size:12px!important; white-space:nowrap; cursor:pointer; }
.sort-radio-option input{ accent-color:#1e4e8b; }
h2{ margin:0; color:#123a6d; font-size:18px; } p{ margin:4px 0 0; color:#64748b; }
.extractor-table-wrap{ overflow:auto; }
.extractor-table{ width:100%; border-collapse:collapse; font-size:12px; }
.extractor-table th{ background:#64748b; color:#fff; font-weight:600; padding:10px; text-align:center; vertical-align:middle; }
.selection-header{ width:1%; white-space:nowrap; }
.select-all-checkbox{ width:16px; height:16px; margin:0; accent-color:#1e4e8b; cursor:pointer; vertical-align:middle; }
.extractor-table td{ padding:10px; border-bottom:1px solid #e2e8f0; text-align:center; vertical-align:middle; color:#334155; font-weight:600; }
.extractor-table tbody tr{ background:#fff; transition:background .16s ease; }
.extractor-table tbody tr:hover{ background:#f8fafc; }
.extractor-table td:nth-child(2){ color:#123a6d; font-weight:700; }
.extractor-table td:nth-child(3){ color:#475569; }
.extractor-table td:nth-child(6),.extractor-table td:nth-child(7),.extractor-table td:nth-child(8){ color:#475569; }
.extractor-table small{ display:block; color:#dc2626; margin-top:4px; }
.extractor-table .api-error-endpoint{ color:#64748b; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10px; }
.status-pill,.score-pill{ display:inline-flex; align-items:center; gap:6px; border-radius:999px; padding:4px 9px; font-weight:700; background:#f1f5f9; color:#334155; white-space:nowrap; }
.status-pill.status-processing{ background:#e2e8f0; color:#475569; }
.status-pill.status-sent{ background:#ede9fe; color:#6d28d9; }
.status-pill.status-review{ background:#fef3c7; color:#854d0e; }
.status-pill.status-syncable{ background:#dbeafe; color:#1d4ed8; }
.status-pill.status-synced{ background:#dcfce7; color:#166534; }
.status-pill.status-insufficient{ background:#fee2e2; color:#b91c1c; }
.status-pill.status-auth{ background:#ffedd5; color:#c2410c; }
.loading-spinner{ width:10px; height:10px; border:2px solid #bfdbfe; border-top-color:#1e4e8b; border-radius:50%; animation:extractor-spin .7s linear infinite; }
@keyframes extractor-spin{ to{ transform:rotate(360deg); } }
.tone-good{ background:#dcfce7; color:#166534; }.tone-warn{ background:#fef3c7; color:#854d0e; }.tone-bad{ background:#fee2e2; color:#991b1b; }
.row-actions{ display:flex; justify-content:center; gap:6px; flex-wrap:wrap; }.row-actions button,.secondary-btn,.primary-btn,.delete-btn{ border-radius:999px; border:1px solid #dbe3ee; background:#fff; padding:8px 12px; cursor:pointer; font-weight:700; font-size:12px; }
.row-actions .row-menu-trigger{ width:32px; height:32px; display:grid; place-items:center; padding:0; border:1px solid rgba(15,23,42,.15); border-radius:10px; background:#fff; color:#334155; font-size:18px; line-height:1; }
.row-actions .row-menu-trigger:hover{ border-color:rgba(30,78,139,.35); background:#f8fafc; color:#1e4e8b; }
.action-menu-dismiss{ position:fixed; inset:0; z-index:998; }
.row-action-menu{ position:fixed; z-index:999; width:176px; display:grid; gap:6px; padding:8px; border:1px solid rgba(15,23,42,.12); border-radius:12px; background:#fff; box-shadow:0 16px 32px rgba(15,23,42,.12); }
.row-action-menu button{ width:100%; border:0; border-radius:10px; padding:8px 10px; background:rgba(15,23,42,.04); color:rgba(15,23,42,.8); text-align:left; font-size:12px; font-weight:700; cursor:pointer; }
.row-action-menu button:hover:not(:disabled){ background:rgba(30,78,139,.09); }
.row-action-menu button:disabled{ color:#94a3b8; cursor:not-allowed; }
.row-action-menu .action-item{ display:inline-flex; align-items:center; gap:8px; }
.row-action-menu .action-icon{ width:16px; flex:0 0 16px; display:inline-grid; place-items:center; font-size:12px; }
.row-action-menu .action-json{ color:rgba(15,23,42,.8); }
.row-action-menu .action-review{ color:#1e4e8b; }
.row-action-menu .action-remove{ color:#dc2626; }
.row-action-menu .action-sync{ color:#0f766e; }
.primary-btn{ background:#1e4e8b; color:#fff; border-color:#1e4e8b; }.primary-btn:disabled,.row-actions button:disabled{ opacity:.45; cursor:not-allowed; }
.delete-btn{ border-color:#dc2626; background:#dc2626; color:#fff; }
.empty-cell{ text-align:center; color:#64748b; padding:28px!important; }
.modal-backdrop{ position:fixed; inset:0; background:rgba(15,23,42,.42); display:grid; place-items:center; padding:20px; z-index:80; }
.upload-lock-backdrop{ position:fixed; inset:0; z-index:1200; display:grid; place-items:center; padding:20px; background:rgba(15,23,42,.38); backdrop-filter:blur(6px); }
.upload-lock-modal{ width:min(620px,calc(100vw - 32px)); display:flex; align-items:flex-start; gap:16px; box-sizing:border-box; border:1px solid rgba(30,78,139,.14); border-radius:14px; padding:20px; background:#fff; box-shadow:0 24px 70px rgba(15,23,42,.25); }
.upload-lock-content{ min-width:0; flex:1; }
.upload-lock-modal h3{ margin:0 0 6px; color:#123a6d; font-size:18px; }
.upload-lock-modal p{ margin:0; color:#334155; font-size:14px; line-height:1.5; }
.upload-lock-modal small{ display:block; margin-top:8px; color:#64748b; font-size:12px; }
.upload-lock-spinner{ width:30px; height:30px; flex:0 0 30px; border:3px solid #dbeafe; border-top-color:#1e4e8b; border-radius:50%; animation:extractor-spin .75s linear infinite; }
.upload-lock-progress{ margin-top:16px; }
.upload-lock-progress>strong{ color:#123a6d; font-size:12px; }
.upload-lock-progress ul{ max-height:240px; display:grid; gap:7px; margin:9px 0 0; padding:0; overflow:auto; list-style:none; }
.upload-lock-progress li{ min-width:0; display:flex; align-items:center; justify-content:space-between; gap:12px; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; background:#f8fafc; }
.upload-file-name{ min-width:0; overflow:hidden; color:#334155; font-size:12px; font-weight:700; text-overflow:ellipsis; white-space:nowrap; }
.upload-file-status{ flex:0 0 auto; display:inline-flex; align-items:center; gap:5px; border-radius:999px; padding:4px 8px; background:#e2e8f0; color:#475569; font-size:10px; font-weight:800; }
.upload-file-status.status-sent{ background:#ede9fe; color:#6d28d9; }
.upload-file-status.status-auth{ background:#ffedd5; color:#c2410c; }
.upload-file-status.status-insufficient{ background:#fee2e2; color:#b91c1c; }
.extractor-modal{ width:min(720px,96vw); max-height:88vh; overflow:auto; background:#fff; border-radius:16px; padding:16px; box-shadow:0 24px 70px rgba(15,23,42,.22); }
.extractor-modal.wide{ width:min(960px,96vw); }
.extractor-modal.confirm-modal{ width:min(440px,96vw); }
.extractor-modal header,.extractor-modal footer{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }
.extractor-modal header h3{ margin:0; color:#123a6d; font-size:18px; font-weight:800; }
.extractor-modal header button{ border:0; background:#f1f5f9; border-radius:999px; width:30px; height:30px; cursor:pointer; }
.extractor-modal label{ display:grid; gap:6px; margin-bottom:12px; color:#123a6d; font-weight:700; font-size:12px; }
.extractor-modal input,.extractor-modal select,.extractor-modal textarea{ border:1px solid #dbe3ee; border-radius:10px; padding:10px; font:inherit; color:#0f172a; }
.file-field{ display:grid; gap:6px; margin-bottom:12px; }
.file-field-label{ color:#123a6d; font-size:12px; font-weight:700; }
.file-picker-shell{ min-height:42px; display:flex; align-items:center; gap:10px; border:1px solid #dbe3ee; border-radius:999px; padding:4px 12px 4px 4px; background:#f8fafc; transition:border-color .18s ease,box-shadow .18s ease; }
.file-picker-shell:focus-within,.file-picker-shell.selected{ border-color:#93b4dc; box-shadow:0 0 0 3px rgba(30,78,139,.08); }
.extractor-modal .file-picker-btn{ display:inline-flex; align-items:center; justify-content:center; flex:0 0 auto; margin:0; border-radius:999px; padding:9px 14px; background:#1e4e8b; color:#fff; font-size:12px; font-weight:700; cursor:pointer; transition:background .18s ease; }
.extractor-modal .file-picker-btn:hover{ background:#173f72; }
.file-picker-name{ min-width:0; overflow:hidden; color:#64748b; font-size:12px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }
.file-picker-shell.selected .file-picker-name{ color:#334155; }
.file-picker-input{ position:absolute; width:1px; height:1px; padding:0!important; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0!important; }
.switch-row{ display:flex!important; grid-template-columns:auto 1fr; align-items:center; justify-content:start; }
.schema-preview{ border:1px solid #e2e8f0; border-radius:14px; padding:12px; margin-bottom:12px; background:#f8fafc; }
.schema-preview-head{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; color:#123a6d; font-weight:800; }
.schema-preview-head small{ color:#64748b; font-weight:700; }
.schema-pill-list{ display:flex; flex-wrap:wrap; gap:8px; }
.schema-pill{ display:inline-flex; align-items:center; gap:6px; border:1px solid rgba(30,78,139,.16); border-radius:999px; padding:6px 10px; background:#fff; color:#123a6d; font-weight:800; font-size:12px; }
.schema-pill.required{ border-color:#bfdbfe; background:#eff6ff; }
.schema-pill small{ color:#64748b; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0; }
.schema-toggle-pill{ border-color:#1e4e8b; background:#1e4e8b; color:#fff; white-space:nowrap; }
.schema-toggle-pill:hover{ background:#173f72; border-color:#173f72; }
.schema-empty{ color:#64748b; font-weight:700; font-size:12px; }
pre{ background:#0f172a; color:#e2e8f0; border-radius:12px; padding:14px; overflow:auto; font-size:12px; }
.review-grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; padding:2px; }
.review-field{ min-width:0; display:grid; align-content:start; gap:7px; border:1px solid #e2e8f0; border-radius:10px; padding:12px; background:#fff; }
.review-field.missing{ border-color:#fde68a; background:#fffdf5; }
.review-field.required-missing{ border-color:#fecaca; background:#fffafa; }
.review-field.complete{ border-color:#bbf7d0; }
.extractor-modal .review-field>label{ display:flex; align-items:center; gap:7px; margin:0; color:#123a6d; font-size:12px; font-weight:700; }
.review-field-state-icon{ width:18px; height:18px; flex:0 0 18px; display:grid; place-items:center; border-radius:50%; font-size:11px; font-weight:800; }
.review-field-state-icon.complete{ background:#dcfce7; color:#15803d; }
.review-field-state-icon.missing{ background:#fef3c7; color:#a16207; }
.review-field-state-icon.required-missing{ background:#fee2e2; color:#dc2626; }
.review-value-row{ display:grid; grid-template-columns:minmax(0,1fr) 34px; gap:8px; align-items:center; }
.review-value-row input{ width:100%; min-width:0; box-sizing:border-box; }
.fallback-edit-btn{ width:34px; height:34px; display:grid; place-items:center; border:1px solid #bfdbfe; border-radius:9px; background:#eff6ff; color:#1e4e8b; font-size:14px; cursor:pointer; }
.fallback-edit-btn:hover{ border-color:#1e4e8b; background:#dbeafe; }
.review-modal-title{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.missing-shortcuts{ margin-bottom:14px; border:1px solid #e2e8f0; border-radius:10px; padding:10px; background:#f8fafc; }
.missing-shortcuts-head{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; color:#123a6d; font-size:12px; }
.missing-shortcuts-head span{ color:#64748b; font-weight:700; }
.missing-shortcuts-carousel{ display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:8px; }
.missing-shortcut-list{ min-width:0; display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:7px; }
.missing-shortcut-pill{ min-width:0; display:flex; align-items:center; justify-content:center; gap:5px; border:1px solid #fde68a; border-radius:999px; padding:7px 9px; overflow:hidden; background:#fef3c7; color:#854d0e; font-size:11px; font-weight:800; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; }
.missing-shortcut-pill span{ flex:0 0 auto; }
.missing-shortcut-pill.configured{ border-color:#bfdbfe; background:#dbeafe; color:#1d4ed8; }
.missing-shortcut-pill.complete{ border-color:#bbf7d0; background:#dcfce7; color:#15803d; }
.missing-shortcut-pill.required-missing{ border-color:#fecaca; background:#fee2e2; color:#dc2626; }
.shortcut-nav-btn{ width:30px; height:30px; display:grid; place-items:center; border:1px solid #dbe3ee; border-radius:50%; padding:0; background:#fff; color:#1e4e8b; font-size:20px; cursor:pointer; }
.shortcut-nav-btn:disabled{ opacity:.35; cursor:not-allowed; }
.shortcut-page-indicator{ margin-top:7px; color:#64748b; text-align:center; font-size:10px; font-weight:700; }
.fallback-modal-backdrop{ z-index:90; }
.extractor-modal.fallback-modal{ width:min(660px,96vw); }
.fallback-modal header>div{ min-width:0; }
.fallback-modal header p{ font-size:12px; }
.fallback-modal label small{ color:#64748b; font-weight:600; }
.fallback-modal input[readonly]{ background:#f1f5f9; color:#475569; cursor:not-allowed; }
.fallback-list-head{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin:14px 0 8px; color:#123a6d; font-size:12px; font-weight:800; }
.fallback-list-head small{ color:#64748b; }
.fallback-list{ display:grid; gap:8px; }
.fallback-row{ display:grid; grid-template-columns:24px minmax(0,1fr) 34px 34px; align-items:center; gap:8px; border:1px solid #e2e8f0; border-radius:10px; padding:7px; background:#f8fafc; transition:transform .18s ease,opacity .18s ease,border-color .18s ease,box-shadow .18s ease; }
.fallback-row.dragging{ opacity:.4; transform:scale(.985); }
.fallback-row.drop-target{ border-color:#60a5fa; box-shadow:0 0 0 3px rgba(59,130,246,.12); transform:translateY(2px); }
.fallback-row input{ width:100%; min-width:0; box-sizing:border-box; background:#fff; }
.fallback-drag-handle{ display:grid; place-items:center; color:#64748b; font-size:18px; cursor:grab; user-select:none; }
.fallback-drag-handle:active{ cursor:grabbing; }
.fallback-icon-btn{ width:34px; height:34px; display:grid; place-items:center; border:0; border-radius:9px; padding:0; cursor:pointer; }
.fallback-icon-btn.remove{ background:#fee2e2; color:#991b1b; font-size:12px; }
.fallback-icon-btn.add{ background:#1e4e8b; color:#fff; font-size:18px; }
.fallback-icon-spacer{ width:34px; height:34px; }
.add-first-fallback{ width:100%; border:1px dashed #93b4dc; border-radius:10px; padding:10px; background:#eff6ff; color:#1e4e8b; font-size:12px; font-weight:700; cursor:pointer; }
.error-msg{ color:#dc2626; font-weight:700; }
@media(max-width:900px){ .extractor-page{ padding:86px 14px 20px; }.extractor-list-head,.review-grid{ grid-template-columns:1fr; display:grid; }.extraction-toolbar{ align-items:flex-start; flex-direction:column; }.toolbar-controls{ width:100%; }.extraction-search-wrap{ flex:1 1 auto; }.bulk-actions{ justify-content:flex-start; }.sort-menu{ min-width:min(340px,calc(100vw - 44px)); }.missing-shortcut-list{ grid-template-columns:1fr; }.row-actions{ min-width:210px; } }
</style>
