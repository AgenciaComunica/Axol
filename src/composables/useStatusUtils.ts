export const statusRank: Record<string, number> = { Normal: 1, Alerta: 2, Critico: 3 }

export const statusLabelMap: Record<string, string> = {
  Normal: 'Normal',
  Alerta: 'Alerta',
  Critico: 'Crítico',
}

export function normalizeStatus(raw?: string): string {
  if (!raw) return 'Normal'
  const value = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (value.includes('crit')) return 'Critico'
  if (value.includes('alert') || value.includes('alarm') || value.includes('manut') || value.includes('reclass')) return 'Alerta'
  if (value.includes('oper')) return 'Normal'
  if (value.includes('ainda')) return 'Alerta'
  return 'Normal'
}

export function statusTone(status?: string): string {
  if (status && status.toLowerCase().includes('pend')) return 'tone-neutral'
  const normalized = normalizeStatus(status)
  if (normalized === 'Critico') return 'tone-danger'
  if (normalized === 'Alerta') return 'tone-warning'
  return 'tone-normal'
}

export function pickWorstStatus(primary?: string, secondary?: string): string {
  const primaryNorm = normalizeStatus(primary)
  const secondaryNorm = normalizeStatus(secondary)
  const worst = statusRank[secondaryNorm] > statusRank[primaryNorm] ? secondaryNorm : primaryNorm
  return statusLabelMap[worst] || 'Normal'
}

export function getWorstStatusLabel(item: { status?: string; analystStatus?: string }): string {
  return pickWorstStatus(item.status, item.analystStatus)
}

export function formatStatus(raw?: string): string {
  const normalized = normalizeStatus(raw)
  return statusLabelMap[normalized] || 'Normal'
}
