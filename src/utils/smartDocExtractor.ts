export type ExtractorDataType = 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'percentage' | 'array' | 'list'

export type ExtractorFieldSchema = {
  key: string
  label: string
  aliases: string[]
  required: boolean
  data_type: ExtractorDataType
  unit?: string
  item_schema?: Record<string, unknown>
}

export type AnalysisPackage = {
  id: string
  name: string
  description: string
  active: boolean
  schemaText: string
}

export type ExtractorConfig = {
  apiBaseUrl: string
  apiKey: string
  useLlm: boolean
  packages: AnalysisPackage[]
}

export type ExtractionStatus =
  | 'Enviando'
  | 'Processando'
  | 'Erro de autenticação'
  | 'Pendente'
  | 'Revisão necessária'
  | 'Pronto para sincronizar'
  | 'Sincronizado'
  | 'Erro'

export type ExtractionLog = {
  id: string
  fileName: string
  packageId: string
  packageName: string
  status: ExtractionStatus
  extractionPercent: number
  qualityScore: number
  requiredFound: number
  requiredTotal: number
  createdAt: string
  batchId?: string
  batchItemId?: string
  syncedAt?: string
  rawResponse?: unknown
  fields: ExtractedField[]
  missingFields: ExtractedField[]
  errorMessage?: string
  apiErrorEndpoint?: string
}

export type ExtractedField = {
  key: string
  label: string
  value: unknown
  required: boolean
  confidence?: number
  status?: string
  source?: string
  manualValue?: string
  fallbackAlias?: string
}

export type ExtractorFeedback = {
  package: string
  field_key: string
  field_label: string
  fallback_alias: string
  manual_value: string
  created_at: string
}

export const extractorConfigKey = 'axol.smartDocExtractor.config.v1'
export const extractorLogsKey = 'axol.smartDocExtractor.logs.v1'
export const extractorFeedbackKey = 'axol.smartDocExtractor.feedback.v1'

export const defaultPackages: AnalysisPackage[] = [
  {
    id: 'quimico',
    name: 'Análise de Óleo',
    description: 'Campos para cromatografia e ensaios físico-químicos do TR-Óleo.',
    active: true,
    schemaText: JSON.stringify(
      [
        field('transformador', 'Transformador', ['Trafo', 'Equipamento', 'ID Transformador'], true, 'string'),
        field('dataColeta', 'Data Coleta', ['Data da coleta', 'Coleta'], true, 'date'),
        field('hidrogenio', 'Hidrogênio', ['H2', 'Gás H2', 'Hidrogênio ppm'], false, 'number', 'ppm'),
        field('metano', 'Metano', ['CH4', 'Gás CH4', 'Metano ppm'], false, 'number', 'ppm'),
        field('tgc', 'TGC', ['Total de gases combustíveis', 'TOTAL_GASES_COMB'], false, 'number', 'ppm'),
        field('laboratorio', 'Laboratório', ['Lab', 'Laboratório executor'], false, 'string'),
      ],
      null,
      2,
    ),
  },
  {
    id: 'rota',
    name: 'Inspeção de Rota',
    description: 'Campos para inspeções sensitivas de campo do TR-Rota.',
    active: true,
    schemaText: JSON.stringify(
      [
        field('transformador', 'Transformador', ['Trafo', 'Equipamento'], true, 'string'),
        field('dataColeta', 'Data Coleta', ['Data da inspeção', 'Data coleta'], true, 'date'),
        field('tecnico', 'Técnico', ['Responsável', 'Inspetor'], false, 'string'),
        field('operando', 'Operando', ['Em operação', 'Opera'], true, 'boolean'),
        field('acesso', 'Acesso', ['Condição de acesso'], false, 'string'),
        field('limpeza', 'Limpeza', ['Condição de limpeza'], false, 'string'),
        field('corrosao', 'Corrosão', ['Corrosao', 'Sinais de corrosão'], false, 'string'),
        field('vazamentos', 'Vazamentos', ['Vazamento', 'Óleo vazando'], false, 'string'),
        field('vibracao', 'Vibração', ['Vibracao', 'Ruído/vibração'], false, 'string'),
      ],
      null,
      2,
    ),
  },
]

export function defaultExtractorConfig(): ExtractorConfig {
  return {
    apiBaseUrl: 'https://smart-doc-extractor-15602286572.southamerica-east1.run.app',
    apiKey: '',
    useLlm: false,
    packages: defaultPackages,
  }
}

export function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function parsePackageSchema(pkg: AnalysisPackage): ExtractorFieldSchema[] {
  const parsed = JSON.parse(pkg.schemaText)
  if (!Array.isArray(parsed)) throw new Error('O schema deve ser uma lista de campos.')
  return parsed.map((item) => validateFieldSchema(item))
}

export function normalizeExtractorConfig(config: ExtractorConfig): ExtractorConfig {
  return {
    ...config,
    packages: config.packages.map((pkg) => {
      try {
        return { ...pkg, schemaText: JSON.stringify(parsePackageSchema(pkg), null, 2) }
      } catch {
        return pkg
      }
    }),
  }
}

export function validateFieldSchema(item: unknown): ExtractorFieldSchema {
  const dataTypes: ExtractorDataType[] = ['string', 'number', 'integer', 'boolean', 'date', 'percentage', 'array', 'list']
  const value = item as Partial<ExtractorFieldSchema>
  if (!value || typeof value !== 'object') throw new Error('Campo inválido no schema.')
  if (!value.key || typeof value.key !== 'string') throw new Error('Todo campo precisa de key string.')
  if (!value.label || typeof value.label !== 'string') throw new Error(`Campo ${value.key} precisa de label string.`)
  if (!Array.isArray(value.aliases) || value.aliases.some((alias) => typeof alias !== 'string')) {
    throw new Error(`Campo ${value.key} precisa de aliases como lista de strings.`)
  }
  if (typeof value.required !== 'boolean') throw new Error(`Campo ${value.key} precisa de required boolean.`)
  if (!value.data_type || !dataTypes.includes(value.data_type)) {
    throw new Error(`Campo ${value.key} possui data_type inválido.`)
  }
  const isCollection = value.data_type === 'array' || value.data_type === 'list'
  if (isCollection && (!value.item_schema || typeof value.item_schema !== 'object' || Array.isArray(value.item_schema))) {
    throw new Error(`Campo ${value.key} precisa de item_schema quando data_type for ${value.data_type}.`)
  }

  const normalized: ExtractorFieldSchema = {
    key: value.key,
    label: value.label,
    aliases: value.aliases,
    required: value.required,
    data_type: value.data_type,
  }
  if (typeof value.unit === 'string' && value.unit.trim()) normalized.unit = value.unit.trim()
  if (isCollection) normalized.item_schema = value.item_schema
  return normalized
}

export function applyFallbackAliases(fields: ExtractorFieldSchema[], packageId: string, feedbacks: ExtractorFeedback[]) {
  return fields.map((fieldConfig) => {
    const aliases = new Set(fieldConfig.aliases)
    feedbacks
      .filter((feedback) => feedback.package === packageId && feedback.field_key === fieldConfig.key && feedback.fallback_alias)
      .forEach((feedback) => aliases.add(feedback.fallback_alias))
    return { ...fieldConfig, aliases: Array.from(aliases) }
  })
}

export function resolveExtractionStatus(log: Pick<ExtractionLog, 'fields' | 'qualityScore' | 'requiredFound' | 'requiredTotal' | 'status'>): ExtractionStatus {
  if (log.status === 'Erro' || log.status === 'Erro de autenticação' || log.status === 'Enviando' || log.status === 'Processando' || log.status === 'Sincronizado') return log.status
  if (log.requiredFound < log.requiredTotal) return 'Revisão necessária'
  if (log.fields.some((fieldConfig) => Number(fieldConfig.confidence || 1) < 0.65)) return 'Revisão necessária'
  if (log.qualityScore < 0.65) return 'Revisão necessária'
  return 'Pronto para sincronizar'
}

export function normalizeApiResponse(response: any, schema: ExtractorFieldSchema[]): Pick<ExtractionLog, 'fields' | 'missingFields' | 'extractionPercent' | 'qualityScore' | 'requiredFound' | 'requiredTotal'> {
  const summary = response?.processing_metadata?.summary || {}
  const fieldsTotal = Number(summary.fields_total ?? summary.total_fields ?? schema.length)
  const fieldsFound = Number(summary.fields_found ?? summary.found_fields ?? 0)
  const requiredTotal = Number(summary.required_fields_total ?? summary.total_required_fields ?? schema.filter((fieldConfig) => fieldConfig.required).length)
  const requiredFound = Number(summary.required_fields_found ?? summary.found_required_fields ?? 0)
  const qualityScore = Number(response?.processing_metadata?.quality_score ?? 0)
  const responseFields = response?.fields && typeof response.fields === 'object' && !Array.isArray(response.fields)
    ? response.fields as Record<string, any>
    : {}
  const missing = Array.isArray(response?.missing_fields) ? response.missing_fields : []

  const fields: ExtractedField[] = schema.map((fieldConfig) => {
    const found = responseFields[fieldConfig.key]
      || Object.values(responseFields).find((field: any) => field?.key === fieldConfig.key)
    return {
      key: fieldConfig.key,
      label: fieldConfig.label,
      value: found?.value ?? found?.normalized_value ?? found?.raw_value ?? null,
      required: fieldConfig.required,
      confidence: Number(found?.confidence ?? found?.score ?? 0),
      status: found?.status || (found?.value != null ? 'found' : 'not_found'),
      source: found?.source || (found ? 'api' : 'not_found'),
    }
  })

  const missingFields: ExtractedField[] = missing.map((fieldItem: any) => {
        const missingKey = typeof fieldItem === 'string' ? fieldItem : String(fieldItem?.key || '')
        const schemaField = schema.find((fieldConfig) => fieldConfig.key === missingKey)
        return {
        key: missingKey,
        label: typeof fieldItem === 'string' ? schemaField?.label || fieldItem : String(fieldItem?.label || fieldItem?.key || ''),
        value: null,
        required: typeof fieldItem === 'string' ? Boolean(schemaField?.required) : Boolean(fieldItem?.required ?? schemaField?.required),
        confidence: typeof fieldItem === 'string' ? 0 : Number(fieldItem?.confidence || 0),
        status: typeof fieldItem === 'string' ? 'not_found' : fieldItem?.status || 'not_found',
        source: typeof fieldItem === 'string' ? 'not_found' : fieldItem?.source || 'not_found',
      }
    })

  return {
    fields,
    missingFields,
    extractionPercent: fieldsTotal > 0 ? Math.round((fieldsFound / fieldsTotal) * 100) : 0,
    qualityScore,
    requiredFound,
    requiredTotal,
  }
}

function field(
  key: string,
  label: string,
  aliases: string[],
  required: boolean,
  data_type: ExtractorDataType,
  unit?: string,
): ExtractorFieldSchema {
  const fieldConfig: ExtractorFieldSchema = { key, label, aliases, required, data_type }
  if (unit) fieldConfig.unit = unit
  return fieldConfig
}
