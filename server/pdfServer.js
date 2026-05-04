import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { URL } from 'node:url'

import puppeteer from 'puppeteer'

const PORT = Number(process.env.PORT || process.env.PDF_PORT || 3001)
const HOST = process.env.HOST || process.env.PDF_HOST || '0.0.0.0'
const PUBLIC_DIR = path.resolve(process.cwd(), 'public')
const DIST_DIR = path.resolve(process.cwd(), 'dist')

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0

    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 20 * 1024 * 1024) {
        reject(new Error('Payload excede o limite de 20MB'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('JSON inválido'))
      }
    })

    req.on('error', reject)
  })
}

function readMeta(html, name) {
  const pattern = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`,
    'i',
  )
  return pattern.exec(html)?.[1] || ''
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.html') return 'text/html; charset=utf-8'
  if (ext === '.js') return 'text/javascript; charset=utf-8'
  if (ext === '.css') return 'text/css; charset=utf-8'
  if (ext === '.json') return 'application/json; charset=utf-8'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.ico') return 'image/x-icon'
  if (ext === '.txt') return 'text/plain; charset=utf-8'
  return 'application/octet-stream'
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(text)
}

function resolveDistPathCandidates(urlPathname) {
  const decodedPathname = decodeURIComponent(urlPathname)
  const normalizedPathname = decodedPathname === '/' ? '/index.html' : decodedPathname
  const candidates = [
    normalizedPathname,
    normalizedPathname.replace(/^\/Axol(?=\/|$)/, '') || '/index.html',
  ]

  return candidates.flatMap((candidate) => {
    const relativePath = candidate.startsWith('/') ? candidate.slice(1) : candidate
    const filePath = path.resolve(DIST_DIR, relativePath)
    if (filePath.startsWith(DIST_DIR + path.sep) || filePath === DIST_DIR) {
      return [filePath]
    }
    return []
  })
}

async function serveStaticAsset(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false

  let filePath = ''
  let stat

  for (const candidate of resolveDistPathCandidates(url.pathname)) {
    try {
      filePath = candidate
      stat = await fs.stat(filePath)
      if (stat.isDirectory()) {
        filePath = path.join(filePath, 'index.html')
        stat = await fs.stat(filePath)
      }
      if (stat.isFile()) break
    } catch {
      filePath = ''
      stat = undefined
    }
  }

  if (!filePath || !stat?.isFile()) {
    filePath = path.join(DIST_DIR, 'index.html')
    try {
      stat = await fs.stat(filePath)
    } catch {
      return false
    }
  }

  const headers = {
    'Content-Type': getMimeType(filePath),
    'Content-Length': String(stat.size),
    'Cache-Control': filePath.endsWith('index.html')
      ? 'no-cache'
      : 'public, max-age=31536000, immutable',
  }
  res.writeHead(200, headers)
  if (req.method === 'HEAD') {
    res.end()
    return true
  }
  res.end(await fs.readFile(filePath))
  return true
}

async function resolveTemplateAsset(assetUrl) {
  if (!assetUrl) return ''

  if (assetUrl.startsWith('data:')) {
    return assetUrl
  }

  try {
    const parsed = new URL(assetUrl)
    const pathname = decodeURIComponent(parsed.pathname)
    const relativePath = pathname.startsWith('/') ? pathname.slice(1) : pathname
    const filePath = path.resolve(PUBLIC_DIR, relativePath)

    if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== PUBLIC_DIR) {
      return ''
    }

    const buffer = await fs.readFile(filePath)
    const mimeType = getMimeType(filePath)
    return `data:${mimeType};base64,${buffer.toString('base64')}`
  } catch {
    return ''
  }
}

function buildHeaderTemplate({ logoUrl, eyebrow, title, reportId, issuedAtLabel, expiryLabel }) {
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" style="height:60px; max-width:132px; object-fit:contain; object-position:left center; display:block;" />`
    : `<span style="font-weight:700; color:#0f172a;">SIARO - Axol Engenharia</span>`

  return `
    <div style="width:100%; font-size:10px; color:#0f172a; font-family:Arial, sans-serif;">
      <div style="height:20px; background:#1a3a5c; -webkit-print-color-adjust:exact; print-color-adjust:exact;"></div>
      <div style="padding:6px 20px 0;">
        <div style="border-bottom:1px solid #cbd5e1; padding-bottom:6px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:132px; display:flex; align-items:center; justify-content:flex-start; flex-shrink:0;">
            ${logo}
          </div>
          <div style="flex:1; text-align:center; min-width:0;">
            <div style="font-size:8px; text-transform:uppercase; letter-spacing:.08em; color:#64748b;">${escapeHtml(eyebrow || 'Sistema SIARO - Axol Engenharia')}</div>
            <div style="font-size:16px; line-height:1.2; font-weight:700; margin-top:2px;">${escapeHtml(title || 'Relatório Técnico')}</div>
          </div>
          <div style="width:180px; text-align:right; flex-shrink:0;">
            <div style="font-size:8px; text-transform:uppercase; letter-spacing:.08em; color:#64748b;">Relatório</div>
            <div style="font-size:11px; font-family:monospace; font-weight:700; margin-top:2px;">${escapeHtml(reportId || '-')}</div>
            <div style="font-size:9px; color:#64748b; margin-top:2px;">Emitido em ${escapeHtml(issuedAtLabel || '')}</div>
            <div style="font-size:9px; color:#64748b; margin-top:1px;">${escapeHtml(expiryLabel || '')}</div>
          </div>
        </div>
      </div>
      </div>
    </div>
  `
}

function buildFooterTemplate({ validationUrl, qrUrl, analyst }) {
  const validation = validationUrl
    ? `<div style="font-size:8px; color:#64748b; margin-top:2px;">${escapeHtml(validationUrl)}</div>`
    : ''
  const analystLine = analyst
    ? `<div style="font-size:8px; color:#64748b; margin-top:2px;">Analista: ${escapeHtml(analyst)}</div>`
    : ''
  const qr = qrUrl
    ? `<img src="${escapeHtml(qrUrl)}" alt="QR" style="height:36px; width:36px; object-fit:contain; display:block;" />`
    : ''

  return `
    <div style="width:100%; font-size:9px; color:#475569; font-family:Arial, sans-serif;">
      <div style="padding:0 20px 4px;">
        <div style="border-top:1px solid #cbd5e1; padding-top:4px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div style="width:44px; display:flex; justify-content:flex-start;">
          ${qr}
        </div>
        <div style="flex:1; text-align:center;">
          <div>SIARO - Axol Engenharia</div>
          ${analystLine}
          ${validation}
        </div>
        <div style="width:120px; text-align:right; font-size:8px;">
          Pagina <span class="pageNumber"></span> de <span class="totalPages"></span>
        </div>
      </div>
      </div>
      <div style="height:20px; background:#F5B800; -webkit-print-color-adjust:exact; print-color-adjust:exact;"></div>
    </div>
  `
}

let browserPromise

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  }

  return browserPromise
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'POST' && url.pathname === '/generate-pdf') {
    try {
      const body = await readJson(req)
      const html = typeof body.html === 'string' ? body.html : ''

      if (!html.trim()) {
        sendText(res, 400, 'Campo "html" é obrigatório.')
        return
      }

      const browser = await getBrowser()
      const page = await browser.newPage()

      try {
        await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 })
        await page.setContent(html, { waitUntil: 'networkidle0' })
        await page.emulateMediaType('screen')

        const title = readMeta(html, 'report-title')
        const eyebrow = readMeta(html, 'report-eyebrow')
        const reportId = readMeta(html, 'report-id')
        const issuedAtLabel = readMeta(html, 'report-issued-label')
        const expiryLabel = readMeta(html, 'report-expiry-label')
        const logoUrl = readMeta(html, 'report-logo-url')
        const validationUrl = readMeta(html, 'report-validation-url')
        const qrUrl = readMeta(html, 'report-qr-url')
        const analyst = readMeta(html, 'report-analyst')
        const embeddedLogoUrl = await resolveTemplateAsset(logoUrl)
        const embeddedQrUrl = await resolveTemplateAsset(qrUrl)

        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          displayHeaderFooter: true,
          margin: {
            top: '124px',
            bottom: '84px',
            left: '20px',
            right: '20px',
          },
          headerTemplate: buildHeaderTemplate({
            logoUrl: embeddedLogoUrl || logoUrl,
            eyebrow,
            title,
            reportId,
            issuedAtLabel,
            expiryLabel,
          }),
          footerTemplate: buildFooterTemplate({
            validationUrl,
            qrUrl: embeddedQrUrl || qrUrl,
            analyst,
          }),
        })

        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${reportId || 'relatorio'}.pdf"`,
          'Content-Length': String(pdf.length),
        })
        res.end(pdf)
      } finally {
        await page.close()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao gerar PDF'
      sendText(res, 500, message)
    }
    return
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  if (await serveStaticAsset(req, res, url)) return

  sendText(res, 404, 'Not found')
})

server.listen(PORT, HOST, () => {
  console.log(`Axol server listening on http://${HOST}:${PORT}`)
  console.log(`Serving frontend from ${DIST_DIR}`)
})

async function shutdown() {
  server.close()
  if (browserPromise) {
    const browser = await browserPromise
    await browser.close()
  }
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
