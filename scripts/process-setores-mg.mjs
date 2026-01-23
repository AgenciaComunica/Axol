import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SRC = path.resolve(__dirname, '../src/assets/base_cities/MG_setores_CD2022.json')
const OUT_DIR = path.resolve(__dirname, '../src/assets/cities/setores-mg')
const INDEX_PATH = path.resolve(__dirname, '../src/assets/cities/setores-mg/index.json')
const args = process.argv.slice(2)
const targetCdMun = (() => {
  const idx = args.indexOf('--cd-mun')
  if (idx >= 0 && args[idx + 1]) return String(args[idx + 1])
  return ''
})()

fs.mkdirSync(OUT_DIR, { recursive: true })

const stream = fs.createReadStream(SRC, { encoding: 'utf8' })

const municipioMap = new Map()
const index = []

function getMunicipioCode(props) {
  if (!props || typeof props !== 'object') return ''
  if (props.CD_MUN) return String(props.CD_MUN)
  const candidates = Object.keys(props).filter((key) => /CD.*MUN|MUN.*CD/i.test(key))
  if (candidates.length) return String(props[candidates[0]] || '')
  return ''
}

function getMunicipioName(props) {
  if (!props || typeof props !== 'object') return ''
  if (props.NM_MUN) return String(props.NM_MUN)
  const candidates = Object.keys(props).filter((key) => /NM.*MUN|MUN.*NM/i.test(key))
  if (candidates.length) return String(props[candidates[0]] || '')
  return ''
}

function getWriter(code, name) {
  let entry = municipioMap.get(code)
  if (entry) return entry
  const safeName = name
    ? name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
    : code
  const filename = `${safeName}-${code}.geojson`
  const filePath = path.join(OUT_DIR, filename)
  const ws = fs.createWriteStream(filePath, { encoding: 'utf8' })
  ws.write('{"type":"FeatureCollection","features":[')
  entry = { code, name, count: 0, first: true, stream: ws, file: filename }
  municipioMap.set(code, entry)
  return entry
}

let buffer = ''
let inFeatures = false
let capturing = false
let braceDepth = 0
let inString = false
let escape = false
let seenFeaturesKey = false

function processFeature(jsonStr) {
  const feature = JSON.parse(jsonStr)
  const props = feature?.properties || {}
  const code = getMunicipioCode(props)
  if (targetCdMun && code !== targetCdMun) return
  if (!code) return
  const name = getMunicipioName(props)
  const entry = getWriter(code, name)
  if (!entry.first) {
    entry.stream.write(',')
  }
  entry.stream.write(JSON.stringify(feature))
  entry.first = false
  entry.count += 1
}

stream.on('data', (chunk) => {
  buffer += chunk

  for (let i = 0; i < buffer.length; i += 1) {
    const char = buffer[i]

    if (!inFeatures) {
      if (!seenFeaturesKey) {
        if (buffer.slice(i, i + 10) === '"features"') {
          seenFeaturesKey = true
          i += 9
        }
      } else if (char === '[') {
        inFeatures = true
      }
      continue
    }

    if (!capturing) {
      if (char === '{') {
        capturing = true
        braceDepth = 1
        inString = false
        escape = false
        const start = buffer.slice(i)
        buffer = start
        i = -1
      } else if (char === ']') {
        inFeatures = false
      }
      continue
    }

    if (capturing) {
      if (escape) {
        escape = false
        continue
      }
      if (char === '\\') {
        if (inString) escape = true
        continue
      }
      if (char === '"') {
        inString = !inString
        continue
      }
      if (!inString) {
        if (char === '{') braceDepth += 1
        if (char === '}') braceDepth -= 1
      }

      if (braceDepth === 0) {
        const jsonStr = buffer.slice(0, i + 1)
        processFeature(jsonStr)
        buffer = buffer.slice(i + 1)
        i = -1
        capturing = false
      }
    }
  }

  if (!capturing && buffer.length > 2048) {
    buffer = buffer.slice(-2048)
  }
})

stream.on('end', () => {
  for (const entry of municipioMap.values()) {
    entry.stream.write(']}')
    entry.stream.end()
    index.push({
      cd_mun: entry.code,
      nm_mun: entry.name,
      total_setores: entry.count,
      file: entry.file,
    })
  }
  index.sort((a, b) => String(a.nm_mun).localeCompare(String(b.nm_mun)))
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf8')
  process.stdout.write(`Gerado ${index.length} arquivos em ${OUT_DIR}\n`)
})

stream.on('error', (err) => {
  process.stderr.write(`${err.message}\n`)
  process.exit(1)
})
