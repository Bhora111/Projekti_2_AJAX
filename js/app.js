'use strict';

/* =========================================================
   Leffahaku – Projekti 2a: AJAX-kutsu live REST API:in
   Data haetaan OMDb-rajapinnasta: https://www.omdbapi.com/

   Ohjelman kulku (tehtävänannon neljä vaihetta):
     1. Pyydetään dataa OMDb:ltä AJAX-kutsulla        -> fetchMovies()
     2. Tallennetaan tulos ja valitaan käytettävä data -> searchState, pickMovieData()
     3. Näytetään data sivulla                        -> renderMovies(), updatePagination()
     4. Käyttäjä käynnistää uuden haun                -> hakukenttä, pudotusvalikot ja sivutus
   ========================================================= */


/* ---------- Asetukset ---------- */

// OMDb:n osoite ja oma API-avain (ilmaisavain, 1000 hakua vuorokaudessa)
const API_URL = 'https://www.omdbapi.com/';
const API_KEY = '5066635e';

// OMDb palauttaa 10 tulosta sivulla ja antaa selata enintään 100 sivua
const RESULTS_PER_PAGE = 10;
const MAX_PAGES = 100;

// Vuosivalikon vanhin vuosi (uusin on aina kuluva vuosi)
const FIRST_YEAR = 1920;

// OMDb palauttaa tyypit englanniksi, joten käännetään ne suomeksi
const TYPE_NAMES = {
  movie: 'elokuva',
  series: 'sarja',
  episode: 'jakso',
  game: 'peli'
};

// Pikahakuvalikon vaihtoehdot: label näkyy valikossa, query lähetetään OMDb:lle
const QUICK_SEARCHES = [
  { label: 'Star Wars', query: 'Star Wars' },
  { label: 'Harry Potter', query: 'Harry Potter' },
  { label: 'Taru sormusten herrasta', query: 'Lord of the Rings' },
  { label: 'Batman', query: 'Batman' },
  { label: 'Avengers', query: 'Avengers' },
  { label: 'Toy Story', query: 'Toy Story' },
  { label: 'Jurassic Park', query: 'Jurassic' },
  { label: 'Shrek', query: 'Shrek' },
  { label: 'Frozen', query: 'Frozen' },
  { label: 'Matrix', query: 'Matrix' }
];


/* ---------- HTML-elementit ---------- */

// Haetaan tarvittavat elementit muuttujiin kerran,
// ettei niitä tarvitse etsiä sivulta joka haun yhteydessä uudelleen
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const typeSelect = document.getElementById('type-select');
const yearSelect = document.getElementById('year-select');
const quickSelect = document.getElementById('quick-select');
const statusText = document.getElementById('status');
const resultsGrid = document.getElementById('results');
const pagination = document.getElementById('pagination');
const prevButton = document.getElementById('prev-page');
const nextButton = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');


/* ---------- Sovelluksen tila ---------- */

// Viimeisimmän haun tiedot. Kun käyttäjä vaihtaa sivua,
// sama haku tehdään uudelleen eri sivunumerolla.
const searchState = {
  query: '',
  type: '',
  year: '',
  page: 1,
  totalPages: 0
};

// Kesken olevan haun AbortController, jolla haku voidaan perua
let activeRequest = null;


/* ---------- 1. Datan pyytäminen (AJAX-kutsu) ---------- */

/**
 * Hakee OMDb:stä elokuvia annetuilla hakuehdoilla.
 * fetch() lähettää HTTP-pyynnön taustalla ilman, että sivu latautuu uudelleen (= AJAX).
 * @param {object} search Hakuehdot: query, type, year ja page
 * @param {AbortSignal} signal Signaali, jolla pyyntö voidaan perua kesken
 * @returns {Promise<object>} OMDb:n vastaus JavaScript-oliona
 */
async function fetchMovies(search, signal) {
  // URLSearchParams rakentaa osoitteen kyselyosan (?apikey=...&s=...&page=...)
  // ja koodaa välilyönnit ja erikoismerkit oikein
  const params = new URLSearchParams({
    apikey: API_KEY,
    s: search.query,
    page: search.page
  });

  // Suodattimet lisätään osoitteeseen vain, jos käyttäjä on valinnut ne
  if (search.type) {
    params.set('type', search.type);
  }
  if (search.year) {
    params.set('y', search.year);
  }

  // await odottaa palvelimen vastausta ennen kuin koodi jatkuu.
  // Sillä välin selain ja sivu toimivat normaalisti.
  const response = await fetch(`${API_URL}?${params}`, { signal });

  // Muutetaan vastauksen JSON-teksti JavaScript-olioksi
  const data = await response.json();

  // OMDb kertoo virheistä kentässä Response: "False" (esim. "Movie not found!").
  // Heitetään silloin virhe, jonka runSearch() ottaa kiinni.
  if (data.Response === 'False') {
    throw new Error(data.Error);
  }

  return data;
}


/* ---------- 2. Tuloksen tallennus ja datan valinta ---------- */

/**
 * Poimii OMDb:n vastauksesta vain ne tiedot, joita sivulla näytetään.
 * @param {object} data OMDb:n hakuvastaus
 * @returns {Array<object>} Taulukko elokuvista
 */
function pickMovieData(data) {
  // data.Search on taulukko hakutuloksista.
  // map() tekee jokaisesta tuloksesta uuden, siistimmän olion.
  return data.Search.map((item) => ({
    id: item.imdbID,
    title: item.Title,
    year: item.Year,
    type: TYPE_NAMES[item.Type] || item.Type,
    // OMDb merkitsee puuttuvan julisteen tekstillä "N/A"
    poster: item.Poster !== 'N/A' ? item.Poster : null
  }));
}

/**
 * Tekee haun searchState-olion tiedoilla ja näyttää tulokset.
 * Tätä kutsutaan sekä uudessa haussa että sivua vaihdettaessa.
 */
async function runSearch() {
  // Jos edellinen haku on vielä kesken, perutaan se.
  // Näin hitaasti saapuva vanha vastaus ei voi korvata uudempia tuloksia.
  if (activeRequest) {
    activeRequest.abort();
  }
  activeRequest = new AbortController();

  showStatus(`Haetaan "${searchState.query}"…`, 'loading');
  resultsGrid.replaceChildren();
  setPaginationDisabled(true);

  // try...catch: jos haku epäonnistuu missä tahansa kohdassa,
  // hypätään catch-lohkoon ja näytetään virheilmoitus
  try {
    const data = await fetchMovies(searchState, activeRequest.signal); // 1. pyydetään data
    const movies = pickMovieData(data);                                // 2. valitaan tarvittavat tiedot

    // Lasketaan sivujen määrä tulosten kokonaismäärästä (10 tulosta / sivu)
    const totalResults = Number(data.totalResults);
    searchState.totalPages = Math.min(Math.ceil(totalResults / RESULTS_PER_PAGE), MAX_PAGES);

    renderMovies(movies);                                              // 3. näytetään sivulla
    showStatus(buildResultText(totalResults));
  } catch (error) {
    // AbortError tarkoittaa, että haku peruttiin uuden haun tieltä.
    // Silloin ei näytetä virhettä, koska uusi haku hoitaa näkymän.
    if (error.name === 'AbortError') {
      return;
    }
    // Virhe voi tulla OMDb:ltä (esim. ei tuloksia) tai verkosta (ei yhteyttä)
    searchState.totalPages = 0;
    showStatus(translateError(error.message), 'error');
  }

  updatePagination();
}


/* ---------- 3. Datan näyttäminen ---------- */

/**
 * Näyttää elokuvakortit tulosalueella.
 * @param {Array<object>} movies pickMovieData():n palauttamat elokuvat
 */
function renderMovies(movies) {
  // Tyhjennetään edellisen haun tulokset
  resultsGrid.replaceChildren();

  // Kortit rakennetaan ensin DocumentFragmenttiin (näkymätön "välivarasto")
  // ja lisätään sivulle yhdellä kertaa. Selaimen ei tarvitse piirtää sivua jokaisen kortin kohdalla.
  const fragment = document.createDocumentFragment();
  for (const movie of movies) {
    fragment.append(createMovieCard(movie));
  }
  resultsGrid.append(fragment);
}

/**
 * Luo yhden elokuvakortin HTML-elementit.
 * Tekstit asetetaan textContentilla, jolloin API:n data näkyy aina
 * pelkkänä tekstinä eikä sitä voi tulkita HTML-koodiksi.
 * @param {object} movie Elokuvan tiedot
 * @returns {HTMLElement} Valmis kortti
 */
function createMovieCard(movie) {
  const card = document.createElement('article');
  card.className = 'movie-card';

  const info = document.createElement('div');
  info.className = 'movie-info';

  const title = document.createElement('h2');
  title.className = 'movie-title';
  title.textContent = movie.title;

  const meta = document.createElement('p');
  meta.className = 'movie-meta';

  const year = document.createElement('span');
  year.textContent = movie.year;

  const badge = document.createElement('span');
  badge.className = 'type-badge';
  badge.textContent = movie.type;

  // Kootaan osat sisäkkäin: kortti > (juliste + info > (otsikko + meta))
  meta.append(year, badge);
  info.append(title, meta);
  card.append(createPoster(movie), info);

  return card;
}

/**
 * Luo julistekuvan. Jos julistetta ei ole, palautetaan tilalle tekstilaatikko.
 * @param {object} movie Elokuvan tiedot
 * @returns {HTMLElement} img-elementti tai korvaava laatikko
 */
function createPoster(movie) {
  if (!movie.poster) {
    return createPosterPlaceholder();
  }

  const img = document.createElement('img');
  img.src = movie.poster;
  img.alt = `${movie.title}, juliste`;
  img.loading = 'lazy'; // kuva ladataan vasta kun se on tulossa näkyviin

  // Joskus julisteen osoite on rikki. Silloin kuva vaihdetaan korvaavaan laatikkoon.
  // Tämäkin tapahtumankäsittelijä lisätään dynaamisesti JavaScriptillä.
  img.addEventListener('error', () => {
    img.replaceWith(createPosterPlaceholder());
  }, { once: true });

  return img;
}

/**
 * Luo harmaan "Ei julistetta" -laatikon kuvan tilalle.
 * @returns {HTMLElement}
 */
function createPosterPlaceholder() {
  const placeholder = document.createElement('div');
  placeholder.className = 'poster-placeholder';
  placeholder.textContent = 'Ei julistetta';
  return placeholder;
}

/**
 * Näyttää viestin tulosten yläpuolella.
 * @param {string} message Näytettävä teksti
 * @param {'info'|'loading'|'error'} type Viestin tyyppi: loading näyttää pyörivän latausikonin
 *                                        ja error näyttää viestin virheen värillä
 */
function showStatus(message, type = 'info') {
  statusText.textContent = message;
  statusText.classList.toggle('error', type === 'error');
  statusText.classList.toggle('loading', type === 'loading');
}

/**
 * Muodostaa tulosviestin, esim. 'Löytyi 120 tulosta haulla "batman" (elokuva, 2008).'
 * @param {number} totalResults Tulosten kokonaismäärä
 * @returns {string}
 */
function buildResultText(totalResults) {
  const { query, type, year } = searchState;

  // Kootaan valitut suodattimet sulkeisiin
  const filters = [];
  if (type) {
    filters.push(TYPE_NAMES[type]);
  }
  if (year) {
    filters.push(year);
  }
  const filterText = filters.length > 0 ? ` (${filters.join(', ')})` : '';

  // toLocaleString lisää tuhaterottimen suomalaisittain, esim. 1 234
  const total = totalResults.toLocaleString('fi-FI');
  // Yksikkö ja monikko: "1 tulos" mutta "5 tulosta"
  const word = totalResults === 1 ? 'tulos' : 'tulosta';
  return `Löytyi ${total} ${word} haulla "${query}"${filterText}.`;
}

/**
 * Päivittää sivutuksen: sivunumeron sekä Edellinen- ja Seuraava-painikkeet.
 */
function updatePagination() {
  const { page, totalPages } = searchState;

  // Sivutus näytetään vain, jos tuloksia on useammalla kuin yhdellä sivulla
  pagination.hidden = totalPages <= 1;
  pageInfo.textContent = `Sivu ${page} / ${totalPages}`;

  // Ensimmäisellä sivulla ei voi mennä taaksepäin eikä viimeisellä eteenpäin
  prevButton.disabled = page <= 1;
  nextButton.disabled = page >= totalPages;
}

/**
 * Lukitsee sivutuspainikkeet haun ajaksi, ettei sivua voi vaihtaa kesken latauksen.
 * @param {boolean} disabled
 */
function setPaginationDisabled(disabled) {
  prevButton.disabled = disabled;
  nextButton.disabled = disabled;
}

/**
 * Kääntää OMDb:n englanninkieliset virheviestit suomeksi.
 * @param {string} message Alkuperäinen virheviesti
 * @returns {string} Käyttäjälle näytettävä viesti
 */
function translateError(message) {
  const translations = {
    'Movie not found!': 'Hakuehdoilla ei löytynyt yhtään elokuvaa. Kokeile toista hakusanaa tai suodatinta.',
    'Too many results.': 'Liikaa tuloksia. Kirjoita tarkempi hakusana.',
    'Invalid API key!': 'API-avain ei kelpaa. Tarkista avain tiedostosta js/app.js.',
    'Request limit reached!': 'Päivän hakuraja (1000 hakua) on täynnä. Yritä huomenna uudelleen.'
  };

  // Jos viestille ei ole käännöstä, kyse on yleensä verkkovirheestä
  return translations[message] || 'Haku epäonnistui. Tarkista verkkoyhteys ja yritä uudelleen.';
}


/* ---------- 4. Käyttäjä käynnistää haun ---------- */

/**
 * Aloittaa uuden haun: tallentaa hakusanan ja suodattimet ja palaa sivulle 1.
 * @param {string} query Hakusana
 */
function startNewSearch(query) {
  searchState.query = query;
  searchState.type = typeSelect.value;
  searchState.year = yearSelect.value;
  searchState.page = 1;
  searchState.totalPages = 0; // piilottaa vanhan sivutuksen, kunnes uudet tulokset tulevat
  updatePagination();
  runSearch();
}

/**
 * Hakulomakkeen lähetys (Hae-painike tai Enter).
 * @param {SubmitEvent} event Lomakkeen submit-tapahtuma
 */
function handleSearchSubmit(event) {
  // Estetään lomakkeen oletustoiminto, joka lataisi koko sivun uudelleen
  event.preventDefault();

  const query = searchInput.value.trim();
  if (query.length < 2) {
    showStatus('Kirjoita vähintään 2 merkkiä.', 'error');
    searchInput.focus();
    return;
  }

  startNewSearch(query);
}

/**
 * Tyypin tai vuoden vaihto: haku tehdään heti uudelleen,
 * jos hakukentässä on jo hakusana.
 */
function handleFilterChange() {
  const query = searchInput.value.trim();
  if (query.length >= 2) {
    startNewSearch(query);
  }
}

/**
 * Pikahakuvalikon valinta: kirjoitetaan valinta hakukenttään ja haetaan.
 */
function handleQuickSearch() {
  const query = quickSelect.value;
  if (!query) {
    return;
  }

  searchInput.value = query;
  // Palautetaan valikko alkutilaan, jotta saman vaihtoehdon voi valita uudelleen
  quickSelect.value = '';
  startNewSearch(query);
}

/**
 * Vaihtaa tulossivua eteen- tai taaksepäin.
 * @param {number} step +1 = seuraava sivu, -1 = edellinen sivu
 */
function changePage(step) {
  searchState.page += step;
  runSearch();
  // Vieritetään takaisin tulosten alkuun
  statusText.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


/* ---------- Pudotusvalikoiden täyttö ---------- */

/**
 * Lisää vuosivalikkoon vuodet kuluvasta vuodesta FIRST_YEAR-vuoteen asti.
 */
function fillYearSelect() {
  const currentYear = new Date().getFullYear();
  for (let year = currentYear; year >= FIRST_YEAR; year--) {
    // new Option(teksti, arvo) luo uuden <option>-elementin
    yearSelect.append(new Option(year, year));
  }
}

/**
 * Lisää pikahakuvalikkoon QUICK_SEARCHES-taulukon vaihtoehdot.
 */
function fillQuickSelect() {
  for (const item of QUICK_SEARCHES) {
    quickSelect.append(new Option(item.label, item.query));
  }
}


/* ---------- Käynnistys ja tapahtumankäsittelijät ---------- */

fillYearSelect();
fillQuickSelect();

// Kaikki tapahtumankäsittelijät lisätään dynaamisesti addEventListenerillä.
// HTML:ssä ei ole yhtään onclick-, onchange- tai onsubmit-attribuuttia.
searchForm.addEventListener('submit', handleSearchSubmit);
typeSelect.addEventListener('change', handleFilterChange);
yearSelect.addEventListener('change', handleFilterChange);
quickSelect.addEventListener('change', handleQuickSearch);
prevButton.addEventListener('click', () => changePage(-1));
nextButton.addEventListener('click', () => changePage(1));
