import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { COUNTRIES } from '../src/data/countries.js'

const payload = JSON.parse(await readFile(new URL('../src/data/channels.json', import.meta.url), 'utf8'))
const ids = new Set()
const allowedFormats = new Set(['hls', 'external'])
const allowedCategories = new Set(['news', 'general', 'local', 'music', 'sports', 'kids', 'culture', 'parliament'])
const countryCodes = new Set(COUNTRIES.map((country) => country.code))

assert.ok(Array.isArray(payload.channels), 'channels must be an array')
assert.ok(payload.channels.length > 100, 'expected a substantial channel catalog')
assert.match(payload.generatedAt, /^\d{4}-\d{2}-\d{2}/, 'generatedAt must be an ISO date')
assert.equal(COUNTRIES.length, countryCodes.size, 'country codes must be unique')
assert.ok(COUNTRIES.length >= 50, 'the catalog must cover all European countries and areas')

for (const channel of payload.channels) {
  assert.ok(channel.id && channel.name && channel.country && channel.url, `missing required fields: ${JSON.stringify(channel)}`)
  assert.equal(ids.has(channel.id), false, `duplicate id: ${channel.id}`)
  ids.add(channel.id)
  assert.equal(channel.url.startsWith('https://'), true, `insecure URL: ${channel.url}`)
  assert.equal(channel.url.includes('?'), false, `query-string URL excluded: ${channel.id}`)
  assert.equal(countryCodes.has(channel.country), true, `unknown country: ${channel.country}`)
  assert.equal(channel.name.includes('Ⓖ'), false, `geoblocked marker leaked into ${channel.name}`)
  assert.equal(allowedFormats.has(channel.format), true, `unsupported format: ${channel.format}`)
  assert.equal(allowedCategories.has(channel.category), true, `unsupported category: ${channel.category}`)
}

console.log(`Validated ${payload.channels.length} secure, non-geoblocked European channels.`)
