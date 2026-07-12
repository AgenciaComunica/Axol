import type { ExtractorFieldSchema } from '@/utils/smartDocExtractor'

export type ExtractorApiOptions = {
  apiBaseUrl: string
  apiKey: string
}

export type BatchItemStatus = {
  item_id: string
  file_name: string
  request_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  created_at: string
  started_at?: string | null
  completed_at?: string | null
  error?: string | null
  result_available?: boolean
}

export type BatchStatusResponse = {
  batch_id: string
  status: 'queued' | 'processing' | 'completed' | 'completed_with_errors' | 'failed'
  total_items: number
  queued_items?: number
  processing_items?: number
  completed_items?: number
  failed_items?: number
  items: BatchItemStatus[]
}

export class ExtractorApiError extends Error {
  responseBody?: unknown
  status?: number
  endpoint: string

  constructor(message: string, options: { responseBody?: unknown; status?: number; endpoint?: string } = {}) {
    super(message)
    this.name = 'ExtractorApiError'
    this.responseBody = options.responseBody
    this.status = options.status
    this.endpoint = options.endpoint || ''
  }
}

export async function extractPdf(
  options: ExtractorApiOptions,
  input: { file: File; fields: ExtractorFieldSchema[]; analysisPackage: string; useLlm: boolean },
) {
  const form = new FormData()
  form.append('file', input.file)
  form.append('fields', JSON.stringify(input.fields))
  form.append('analysis_package', input.analysisPackage)
  form.append('use_llm', String(input.useLlm))

  return requestJson(options, '/extract-pdf', { method: 'POST', body: form })
}

export async function createExtractionBatch(
  options: ExtractorApiOptions,
  input: { files: File[]; fields: ExtractorFieldSchema[]; analysisPackage: string; useLlm: boolean },
) {
  const form = new FormData()
  input.files.forEach((file) => form.append('files', file))
  form.append('fields', JSON.stringify(input.fields))
  form.append('analysis_package', input.analysisPackage)
  form.append('use_llm', String(input.useLlm))

  return requestJson(options, '/batches', { method: 'POST', body: form }) as Promise<BatchStatusResponse>
}

export function getExtractionBatch(options: ExtractorApiOptions, batchId: string) {
  return requestJson(options, `/batches/${encodeURIComponent(batchId)}`, { method: 'GET' }) as Promise<BatchStatusResponse>
}

export function getExtractionBatchItem(options: ExtractorApiOptions, batchId: string, itemId: string) {
  return requestJson(
    options,
    `/batches/${encodeURIComponent(batchId)}/items/${encodeURIComponent(itemId)}`,
    { method: 'GET' },
  ) as Promise<BatchItemStatus>
}

export function getExtractionBatchItemResult(options: ExtractorApiOptions, batchId: string, itemId: string) {
  return requestJson(
    options,
    `/batches/${encodeURIComponent(batchId)}/items/${encodeURIComponent(itemId)}/result`,
    { method: 'GET' },
  )
}

export async function testExtractorApiConnection(options: ExtractorApiOptions) {
  const healthResponse = await apiFetch(options, '/health', { method: 'GET' })
  const healthBody = await readResponseBody(healthResponse)
  if (!healthResponse.ok) {
    throw createHttpError('/health', healthResponse, healthBody)
  }

  const authForm = new FormData()
  authForm.append('file', new File(['%PDF-1.4\n%%EOF'], 'auth-check.pdf', { type: 'application/pdf' }))
  authForm.append('fields', '[]')
  authForm.append('analysis_package', 'quimico')
  authForm.append('use_llm', 'false')
  const authResponse = await apiFetch(options, '/extract-pdf', { method: 'POST', body: authForm })
  const authBody = await readResponseBody(authResponse)

  return { healthBody, authResponse, authBody }
}

async function requestJson(options: ExtractorApiOptions, path: string, init: RequestInit) {
  const response = await apiFetch(options, path, init)
  const responseBody = await readResponseBody(response)
  if (!response.ok || (isRecord(responseBody) && responseBody.success === false)) {
    throw createHttpError(path, response, responseBody)
  }
  return responseBody
}

export async function apiFetch(options: ExtractorApiOptions, path: string, init: RequestInit = {}) {
  const baseUrl = options.apiBaseUrl.trim().replace(/\/$/, '')
  const headers = new Headers(init.headers)
  headers.set('X-API-Key', options.apiKey.trim())
  try {
    return await fetch(`${baseUrl}${path}`, { ...init, headers })
  } catch (error) {
    throw new ExtractorApiError(error instanceof Error ? error.message : 'Falha de rede ao acessar a API.', { endpoint: path })
  }
}

function createHttpError(path: string, response: Response, responseBody: unknown) {
  return new ExtractorApiError(
    response.status === 401 ? 'API Key ausente ou inválida.' : apiErrorMessage(response, responseBody),
    { responseBody, status: response.status, endpoint: path },
  )
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function apiErrorMessage(response: Response, body: unknown) {
  if (isRecord(body)) {
    if (Array.isArray(body.errors) && body.errors.length) {
      return body.errors.map((error) => typeof error === 'string' ? error : JSON.stringify(error)).join('; ')
    }
    if (typeof body.detail === 'string') return body.detail
    if (typeof body.message === 'string') return body.message
  }
  if (typeof body === 'string' && body.trim()) return body
  return `HTTP ${response.status}${response.statusText ? `: ${response.statusText}` : ''}`
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
