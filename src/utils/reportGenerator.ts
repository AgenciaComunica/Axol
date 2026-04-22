// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface ReportTransformerData {
  id: string; serial: string; tag: string; substation: string; reference: string
  unit: string; status: string; statusAnalyst: string; oilStatus: string; treatment: string
  power: string; voltage: string; equipment: string; commutator: string; oilFluid: string
  year: string; manufacturer: string; volume: string; refrigeration: string; load: string
  operating: string; sealed: string; analyst: string; analystNote: string; failureMode: string
  latitude: string; longitude: string
}

export interface ReportCromRow {
  date: string
  H2: unknown; CH4: unknown; C2H2: unknown; C2H4: unknown
  C2H6: unknown; CO: unknown; CO2: unknown; TGC: unknown
}

export interface ReportFisicoRow {
  date: string
  teor_agua: unknown; rd: unknown; tif: unknown
  ind_neutr: unknown; fp25: unknown; fp90: unknown; fp100: unknown
}

export interface ReportHeatmapRow {
  label: string
  values: number[]
}

export interface ReportEvalData {
  specialistStatus: string
  specialistNote: string
  specialistFailureMode: string
  latestCrom: ReportCromRow | null
  latestFisico: ReportFisicoRow | null
  riskProbabilities: number[]
  riskHeatmapRows: ReportHeatmapRow[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function statusColor(s: string) {
  if (s === 'Crítico') return '#dc2626'
  if (s === 'Alerta') return '#d97706'
  return '#16a34a'
}
function statusBg(s: string) {
  if (s === 'Crítico') return '#fee2e2'
  if (s === 'Alerta') return '#fef3c7'
  return '#dcfce7'
}
function fmt(d: Date) {
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtVal(v: unknown) {
  if (v === null || v === undefined || v === '' || v === 'NULL') return '—'
  return String(v)
}
function generateId(id: string) {
  return btoa(`${id}|${Date.now()}`).replace(/[+=/]/g, '').substring(0, 24).toUpperCase()
}

const IEEE_LIMITS: Record<string, [number, number, number]> = {
  H2:   [100,  700,  1800],
  CH4:  [120,  400,  1000],
  C2H2: [1,    9,    35],
  C2H4: [50,   100,  200],
  C2H6: [65,   100,  150],
  CO:   [350,  570,  1400],
  CO2:  [2500, 4000, 10000],
  TGC:  [720,  1920, 4630],
}

function ieeeCondition(value: unknown, key: string): string {
  const v = Number(value)
  if (!value || isNaN(v)) return '—'
  const [c1, c2, c3] = IEEE_LIMITS[key] || [0, 0, 0]
  if (v <= c1) return 'Cond. 01'
  if (v <= c2) return 'Cond. 02'
  if (v <= c3) return 'Cond. 03'
  return 'Cond. 04'
}

function condColor(cond: string): string {
  if (cond === 'Cond. 01') return '#16a34a'
  if (cond === 'Cond. 02') return '#d97706'
  if (cond === 'Cond. 03') return '#ea580c'
  if (cond === 'Cond. 04') return '#dc2626'
  return '#6b7280'
}
function condBg(cond: string): string {
  if (cond === 'Cond. 01') return '#dcfce7'
  if (cond === 'Cond. 02') return '#fef3c7'
  if (cond === 'Cond. 03') return '#ffedd5'
  if (cond === 'Cond. 04') return '#fee2e2'
  return '#f3f4f6'
}

const RISK_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444']
const RISK_LABELS = ['N1 – Normal', 'N2 – Atenção', 'N3 – Alerta', 'N4 – Alto Risco', 'N5 – Crítico']

function escHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function escAttr(s: string): string {
  return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function escJs(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"')
}

// ─── CSS shared ─────────────────────────────────────────────────────────────

const PRINT_RESET = `
  *, *::before, *::after { box-sizing: border-box; }
  @page { size: A4; margin: 14mm 16mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #fff; font-size: 13px; line-height: 1.55; }
  @media print { .no-print { display: none !important; } }
`

// ─── RELATÓRIO SIMPLES ──────────────────────────────────────────────────────

export function generateSimpleReport(
  trafo: ReportTransformerData,
  logoUrl: string,
  ev: ReportEvalData,
): string {
  const now = new Date()

  const crom = ev.latestCrom
  const fisico = ev.latestFisico
  const risk = ev.riskProbabilities

  // condition badges for gases
  const gases: [string, unknown, string][] = [
    ['H₂',   crom?.H2,   'H2'],
    ['CH₄',  crom?.CH4,  'CH4'],
    ['C₂H₂', crom?.C2H2, 'C2H2'],
    ['C₂H₄', crom?.C2H4, 'C2H4'],
    ['C₂H₆', crom?.C2H6, 'C2H6'],
    ['CO',   crom?.CO,   'CO'],
    ['CO₂',  crom?.CO2,  'CO2'],
    ['TGC',  crom?.TGC,  'TGC'],
  ]

  const gasRows = crom
    ? gases.map(([label, val, key]) => {
        const cond = ieeeCondition(val, key)
        return `<tr>
          <td class="td-l">${label}</td>
          <td class="td-v">${fmtVal(val)}</td>
          <td class="td-v">${cond}</td>
        </tr>`
      }).join('')
    : `<tr><td colspan="3" class="td-empty">Sem dados de cromatografia disponíveis</td></tr>`

  const fisicoRows = fisico
    ? `<tr><td class="td-l">Teor de Água (ppm)</td><td class="td-v" colspan="2">${fmtVal(fisico.teor_agua)}</td></tr>
       <tr><td class="td-l">RD (kV)</td><td class="td-v" colspan="2">${fmtVal(fisico.rd)}</td></tr>
       <tr><td class="td-l">TIF (Dyan/cm)</td><td class="td-v" colspan="2">${fmtVal(fisico.tif)}</td></tr>
       <tr><td class="td-l">Índ. Neutralização</td><td class="td-v" colspan="2">${fmtVal(fisico.ind_neutr)}</td></tr>
       <tr><td class="td-l">F. Pot. 25ºC</td><td class="td-v" colspan="2">${fmtVal(fisico.fp25)}</td></tr>
       <tr><td class="td-l">F. Pot. 90ºC</td><td class="td-v" colspan="2">${fmtVal(fisico.fp90)}</td></tr>
       <tr><td class="td-l">F. Pot. 100ºC</td><td class="td-v" colspan="2">${fmtVal(fisico.fp100)}</td></tr>`
    : `<tr><td colspan="3" class="td-empty">Sem dados físico-químicos disponíveis</td></tr>`

  const riskRows = risk.map((pct, i) =>
    `<tr><td class="td-l">${RISK_LABELS[i]}</td><td class="td-v">${pct.toFixed(2)}%</td></tr>`
  ).join('')

  const heatmap = ev.riskHeatmapRows
  const heatmapTableSimples = heatmap.length
    ? `<table style="margin-top:10px;font-size:11px">
        <tr>
          <td class="td-l" style="font-weight:700;color:#475569">Variável</td>
          <td class="td-v" style="font-weight:700;color:#475569;text-align:center">N1</td>
          <td class="td-v" style="font-weight:700;color:#475569;text-align:center">N2</td>
          <td class="td-v" style="font-weight:700;color:#475569;text-align:center">N3</td>
          <td class="td-v" style="font-weight:700;color:#475569;text-align:center">N4</td>
          <td class="td-v" style="font-weight:700;color:#475569;text-align:center">N5</td>
        </tr>
        ${heatmap.map(r =>
          `<tr>
            <td class="td-l">${r.label}</td>
            ${r.values.map(v => `<td class="td-v" style="text-align:center">${v.toFixed(2)}%</td>`).join('')}
          </tr>`
        ).join('')}
      </table>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Relatório – ${escHtml(trafo.serial)}</title>
<style>
  ${PRINT_RESET}
  .no-print { background:#0f172a; color:#fff; padding:8px 24px; display:flex; justify-content:space-between; align-items:center; }
  .no-print button { background:#fff; color:#0f172a; border:none; border-radius:4px; padding:5px 14px; cursor:pointer; font-size:13px; font-weight:700; }
  .page { max-width:660px; margin:0 auto; padding:32px 24px; }
  .header { display:flex; align-items:center; gap:14px; margin-bottom:20px; padding-bottom:14px; border-bottom:1px solid #e2e8f0; }
  .logo { height:38px; object-fit:contain; }
  .header h1 { margin:0; font-size:16px; color:#0f172a; font-weight:700; }
  .header p { margin:3px 0 0; font-size:11px; color:#64748b; }
  .sec { margin-top:22px; }
  .sec-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.09em; color:#64748b; padding-bottom:5px; border-bottom:1px solid #e2e8f0; margin-bottom:10px; display:flex; align-items:center; gap:7px; }
  .sec-title::before { content:''; width:3px; height:12px; background:#1e4e8b; border-radius:2px; display:block; flex-shrink:0; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  .td-l { color:#64748b; padding:5px 10px 5px 0; vertical-align:top; width:38%; border-bottom:1px solid #f1f5f9; }
  .td-v { color:#0f172a; font-weight:600; padding:5px 0; vertical-align:top; border-bottom:1px solid #f1f5f9; }
  .td-empty { color:#94a3b8; font-style:italic; padding:8px 0; font-size:11px; }
  .note-box { background:#f8fafc; border-left:3px solid #1e4e8b; padding:8px 12px; font-size:12px; color:#334155; white-space:pre-wrap; border-radius:2px; }
  .footer { margin-top:32px; padding-top:10px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; }
</style>
</head>
<body>
<div class="no-print">
  <span style="font-size:12px;opacity:.75">Relatório — ${escHtml(trafo.serial)} · ${escHtml(trafo.substation)}</span>
  <button onclick="window.print()">&#9113; Salvar como PDF</button>
</div>
<div class="page">

  <div class="header">
    <img class="logo" src="${logoUrl}" alt="SIARO" />
    <div>
      <h1>Relatório de Transformador</h1>
      <p>Emitido em ${fmt(now)} &bull; SIARO – Axol Engenharia</p>
    </div>
  </div>

  <!-- CARD 1 – Resultado das avaliações -->
  <div class="sec">
    <div class="sec-title">1 – Resultado das Avaliações</div>
    <table>
      <tr><td class="td-l">Serial / TAG</td><td class="td-v">${escHtml(trafo.serial)} / ${escHtml(trafo.tag)}</td></tr>
      <tr><td class="td-l">Subestação</td><td class="td-v">${escHtml(trafo.substation)}</td></tr>
      <tr><td class="td-l">Status sistema</td><td class="td-v">${escHtml(trafo.status)}</td></tr>
      <tr><td class="td-l">Status analista</td><td class="td-v">${escHtml(ev.specialistStatus)}</td></tr>
      <tr><td class="td-l">Estado do óleo</td><td class="td-v">${escHtml(trafo.oilStatus)}</td></tr>
      ${crom ? `<tr><td class="td-l">Condição TGC (IEEE)</td><td class="td-v">${ieeeCondition(crom.TGC, 'TGC')}</td></tr>` : ''}
    </table>
  </div>

  <!-- CARD 2 – Avaliação do Especialista -->
  <div class="sec">
    <div class="sec-title">2 – Avaliação do Especialista</div>
    <table>
      <tr><td class="td-l">Status</td><td class="td-v">${escHtml(ev.specialistStatus)}</td></tr>
      <tr><td class="td-l">Modo de falha</td><td class="td-v">${escHtml(ev.specialistFailureMode)}</td></tr>
    </table>
    ${ev.specialistNote && ev.specialistNote !== 'Sem observações registradas.' ? `<div class="note-box" style="margin-top:8px">${escHtml(ev.specialistNote)}</div>` : ''}
  </div>

  <!-- CARD 3 – Última Coleta -->
  <div class="sec">
    <div class="sec-title">3 – Última Coleta${crom ? ` — ${escHtml(crom.date)}` : ''}</div>
    <table>
      <tr>
        <td class="td-l" style="font-weight:600;color:#475569">Gás</td>
        <td class="td-v" style="font-weight:600;color:#475569">Valor</td>
        <td class="td-v" style="font-weight:600;color:#475569">Condição IEEE</td>
      </tr>
      ${gasRows}
    </table>
  </div>

  <!-- CARD 4 – Tratamentos no Óleo Isolante -->
  <div class="sec">
    <div class="sec-title">4 – Tratamentos no Óleo Isolante${fisico ? ` — ${escHtml(fisico.date)}` : ''}</div>
    <table>${fisicoRows}</table>
  </div>

  <!-- CARD 5 – Avaliação do Risco Operacional -->
  <div class="sec">
    <div class="sec-title">5 – Avaliação do Risco Operacional</div>
    <table>${riskRows}</table>
    ${heatmapTableSimples}
  </div>

  <div class="footer">
    <span>ID: ${escHtml(trafo.id)}</span>
    <span>SIARO © ${now.getFullYear()} – Axol Engenharia</span>
  </div>
</div>
</body>
</html>`
}

// ─── RELATÓRIO COMPLETO ─────────────────────────────────────────────────────

export function generateCompleteReport(
  trafo: ReportTransformerData,
  logoUrl: string,
  trafoImgUrl: string,
  qrUrl: string,
  ev: ReportEvalData,
): string {
  const now = new Date()
  const reportId = generateId(trafo.id)
  const validationUrl = `https://siaro.axol.eng.br/validar/${reportId}`
  const expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const expiryStr = expiryDate.toLocaleDateString('pt-BR')

  const sFg = statusColor(ev.specialistStatus)
  const sBg = statusBg(ev.specialistStatus)

  const crom = ev.latestCrom
  const fisico = ev.latestFisico
  const risk = ev.riskProbabilities

  const gases: [string, unknown, string][] = [
    ['H₂',   crom?.H2,   'H2'],
    ['CH₄',  crom?.CH4,  'CH4'],
    ['C₂H₂', crom?.C2H2, 'C2H2'],
    ['C₂H₄', crom?.C2H4, 'C2H4'],
    ['C₂H₆', crom?.C2H6, 'C2H6'],
    ['CO',   crom?.CO,   'CO'],
    ['CO₂',  crom?.CO2,  'CO2'],
    ['TGC',  crom?.TGC,  'TGC'],
  ]

  const gasTableRows = crom
    ? gases.map(([label, val, key]) => {
        const cond = ieeeCondition(val, key)
        const cc = condColor(cond)
        const cb = condBg(cond)
        return `<tr>
          <td class="tc-label">${label}</td>
          <td class="tc-val">${fmtVal(val)}</td>
          <td class="tc-cond"><span class="cpill" style="color:${cc};background:${cb}">${cond}</span></td>
        </tr>`
      }).join('')
    : `<tr><td colspan="3" class="tc-empty">Sem dados de cromatografia</td></tr>`

  const fisicoTableRows = fisico
    ? `<tr><td class="tc-label">Teor de Água</td><td class="tc-val">${fmtVal(fisico.teor_agua)} ppm</td></tr>
       <tr><td class="tc-label">RD</td><td class="tc-val">${fmtVal(fisico.rd)} kV</td></tr>
       <tr><td class="tc-label">TIF</td><td class="tc-val">${fmtVal(fisico.tif)} Dyan/cm</td></tr>
       <tr><td class="tc-label">Índ. Neutralização</td><td class="tc-val">${fmtVal(fisico.ind_neutr)} mgKOH/g</td></tr>
       <tr><td class="tc-label">F. Pot. 25ºC</td><td class="tc-val">${fmtVal(fisico.fp25)}</td></tr>
       <tr><td class="tc-label">F. Pot. 90ºC</td><td class="tc-val">${fmtVal(fisico.fp90)}</td></tr>
       <tr><td class="tc-label">F. Pot. 100ºC</td><td class="tc-val">${fmtVal(fisico.fp100)}</td></tr>`
    : `<tr><td colspan="2" class="tc-empty">Sem dados físico-químicos</td></tr>`

  const riskBars = risk.map((pct, i) =>
    `<div class="risk-row">
      <span class="risk-lbl">${RISK_LABELS[i]}</span>
      <div class="risk-track">
        <div class="risk-fill" style="width:${pct}%;background:${RISK_COLORS[i]}"></div>
      </div>
      <span class="risk-num" style="color:${pct > 0 ? RISK_COLORS[i] : '#94a3b8'}">${pct.toFixed(2)}%</span>
    </div>`
  ).join('')

  // Donut charts — SVG inline (circumference ≈ 100 with r=15.9)
  const riskDonuts = `<div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:4px">
    ${risk.map((pct, i) => {
      const dash = Math.min(pct, 100)
      const gap = 100 - dash
      const color = RISK_COLORS[i]
      const label = ['N1','N2','N3','N4','N5'][i]
      const sub = ['Normal','Atenção','Alerta','Alto Risco','Crítico'][i]
      return `<div style="text-align:center;flex:1;min-width:80px">
        <svg viewBox="0 0 36 36" width="72" height="72" style="display:block;margin:0 auto">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" stroke-width="3"/>
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="${color}" stroke-width="3"
            stroke-dasharray="${dash} ${gap}" stroke-dashoffset="25"
            transform="rotate(-90 18 18)" stroke-linecap="round"/>
          <text x="18" y="20" text-anchor="middle" font-size="5.8" fill="${color}" font-weight="bold" font-family="Arial">${pct.toFixed(1)}%</text>
        </svg>
        <div style="font-size:10px;font-weight:700;color:${color};margin-top:4px">${label}</div>
        <div style="font-size:9px;color:#94a3b8">${sub}</div>
      </div>`
    }).join('')}
  </div>`

  const heatmapRows = ev.riskHeatmapRows
  const heatmapTableCompleto = heatmapRows.length
    ? `<div style="margin-top:16px;overflow-x:auto">
        <p style="font-size:11px;color:#64748b;margin:0 0 8px">Variáveis fora das faixas estabelecidas (% por nível de risco):</p>
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead>
            <tr>
              <th style="text-align:left;padding:5px 8px 5px 0;color:#64748b;font-weight:700;font-size:10px;border-bottom:1px solid #e2e8f0;width:90px">Variável</th>
              ${['N1','N2','N3','N4','N5'].map(n =>
                `<th style="text-align:center;padding:5px 4px;color:#475569;font-weight:700;font-size:10px;border-bottom:1px solid #e2e8f0">${n}</th>`
              ).join('')}
            </tr>
          </thead>
          <tbody>
            ${heatmapRows.map(r =>
              `<tr>
                <td style="padding:4px 8px 4px 0;color:#475569;font-size:11px;border-bottom:1px solid #f1f5f9;font-weight:600">${r.label}</td>
                ${r.values.map(v => {
                  const alpha = v > 0 ? Math.max(0.1, Math.min(0.75, v / 100)) : 0
                  const bg = alpha > 0 ? `rgba(220,38,38,${alpha.toFixed(2)})` : 'transparent'
                  return `<td style="text-align:center;padding:4px;border-bottom:1px solid #f1f5f9;background:${bg};color:#0f172a;font-weight:${v > 0 ? 700 : 400}">${v.toFixed(2)}%</td>`
                }).join('')}
              </tr>`
            ).join('')}
          </tbody>
        </table>
      </div>`
    : ''

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'TechArticle',
    name: `Relatório de Transformador ${trafo.serial}`,
    identifier: reportId, datePublished: now.toISOString(), expires: expiryDate.toISOString(),
    url: validationUrl, author: { '@type': 'Person', email: trafo.analyst },
    about: { '@type': 'Product', serialNumber: trafo.serial, name: `Transformador TAG ${trafo.tag}`,
      manufacturer: { '@type': 'Organization', name: trafo.manufacturer } },
  })

  const machineJson = JSON.stringify({
    reportId, issuedAt: now.toISOString(), expiresAt: expiryDate.toISOString(), validationUrl,
    transformer: { id: trafo.id, serial: trafo.serial, tag: trafo.tag, substation: trafo.substation,
      unit: trafo.unit, status: trafo.status, statusAnalyst: ev.specialistStatus,
      oilStatus: trafo.oilStatus, power: trafo.power, voltage: trafo.voltage,
      manufacturer: trafo.manufacturer, year: trafo.year, analyst: trafo.analyst,
      failureMode: ev.specialistFailureMode, latitude: trafo.latitude, longitude: trafo.longitude },
    riskProbabilities: risk,
    latestChromatography: crom ? { date: crom.date, H2: crom.H2, CH4: crom.CH4, C2H2: crom.C2H2,
      C2H4: crom.C2H4, C2H6: crom.C2H6, CO: crom.CO, CO2: crom.CO2, TGC: crom.TGC } : null,
  })

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="report-id" content="${escAttr(reportId)}">
<meta name="report-issued" content="${now.toISOString()}">
<meta name="report-expires" content="${expiryDate.toISOString()}">
<meta name="transformer-id" content="${escAttr(trafo.id)}">
<meta name="transformer-serial" content="${escAttr(trafo.serial)}">
<meta name="transformer-status" content="${escAttr(ev.specialistStatus)}">
<title>Relatório Completo – ${escHtml(trafo.serial)}</title>
<script type="application/ld+json">${jsonLd}<\/script>
<style>
  ${PRINT_RESET}

  /* ── Print bar ── */
  .no-print { background:#0f172a; color:#fff; padding:9px 28px; display:flex; justify-content:space-between; align-items:center; gap:12px; }
  .np-chip { background:#1e4e8b; border-radius:4px; padding:2px 9px; font-size:10px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
  .np-btn { background:#fff; color:#0f172a; border:none; border-radius:5px; padding:6px 16px; cursor:pointer; font-size:13px; font-weight:700; }
  .np-btn:hover { background:#dbeafe; }

  /* ── Page ── */
  .page { max-width:860px; margin:0 auto; background:#fff; }

  /* ── Header band ── */
  .hband { background:#fff; color:#0f172a; padding:0; border-bottom:2px solid #e2e8f0; }
  .hband-top { padding:20px 36px 16px; display:flex; align-items:center; gap:16px; border-bottom:1px solid #e2e8f0; }
  .hb-logo { height:52px; object-fit:contain; }
  .hband-top-text { flex:1; }
  .hb-eyebrow { font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:#94a3b8; margin-bottom:3px; }
  .hb-title { font-size:20px; font-weight:800; color:#0f172a; margin:0; line-height:1.2; }
  .hb-sub { font-size:10px; color:#94a3b8; margin-top:3px; }
  .hband-body { display:grid; grid-template-columns:230px 1fr; gap:0; min-height:220px; }
  .hb-trafo { display:flex; align-items:center; justify-content:center; padding:20px; border-right:1px solid #e2e8f0; background:#f8fafc; }
  .hb-trafo img { height:185px; width:auto; object-fit:contain; opacity:.85; }
  .hb-info { padding:20px 28px; display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:14px 20px; align-content:center; }
  .hb-mi-label { font-size:9px; text-transform:uppercase; letter-spacing:.07em; color:#94a3b8; font-weight:700; }
  .hb-mi-value { font-size:11px; font-weight:700; color:#0f172a; margin-top:2px; }

  /* ── Status bar ── */
  .sbar { background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:14px 36px; display:flex; align-items:center; justify-content:space-between; gap:20px; }
  .sbar-main { display:flex; align-items:center; gap:14px; }
  .sbar-accent { width:4px; height:44px; border-radius:999px; background:#1e4e8b; flex-shrink:0; }
  .sbar-label { font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#64748b; font-weight:700; }
  .sbar-status { font-size:24px; font-weight:800; color:${sFg}; line-height:1.1; }
  .sbar-analyst { font-size:11px; color:#94a3b8; margin-top:2px; }
  .sbar-badges { display:flex; gap:8px; flex-wrap:wrap; }
  .badge { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:999px; font-size:12px; font-weight:700; }
  .badge-dot { width:6px; height:6px; border-radius:50%; background:currentColor; flex-shrink:0; }

  /* ── Validity strip ── */
  .vstrip { border-bottom:1px solid #e2e8f0; padding:10px 36px; display:flex; align-items:center; gap:20px; flex-wrap:wrap; }
  .vstrip-field {}
  .vf-label { font-size:9px; text-transform:uppercase; letter-spacing:.07em; color:#94a3b8; font-weight:700; }
  .vf-value { font-size:12px; font-weight:700; color:#0f172a; margin-top:1px; }
  .vf-value.id { color:#1e4e8b; font-family:monospace; letter-spacing:.04em; }
  .vstrip-sep { width:1px; height:26px; background:#e2e8f0; }
  .vstrip-url { font-size:10px; color:#94a3b8; margin-left:auto; }

  /* ── Content ── */
  .content { padding:28px 36px; }

  /* ── Section head ── */
  .sec-head { display:flex; align-items:center; gap:7px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:#64748b; margin:26px 0 14px; padding-bottom:6px; border-bottom:1px solid #e2e8f0; }
  .sec-head:first-child { margin-top:0; }
  .sec-head::before { content:''; width:3px; height:12px; border-radius:2px; background:#1e4e8b; display:block; flex-shrink:0; }
  .sec-num { background:#0f172a; color:#fff; border-radius:3px; padding:1px 6px; font-size:9px; font-weight:800; letter-spacing:.04em; }

  /* ── KV grid ── */
  .kv-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:4px; }
  .kv-card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:7px; padding:10px 12px; }
  .kv-label { font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:.05em; }
  .kv-value { font-size:16px; font-weight:800; color:#0f172a; margin-top:3px; }

  /* ── Two column ── */
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:32px; }

  /* ── Tables ── */
  table { width:100%; border-collapse:collapse; }
  .tc-label { color:#64748b; padding:6px 12px 6px 0; font-size:12px; vertical-align:top; border-bottom:1px solid #f1f5f9; width:42%; }
  .tc-val { color:#0f172a; font-weight:600; padding:6px 0; font-size:12px; vertical-align:top; border-bottom:1px solid #f1f5f9; }
  .tc-cond { padding:6px 0; vertical-align:top; border-bottom:1px solid #f1f5f9; }
  .tc-empty { color:#94a3b8; font-style:italic; font-size:11px; padding:8px 0; }
  .cpill { display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700; }

  /* ── Risk bars ── */
  .risk-row { display:flex; align-items:center; gap:10px; margin-bottom:7px; }
  .risk-lbl { font-size:11px; color:#64748b; width:120px; flex-shrink:0; }
  .risk-track { flex:1; background:#f1f5f9; border-radius:999px; height:10px; overflow:hidden; }
  .risk-fill { height:100%; border-radius:999px; }
  .risk-num { font-size:12px; font-weight:800; width:48px; text-align:right; flex-shrink:0; }

  /* ── Note box ── */
  .note-box { background:#f8fafc; border-left:3px solid #1e4e8b; padding:10px 14px; font-size:12px; color:#334155; white-space:pre-wrap; border-radius:2px; margin-top:8px; line-height:1.6; }

  /* ── Machine data ── */
  .mdata-wrap { border-top:1px dashed #e2e8f0; margin:0 36px; padding:10px 0 16px; }
  .mdata-label { font-size:9px; text-transform:uppercase; letter-spacing:.08em; color:#cbd5e1; margin-bottom:3px; font-weight:700; }
  .mdata-raw { font-family:monospace; font-size:9px; color:#cbd5e1; word-break:break-all; line-height:1.4; }

  /* ── Validity strip ── */
  .vstrip { border-bottom:1px solid #e2e8f0; padding:10px 36px; display:flex; align-items:center; gap:20px; flex-wrap:wrap; }
  .vstrip-field {}
  .vf-label { font-size:9px; text-transform:uppercase; letter-spacing:.07em; color:#94a3b8; font-weight:700; }
  .vf-value { font-size:12px; font-weight:700; color:#0f172a; margin-top:1px; }
  .vf-value.id { color:#1e4e8b; font-family:monospace; letter-spacing:.04em; }
  .vstrip-sep { width:1px; height:26px; background:#e2e8f0; }
  .vstrip-url { font-size:10px; color:#94a3b8; margin-left:auto; }
  /* ── Footer ── */
  .doc-footer { border-top:1px solid #e2e8f0; }
  .doc-footer-main { padding:14px 36px; display:flex; align-items:center; justify-content:space-between; gap:20px; border-bottom:1px dashed #e2e8f0; }
  .doc-footer-logo { height:54px; object-fit:contain; opacity:.8; }
  .doc-footer-qr-right { display:flex; flex-direction:column; align-items:flex-end; gap:6px; }
  .doc-footer-qr-img { width:68px; height:68px; object-fit:contain; display:block; }
  .doc-footer-qr-link { font-size:9px; color:#94a3b8; text-align:right; font-family:monospace; white-space:nowrap; line-height:1.5; }
  .doc-footer-info { padding:9px 36px; display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; background:#f8fafc; }
  .doc-footer-info strong { color:#64748b; }

  @media print {
    body { background:#fff; }
    .sbar-accent { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .risk-fill { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .cpill { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .badge { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }
</style>
</head>
<body>
<div class="no-print">
  <div style="display:flex;align-items:center;gap:10px;font-size:12px">
    <span class="np-chip">Relatório Completo</span>
    <span>${escHtml(trafo.serial)} — ${escHtml(trafo.substation)}</span>
  </div>
  <button class="np-btn" onclick="window.print()">&#9113; Salvar como PDF</button>
</div>

<div class="page">

  <!-- HEADER BAND -->
  <div class="hband">
    <div class="hband-top">
      <img class="hb-logo" src="${logoUrl}" alt="SIARO" />
      <div class="hband-top-text">
        <div class="hb-eyebrow">Sistema SIARO — Axol Engenharia</div>
        <h1 class="hb-title">Relatório Técnico de Transformador</h1>
        <p class="hb-sub">Emitido em ${fmt(now)} &bull; Válido até ${expiryStr}</p>
      </div>
      <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:5px">
        <img src="${qrUrl}" alt="QR Code" style="width:60px;height:60px;object-fit:contain;display:block" />
        <span style="font-size:8px;color:#94a3b8;font-family:monospace;white-space:nowrap">${escHtml(validationUrl)}</span>
      </div>
    </div>
    <div class="hband-body">
      <div class="hb-trafo">
        <img src="${trafoImgUrl}" alt="Transformador" />
      </div>
      <div class="hb-info">
        <div class="hb-mi"><div class="hb-mi-label">Serial</div><div class="hb-mi-value">${escHtml(trafo.serial)}</div></div>
        <div class="hb-mi"><div class="hb-mi-label">TAG</div><div class="hb-mi-value">${escHtml(trafo.tag)}</div></div>
        <div class="hb-mi"><div class="hb-mi-label">Subestação</div><div class="hb-mi-value">${escHtml(trafo.substation)}</div></div>
        <div class="hb-mi"><div class="hb-mi-label">Unidade</div><div class="hb-mi-value">${escHtml(trafo.unit)}</div></div>
        <div class="hb-mi"><div class="hb-mi-label">Potência</div><div class="hb-mi-value">${escHtml(trafo.power)}</div></div>
        <div class="hb-mi"><div class="hb-mi-label">Tensão</div><div class="hb-mi-value">${escHtml(trafo.voltage)}</div></div>
        <div class="hb-mi"><div class="hb-mi-label">Fabricante</div><div class="hb-mi-value">${escHtml(trafo.manufacturer)}</div></div>
        <div class="hb-mi"><div class="hb-mi-label">Ano Fabricação</div><div class="hb-mi-value">${escHtml(trafo.year)}</div></div>
        <div class="hb-mi"><div class="hb-mi-label">Tipo</div><div class="hb-mi-value">${escHtml(trafo.equipment)}</div></div>
        <div class="hb-mi"><div class="hb-mi-label">Comutador</div><div class="hb-mi-value">${escHtml(trafo.commutator)}</div></div>
        <div class="hb-mi"><div class="hb-mi-label">Óleo/Fluido</div><div class="hb-mi-value">${escHtml(trafo.oilFluid)}</div></div>
        <div class="hb-mi"><div class="hb-mi-label">Volume (L)</div><div class="hb-mi-value">${escHtml(trafo.volume)}</div></div>
        <div class="hb-mi"><div class="hb-mi-label">Refrigeração</div><div class="hb-mi-value">${escHtml(trafo.refrigeration)}</div></div>
        <div class="hb-mi"><div class="hb-mi-label">Carregamento</div><div class="hb-mi-value">${escHtml(trafo.load)}%</div></div>
        <div class="hb-mi"><div class="hb-mi-label">Em Operação</div><div class="hb-mi-value">${escHtml(trafo.operating)}</div></div>
        <div class="hb-mi"><div class="hb-mi-label">Selado</div><div class="hb-mi-value">${escHtml(trafo.sealed)}</div></div>
      </div>
    </div>
  </div>

  <!-- STATUS BAR -->
  <div class="sbar">
    <div class="sbar-main">
      <div class="sbar-accent"></div>
      <div>
        <div class="sbar-label">Avaliação do Analista</div>
        <div class="sbar-status">${escHtml(ev.specialistStatus)}</div>
        <div class="sbar-analyst">${escHtml(trafo.analyst)}</div>
      </div>
    </div>
    <div class="sbar-badges">
      <span class="badge" style="color:${statusColor(trafo.status)};background:${statusBg(trafo.status)}">
        <span class="badge-dot"></span>Sistema: ${escHtml(trafo.status)}
      </span>
      <span class="badge" style="color:${sFg};background:${sBg}">
        <span class="badge-dot"></span>Analista: ${escHtml(ev.specialistStatus)}
      </span>
    </div>
  </div>


  <div class="content">

    <!-- CARD 1 – Resultado das Avaliações -->
    <div class="sec-head"><span class="sec-num">1</span>Resultado das Avaliações</div>
    <div class="kv-grid">
      <div class="kv-card"><div class="kv-label">Status Sistema</div><div class="kv-value" style="font-size:14px;color:${statusColor(trafo.status)}">${escHtml(trafo.status)}</div></div>
      <div class="kv-card"><div class="kv-label">Status Analista</div><div class="kv-value" style="font-size:14px;color:${sFg}">${escHtml(ev.specialistStatus)}</div></div>
      <div class="kv-card"><div class="kv-label">Estado do Óleo</div><div class="kv-value" style="font-size:13px">${escHtml(trafo.oilStatus)}</div></div>
      ${crom ? `<div class="kv-card"><div class="kv-label">Condição TGC (IEEE)</div><div class="kv-value" style="font-size:14px;color:${condColor(ieeeCondition(crom.TGC,'TGC'))}">${ieeeCondition(crom.TGC,'TGC')}</div></div>` : ''}
    </div>

    <!-- CARD 2 – Avaliação do Especialista -->
    <div class="sec-head"><span class="sec-num">2</span>Avaliação do Especialista</div>
    <table>
      <tr><td class="tc-label">Status</td><td class="tc-val"><span class="badge" style="color:${sFg};background:${sBg}">${escHtml(ev.specialistStatus)}</span></td></tr>
      <tr><td class="tc-label">Modo de falha</td><td class="tc-val">${escHtml(ev.specialistFailureMode)}</td></tr>
    </table>
    ${ev.specialistNote && ev.specialistNote !== 'Sem observações registradas.' ? `<div class="note-box">${escHtml(ev.specialistNote)}</div>` : ''}

    <!-- CARD 3 & 4 – Coleta + Físico-Químico (duas colunas) -->
    <div class="two-col" style="margin-top:24px">
      <div>
        <div class="sec-head"><span class="sec-num">3</span>Última Coleta${crom ? ` — ${escHtml(crom.date)}` : ''}</div>
        <table>
          <tr>
            <td class="tc-label" style="font-weight:700;color:#475569">Gás</td>
            <td class="tc-val" style="font-weight:700;color:#475569">Valor</td>
            <td class="tc-cond" style="font-weight:700;color:#475569;font-size:11px;padding:6px 0;border-bottom:1px solid #f1f5f9">IEEE</td>
          </tr>
          ${gasTableRows}
        </table>
      </div>
      <div>
        <div class="sec-head"><span class="sec-num">4</span>Tratamentos no Óleo${fisico ? ` — ${escHtml(fisico.date)}` : ''}</div>
        <table>${fisicoTableRows}</table>
      </div>
    </div>

    <!-- CARD 5 – Risco Operacional -->
    <div class="sec-head"><span class="sec-num">5</span>Avaliação do Risco Operacional</div>
    <p style="font-size:11px;color:#64748b;margin:0 0 12px">Probabilidade (%) de operação em cada nível de risco para o próximo ano:</p>
    ${riskDonuts}
    ${heatmapTableCompleto}


  </div>

  <!-- MACHINE DATA (discreto) -->
  <div class="mdata-wrap">
    <div class="mdata-label">Dados de integração (machine-readable JSON)</div>
    <div class="mdata-raw">${escHtml(machineJson)}</div>
  </div>

  <!-- FOOTER -->
  <div class="doc-footer">
    <div class="doc-footer-main">
      <img class="doc-footer-logo" src="${logoUrl}" alt="SIARO" />
      <div class="doc-footer-qr-right">
        <img class="doc-footer-qr-img" src="${qrUrl}" alt="QR Code de validação" />
        <div class="doc-footer-qr-link">${escHtml(validationUrl)}</div>
      </div>
    </div>
    <div class="doc-footer-info">
      <span><strong>SIARO</strong> &copy; ${now.getFullYear()} &ndash; Axol Engenharia</span>
      <span>Relatório <strong>${escHtml(reportId)}</strong></span>
      <span>Analista: <strong>${escHtml(trafo.analyst)}</strong> &middot; Válido até ${expiryStr}</span>
    </div>
  </div>

</div>

</body>
</html>`
}
