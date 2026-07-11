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

  constructor(message: string, options: { responseBody?: unknown; status?: number } = {}) {
    super(message)
    this.name = 'ExtractorApiError'
    this.responseBody = options.responseBody
    this.status = options.status
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

export function getExtractionBatchItemResult(options: ExtractorApiOptions, batchId: string, itemId: string) {
  return requestJson(
    options,
    `/batches/${encodeURIComponent(batchId)}/items/${encodeURIComponent(itemId)}/result`,
    { method: 'GET' },
  )
}

async function requestJson(options: ExtractorApiOptions, path: string, init: RequestInit) {
  const baseUrl = options.apiBaseUrl.replace(/\/$/, '')
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...init.headers, 'X-API-Key': options.apiKey.trim() },
    })
  } catch (error) {
    throw new ExtractorApiError(error instanceof Error ? error.message : 'Falha de rede ao acessar a API.')
  }

  const responseBody = await readResponseBody(response)
  if (!response.ok || (isRecord(responseBody) && responseBody.success === false)) {
    throw new ExtractorApiError(apiErrorMessage(response, responseBody), {
      responseBody,
      status: response.status,
    })
  }
  return responseBody
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
