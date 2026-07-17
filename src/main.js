import channelsPayload from './data/channels.json'
import { COUNTRIES, COUNTRY_BY_CODE, REGIONS } from './data/countries.js'
import './styles.css'

const app = document.querySelector('#app')
const channels = channelsPayload.channels
const channelById = new Map(channels.map((channel) => [channel.id, channel]))
const counts = channels.reduce((result, channel) => {
  result[channel.country] = (result[channel.country] || 0) + 1
  return result
}, {})

const categories = [
  ['all', 'Alle'],
  ['news', 'Nyheter'],
  ['movies', 'Filmer'],
  ['series', 'Serier'],
  ['documentary', 'Dokumentarer'],
  ['entertainment', 'Underholdning'],
  ['sports', 'Sport'],
  ['kids', 'Barn'],
  ['music', 'Musikk'],
  ['culture', 'Kultur'],
  ['business', 'Økonomi'],
  ['education', 'Læring'],
  ['parliament', 'Samfunn'],
  ['local', 'Lokalt'],
  ['religious', 'Religion'],
  ['lifestyle', 'Livsstil'],
  ['shop', 'Shopping'],
  ['general', 'Generelt'],
]

const state = {
  query: '',
  category: 'all',
  sort: 'name',
  favoritesOnly: false,
  visible: 48,
  favorites: readStorage('tvgreier_favorites', []),
  checks: readStorage('tvgreier_checks', {}),
  hls: null,
}

function readStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private browsing can block storage. The site still works without it.
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function normalize(value = '') {
  return value.toLocaleLowerCase('nb-NO').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function safeUrl(value = '') {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : ''
  } catch {
    return ''
  }
}

function plural(count, singular, pluralForm = `${singular}er`) {
  return `${count.toLocaleString('nb-NO')} ${count === 1 ? singular : pluralForm}`
}

function icon(name, className = '') {
  const paths = {
    arrow: '<path d="m9 18 6-6-6-6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    play: '<path d="m8 5 11 7-11 7z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    tv: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="m8 2 4 4 4-4"/>',
  }
  return `<svg class="icon ${className}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`
}

function shell(content, route = 'home') {
  return `
    <header class="site-header">
      <a class="brand" href="#/" aria-label="TVgreier – gå til forsiden">
        <span class="brand-mark">${icon('play')}</span>
        <span>TV<span>greier</span></span>
      </a>
      <nav aria-label="Hovedmeny">
        <a href="#/" class="nav-link ${route === 'home' ? 'active' : ''}">Land</a>
        <a href="#/favorites" class="nav-link ${route === 'favorites' ? 'active' : ''}">Mine kanaler</a>
        <a href="#/about" class="nav-link ${route === 'about' ? 'active' : ''}">Om tjenesten</a>
      </nav>
    </header>
    <main id="main-content">${content}</main>
    <footer class="site-footer">
      <a class="brand footer-brand" href="#/"><span class="brand-mark">${icon('play')}</span><span>TV<span>greier</span></span></a>
      <p>En uavhengig katalog. Vi lagrer eller sender ikke TV-innhold.</p>
      <div><a href="#/about">Kilder og metode</a><a href="https://github.com/dahellboy-source/tvgreier/issues" target="_blank" rel="noreferrer">Meld feil ${icon('external')}</a></div>
    </footer>
    ${playerDialog()}
  `
}

function playerDialog() {
  return `
    <dialog class="player-dialog" id="player-dialog" aria-labelledby="player-title">
      <div class="player-topbar">
        <div>
          <span class="eyebrow">Direkte</span>
          <h2 id="player-title">Laster kanal</h2>
        </div>
        <button class="icon-button" data-close-player aria-label="Lukk avspiller">${icon('close')}</button>
      </div>
      <div class="video-frame">
        <video id="video-player" controls playsinline></video>
        <div class="player-poster" id="player-poster">
          <div class="player-spinner" aria-hidden="true"></div>
          <p>Kobler til direktesendingen …</p>
        </div>
      </div>
      <div class="player-status" id="player-status" role="status"></div>
      <div class="player-actions">
        <p>Sendingen kommer direkte fra den offentlige kilden og kan endres uten varsel.</p>
        <a id="source-link" class="text-link" target="_blank" rel="noreferrer">Åpne strømmeadressen ${icon('external')}</a>
      </div>
    </dialog>
  `
}

function renderHome() {
  const content = `
    <section class="hero">
      <div class="hero-copy">
        <span class="eyebrow"><span class="live-dot"></span> Gratis TV fra Europa</span>
        <h1>Europa.<br><em>På direkten.</em></h1>
        <p>Velg et land og finn åpne TV-kanaler du kan prøve fra Norge – uten abonnement og uten gråsone-lister.</p>
        <a class="primary-button" href="#countries">Velg land ${icon('arrow')}</a>
      </div>
      <div class="hero-orbit" aria-hidden="true">
        <div class="orbit orbit-one"></div>
        <div class="orbit orbit-two"></div>
        <div class="orbital-card card-a">🇫🇷<span>France 24</span><i></i></div>
        <div class="orbital-card card-b">🇮🇪<span>RTÉ News</span><i></i></div>
        <div class="orbital-card card-c">🇪🇸<span>24 Horas</span><i></i></div>
        <div class="europe-word">EUROPA</div>
      </div>
    </section>

    <section class="trust-strip" aria-label="Nøkkeltall">
      <div><strong>${COUNTRIES.length}</strong><span>land og områder</span></div>
      <div><strong>${channels.length.toLocaleString('nb-NO')}</strong><span>åpne kanaler</span></div>
      <div><strong>0 kr</strong><span>abonnement</span></div>
      <p>${icon('check')} Kjente geoblokker, usikre HTTP-strømmer og lenker med parametere er filtrert bort.</p>
    </section>

    <section class="country-section" id="countries">
      <div class="section-heading">
        <div><span class="eyebrow">Finn frem</span><h2>Hvor vil du se fra?</h2></div>
        <label class="search-field">
          <span class="sr-only">Søk etter land</span>
          ${icon('search')}
          <input id="country-search" type="search" placeholder="Søk etter land" autocomplete="off" />
        </label>
      </div>
      <div id="country-results">${countrySections()}</div>
    </section>

    <section class="method-callout">
      <div class="method-icon">${icon('check')}</div>
      <div><span class="eyebrow">Norge-filteret</span><h2>Færre blindveier. Mer TV.</h2></div>
      <p>Vi tar bare med sikre HTTPS-kilder som ikke er merket med kjent GeoIP-blokkering. Når en strøm starter hos deg, lagres sjekken kun lokalt i nettleseren din.</p>
      <a href="#/about" class="text-link">Se hvordan utvalget lages ${icon('arrow')}</a>
    </section>
  `
  app.innerHTML = shell(content, 'home')
  bindGlobalEvents()
  const input = document.querySelector('#country-search')
  input?.addEventListener('input', () => {
    document.querySelector('#country-results').innerHTML = countrySections(input.value)
  })
}

function countrySections(query = '') {
  const needle = normalize(query)
  const filtered = COUNTRIES.filter((country) => normalize(`${country.name} ${country.region}`).includes(needle))

  if (!filtered.length) {
    return `<div class="empty-state"><span>Ingen treff</span><h3>Prøv et annet landnavn</h3><p>Vi har lagt inn alle europeiske land, også de som foreløpig ikke har godkjente strømmer.</p></div>`
  }

  return REGIONS.map((region) => {
    const countries = filtered.filter((country) => country.region === region)
    if (!countries.length) return ''
    return `
      <div class="region-block">
        <h3>${escapeHtml(region)}</h3>
        <div class="country-grid">
          ${countries.map(countryCard).join('')}
        </div>
      </div>
    `
  }).join('')
}

function countryCard(country) {
  const count = counts[country.code] || 0
  return `
    <a class="country-card ${count === 0 ? 'muted' : ''}" href="#/country/${country.code}">
      <span class="flag" aria-hidden="true">${country.flag}</span>
      <span class="country-meta">
        <strong>${escapeHtml(country.name)}</strong>
        <small>${count ? plural(count, 'kanal') : 'Ingen godkjente ennå'}</small>
      </span>
      <span class="country-arrow">${icon('arrow')}</span>
    </a>
  `
}

function parseRoute() {
  const route = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (route[0] === 'country' && route[1]) return { name: 'country', code: route[1].toUpperCase() }
  if (route[0] === 'favorites') return { name: 'favorites' }
  if (route[0] === 'about') return { name: 'about' }
  return { name: 'home' }
}

function renderCountry(code, favoritesOnly = false) {
  const country = COUNTRY_BY_CODE.get(code)
  if (!country && !favoritesOnly) {
    location.hash = '#/'
    return
  }

  state.query = ''
  state.category = 'all'
  state.sort = 'name'
  state.favoritesOnly = favoritesOnly
  state.visible = 48

  const scopedChannels = favoritesOnly
    ? channels.filter((channel) => state.favorites.includes(channel.id))
    : channels.filter((channel) => channel.country === code)
  const title = favoritesOnly ? 'Mine kanaler' : country.name
  const flag = favoritesOnly ? '♥' : country.flag
  const subtitle = favoritesOnly
    ? 'Favorittene dine lagres bare i denne nettleseren.'
    : `${country.language} · ${plural(scopedChannels.length, 'åpen kanal', 'åpne kanaler')}`

  const content = `
    <section class="catalog-hero">
      <a class="back-link" href="#/">${icon('back')} Alle land</a>
      <div class="catalog-title">
        <span class="catalog-flag" aria-hidden="true">${flag}</span>
        <div><span class="eyebrow">${favoritesOnly ? 'Din samling' : escapeHtml(country.region)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div>
      </div>
      ${favoritesOnly ? '' : `<div class="filter-note">${icon('info')} Kanaler med kjent GeoIP-blokkering er tatt ut av denne oversikten.</div>`}
    </section>
    <section class="catalog-section">
      <div class="catalog-toolbar">
        <label class="search-field grow">
          <span class="sr-only">Søk etter kanal</span>${icon('search')}
          <input id="channel-search" type="search" placeholder="Søk i ${escapeHtml(title)}" autocomplete="off" />
        </label>
        <label class="sort-field"><span>Sorter</span><select id="channel-sort"><option value="name">A–Å</option><option value="category">Kategori</option><option value="checked">Sjekket hos meg</option></select></label>
      </div>
      <div class="category-picker" aria-label="Velg kategori">
        <span class="category-picker-label">Velg kategori</span>
        <div class="category-row" id="category-row">
        ${categories.map(([value, label]) => `<button data-category="${value}" class="filter-pill ${value === 'all' ? 'active' : ''}">${label}</button>`).join('')}
        </div>
      </div>
      <div class="catalog-summary" id="catalog-summary"></div>
      <div class="channel-grid" id="channel-grid"></div>
      <div class="load-more-wrap" id="load-more-wrap"></div>
    </section>
  `
  app.innerHTML = shell(content, favoritesOnly ? 'favorites' : 'country')
  bindGlobalEvents()

  const input = document.querySelector('#channel-search')
  input?.addEventListener('input', () => {
    state.query = input.value
    state.visible = 48
    updateChannelGrid(scopedChannels)
  })

  document.querySelector('#channel-sort')?.addEventListener('change', (event) => {
    state.sort = event.target.value
    updateChannelGrid(scopedChannels)
  })

  document.querySelector('#category-row')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]')
    if (!button) return
    state.category = button.dataset.category
    state.visible = 48
    document.querySelectorAll('[data-category]').forEach((item) => item.classList.toggle('active', item === button))
    updateChannelGrid(scopedChannels)
  })

  updateChannelGrid(scopedChannels)
}

function getFilteredChannels(scopedChannels) {
  const needle = normalize(state.query)
  return scopedChannels
    .filter((channel) => state.category === 'all' || channel.category === state.category)
    .filter((channel) => normalize(channel.name).includes(needle))
    .sort((a, b) => {
      if (state.sort === 'category') return a.category.localeCompare(b.category, 'nb-NO') || a.name.localeCompare(b.name, 'nb-NO')
      if (state.sort === 'checked') return Number(Boolean(state.checks[b.id])) - Number(Boolean(state.checks[a.id])) || a.name.localeCompare(b.name, 'nb-NO')
      return a.name.localeCompare(b.name, 'nb-NO')
    })
}

function updateChannelGrid(scopedChannels) {
  const filtered = getFilteredChannels(scopedChannels)
  const visible = filtered.slice(0, state.visible)
  const grid = document.querySelector('#channel-grid')
  const summary = document.querySelector('#catalog-summary')
  const loadMore = document.querySelector('#load-more-wrap')

  if (summary) summary.innerHTML = `<p>Viser <strong>${Math.min(visible.length, filtered.length).toLocaleString('nb-NO')}</strong> av ${plural(filtered.length, 'kanal')}</p>`
  if (grid) {
    grid.innerHTML = visible.length ? visible.map(channelCard).join('') : emptyChannels()
    grid.onclick = (event) => {
      const favoriteButton = event.target.closest('[data-favorite]')
      const playButton = event.target.closest('[data-play]')
      if (favoriteButton) toggleFavorite(favoriteButton.dataset.favorite, scopedChannels)
      if (playButton) openPlayer(playButton.dataset.play)
    }
  }
  if (loadMore) {
    loadMore.innerHTML = filtered.length > state.visible
      ? `<button class="secondary-button" id="load-more">Vis flere <span>${Math.min(48, filtered.length - state.visible)}</span></button>`
      : ''
    document.querySelector('#load-more')?.addEventListener('click', () => {
      state.visible += 48
      updateChannelGrid(scopedChannels)
    })
  }
}

function categoryLabel(value) {
  return categories.find(([category]) => category === value)?.[1] || 'TV'
}

function channelCard(channel) {
  const favorite = state.favorites.includes(channel.id)
  const checked = state.checks[channel.id]
  const url = safeUrl(channel.url)
  const initials = channel.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()
  const canPlay = channel.format === 'hls'
  const unavailable = channel.availability === 'offline'
  return `
    <article class="channel-card ${unavailable ? 'unavailable' : ''}" data-channel-card="${escapeHtml(channel.id)}">
      <div class="channel-logo-wrap">
        <span class="logo-fallback">${escapeHtml(initials)}</span>
        ${channel.logo ? `<img src="${escapeHtml(safeUrl(channel.logo))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
        <button class="favorite-button ${favorite ? 'active' : ''}" data-favorite="${escapeHtml(channel.id)}" aria-label="${favorite ? 'Fjern fra' : 'Legg til i'} mine kanaler" aria-pressed="${favorite}">${icon('heart')}</button>
      </div>
      <div class="channel-body">
        <div class="channel-badges">
          <span>${escapeHtml(categoryLabel(channel.category))}</span>
          ${unavailable
            ? '<span class="offline-badge">Midlertidig utilgjengelig</span>'
            : checked ? `<span class="checked-badge">${icon('check')} Sjekket ${escapeHtml(checked.slice(0, 10))}</span>` : '<span class="open-badge">Ingen kjent geoblokk</span>'}
        </div>
        <h3>${escapeHtml(channel.name)}</h3>
        <p>${channel.quality === 'sd' ? 'SD-kvalitet' : 'Automatisk kvalitet'} · ${escapeHtml(channel.platform)}</p>
        ${unavailable
          ? '<span class="watch-button disabled" aria-disabled="true">Kontrolleres automatisk</span>'
          : canPlay
          ? `<button class="watch-button" data-play="${escapeHtml(channel.id)}">${icon('play')} Se direkte</button>`
          : `<a class="watch-button" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${icon('external')} Åpne kanal</a>`}
      </div>
    </article>
  `
}

function emptyChannels() {
  return `<div class="empty-state channel-empty"><span>Ingen kanaler her ennå</span><h3>Prøv et annet filter</h3><p>Noen små land har foreløpig ingen åpne HTTPS-strømmer uten kjent geoblokkering.</p><a class="secondary-button" href="#/">Velg et annet land</a></div>`
}

function toggleFavorite(id, scopedChannels) {
  const index = state.favorites.indexOf(id)
  if (index >= 0) state.favorites.splice(index, 1)
  else state.favorites.push(id)
  writeStorage('tvgreier_favorites', state.favorites)
  updateChannelGrid(scopedChannels)
}

async function openPlayer(id) {
  const channel = channelById.get(id)
  if (!channel) return
  const dialog = document.querySelector('#player-dialog')
  const video = document.querySelector('#video-player')
  const poster = document.querySelector('#player-poster')
  const status = document.querySelector('#player-status')
  const sourceLink = document.querySelector('#source-link')
  document.querySelector('#player-title').textContent = channel.name
  sourceLink.href = safeUrl(channel.officialUrl || channel.url)
  sourceLink.innerHTML = `${channel.officialUrl ? 'Åpne offisiell side' : 'Åpne strømmeadressen'} ${icon('external')}`
  status.innerHTML = `<span>${icon('info')} Tester avspilling fra forbindelsen din …</span>`
  poster.innerHTML = `<div class="player-spinner" aria-hidden="true"></div><p>Kobler til direktesendingen …</p>`
  poster.hidden = false
  dialog.showModal()

  destroyPlayer()
  const markPlaying = () => {
    poster.hidden = true
    const date = new Date().toISOString()
    state.checks[channel.id] = date
    writeStorage('tvgreier_checks', state.checks)
    status.innerHTML = `<span class="success">${icon('check')} Bekreftet spillbar på denne forbindelsen ${new Date(date).toLocaleDateString('nb-NO')}</span>`
  }
  const markError = () => {
    poster.hidden = false
    poster.innerHTML = `<div class="player-error-icon">!</div><p>Strømmen svarte ikke akkurat nå.</p>`
    status.innerHTML = `<span class="error">Kanaladresser kan endres. Prøv kildelenken eller meld fra om feilen.</span>`
  }

  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = channel.url
    video.addEventListener('loadedmetadata', markPlaying, { once: true })
    video.addEventListener('error', markError, { once: true })
    video.play().catch(() => {})
  } else {
    const { default: Hls } = await import('hls.js')
    if (!dialog.open) return
    if (!Hls.isSupported()) {
      markError()
      return
    }
    let networkRetries = 0
    let mediaRetries = 0
    const maxNetworkRetries = 2
    const maxMediaRetries = 1
    state.hls = new Hls({ enableWorker: true, lowLatencyMode: true })
    state.hls.loadSource(channel.url)
    state.hls.attachMedia(video)
    state.hls.on(Hls.Events.MANIFEST_PARSED, () => {
      markPlaying()
      video.play().catch(() => {})
    })
    state.hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < maxNetworkRetries) {
        networkRetries += 1
        status.innerHTML = `<span>${icon('info')} Nettverket svarte ikke. Prøver igjen (${networkRetries}/${maxNetworkRetries}) …</span>`
        setTimeout(() => state.hls?.startLoad(), networkRetries * 1200)
        return
      }
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries < maxMediaRetries) {
        mediaRetries += 1
        status.innerHTML = `<span>${icon('info')} Avspillingen trenger en ny oppstart …</span>`
        state.hls.recoverMediaError()
        return
      }
      markError()
    })
  }
}

function destroyPlayer() {
  if (state.hls) {
    state.hls.destroy()
    state.hls = null
  }
  const video = document.querySelector('#video-player')
  if (video) {
    video.pause()
    video.removeAttribute('src')
    video.load()
  }
}

function bindGlobalEvents() {
  const dialog = document.querySelector('#player-dialog')
  document.querySelector('[data-close-player]')?.addEventListener('click', () => dialog.close())
  dialog?.addEventListener('close', destroyPlayer)
  dialog?.addEventListener('click', (event) => {
    const bounds = dialog.getBoundingClientRect()
    const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom
    if (outside) dialog.close()
  })
}

function renderAbout() {
  const content = `
    <section class="text-hero">
      <a class="back-link" href="#/">${icon('back')} Til forsiden</a>
      <span class="eyebrow">Åpenhet først</span>
      <h1>Slik velger vi kanaler</h1>
      <p>TVgreier er en katalog og avspiller for gratis strømmer. Vi hoster ingen sendinger og omgår ingen tilgangskontroller.</p>
    </section>
    <section class="about-grid">
      <article><span>01</span><h2>Gratis og offentlig</h2><p>Grunnlisten kommer fra det åpne Free-TV/IPTV-prosjektet, som krever at kanalene er gratis tilgjengelige og ikke del av et privat abonnement.</p></article>
      <article><span>02</span><h2>Norge-filter</h2><p>Alle kilder merket med GeoIP-blokkering er utelatt. Vi fjerner også usikre HTTP-lenker som moderne nettlesere normalt vil blokkere.</p></article>
      <article><span>03</span><h2>Automatisk statuskontroll</h2><p>Hver kanal kontrolleres jevnlig. Kilder som ikke svarer markeres grått, og blir tilgjengelige igjen når kontrollen lykkes. Når en kanal faktisk starter, lagres datoen også lokalt hos deg.</p></article>
      <article><span>04</span><h2>Ingen garanti</h2><p>Direktestrømmer kan flyttes, stoppe eller få nye rettighetsgrenser. «Ingen kjent geoblokk» betyr derfor ikke en evig tilgjengelighetsgaranti.</p></article>
    </section>
    <section class="source-panel">
      <div><span class="eyebrow">Datasett</span><h2>${channels.length.toLocaleString('nb-NO')} kanaler i øyeblikksbildet</h2></div>
      <dl><div><dt>Kilde</dt><dd>Free-TV/IPTV</dd></div><div><dt>Kilde kontrollert</dt><dd>${new Date(channelsPayload.generatedAt).toLocaleDateString('nb-NO')}</dd></div><div><dt>Filtrering</dt><dd>Europa · HTTPS · ingen kjent GeoIP-blokk · ingen URL-parametere</dd></div></dl>
      <a class="secondary-button" href="${escapeHtml(channelsPayload.sourceUrl)}" target="_blank" rel="noreferrer">Se kildedatasettet ${icon('external')}</a>
    </section>
    <section class="legal-copy">
      <h2>Rettigheter og feil</h2>
      <p>Alle varemerker og sendinger tilhører sine respektive rettighetshavere. TVgreier peker bare til eksterne, offentlig oppførte kilder. En rettighetshaver eller seer kan <a href="https://github.com/dahellboy-source/tvgreier/issues" target="_blank" rel="noreferrer">melde feil eller be om at en lenke vurderes</a>.</p>
    </section>
  `
  app.innerHTML = shell(content, 'about')
  bindGlobalEvents()
}

function render() {
  destroyPlayer()
  const route = parseRoute()
  if (route.name === 'country') renderCountry(route.code)
  else if (route.name === 'favorites') renderCountry(null, true)
  else if (route.name === 'about') renderAbout()
  else renderHome()
  window.scrollTo({ top: 0, behavior: 'instant' })
}

window.addEventListener('hashchange', render)
render()
