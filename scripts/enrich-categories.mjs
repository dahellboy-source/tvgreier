import { readFile, writeFile } from 'node:fs/promises'

const sourcePath = process.argv[2]
if (!sourcePath) throw new Error('Usage: node scripts/enrich-categories.mjs /path/to/iptv-org-channels.json')

const catalogPath = new URL('../src/data/channels.json', import.meta.url)
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
const registry = JSON.parse(await readFile(sourcePath, 'utf8'))

const normalise = (value = '') => value
  .toLocaleLowerCase('en')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, '')

const byId = new Map(registry.map((channel) => [channel.id, channel]))
const byName = new Map()
for (const channel of registry) {
  for (const name of [channel.name, ...(channel.alt_names || [])]) {
    const key = `${channel.country}|${normalise(name)}`
    const options = byName.get(key) || []
    options.push(channel)
    byName.set(key, options)
  }
}

const categoryPriority = [
  'movies', 'series', 'documentary', 'news', 'sports', 'kids', 'music',
  'entertainment', 'culture', 'legislative', 'business', 'education',
  'lifestyle', 'religious', 'shop', 'general', 'public', 'local',
]

function registryCategory(categories = []) {
  const category = categoryPriority.find((item) => categories.includes(item))
  if (['general', 'public', 'local', undefined].includes(category)) return null
  return category === 'legislative' ? 'parliament' : category
}

function inferredCategory(name = '') {
  const value = name.toLocaleLowerCase('en')
  if (/(parliament|parlamento|parlament|folketing|senato|senat|congress|congreso|bundestag|riksdag|rada |assembly|assemblee|assemblée)/i.test(value)) return 'parliament'
  if (/(movie|movies|film|cinema|cine|kino)/i.test(value)) return 'movies'
  if (/(series|serial|telenovela|drama)/i.test(value)) return 'series'
  if (/(documentar|history|natura|nature|wild|discovery|explore|travel)/i.test(value)) return 'documentary'
  if (/(sport|calcio|fútbol|futbol|racing|arena sport|match tv)/i.test(value)) return 'sports'
  if (/(kids|kiddo|junior|baby|cartoon|anim|duck tv|boing|child)/i.test(value)) return 'kids'
  if (/(music|musica|música|muzik|müzik|hits|dance|folk tv|rock tv|radio tv|radio vision|radiovision)/i.test(value)) return 'music'
  if (/(news|nyheter|noticias|notícia|notizie|nouvelles|actualit|info |info$|24 horas|24h|24 tv|cnn|euronews|bloomberg|tagesschau|rai news|sky news|telejurnal|kanal 24|canal 24)/i.test(value)) return 'news'
  if (/(entertainment|show|comedy|reality|fun tv)/i.test(value)) return 'entertainment'
  if (/(culture|cultura|kultur|arte |arte$|museum)/i.test(value)) return 'culture'
  if (/(business|finance|economy|economia)/i.test(value)) return 'business'
  if (/(education|edu tv|university|school)/i.test(value)) return 'education'
  if (/(religion|church|faith|islam|christ|bible|catholic)/i.test(value)) return 'religious'
  if (/(local|regional|regionale|municipal|city tv|canale [0-9]+|tele.*(bari|roma|milano|napoli|sicilia|puglia|veneto|lombardia|toscana|calabria))/i.test(value)) return 'local'
  return 'general'
}

let idMatches = 0
let nameMatches = 0
for (const channel of catalog.channels) {
  let record = byId.get(channel.id)
  if (record) idMatches += 1
  if (!record) {
    const options = byName.get(`${channel.country}|${normalise(channel.name)}`) || []
    if (options.length === 1) {
      record = options[0]
      nameMatches += 1
    }
  }
  const mapped = registryCategory(record?.categories)
  channel.category = mapped || inferredCategory(channel.name)
  if (record?.website?.startsWith('https://') && !record.website.includes('?')) channel.officialUrl = record.website
  else delete channel.officialUrl
}

catalog.categoryEnrichedAt = new Date().toISOString()
catalog.categorySource = 'iptv-org/database channel metadata with name-based fallback'
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`)
console.log(JSON.stringify({ total: catalog.channels.length, idMatches, nameMatches }, null, 2))
