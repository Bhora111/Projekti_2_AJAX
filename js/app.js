'use strict';

/* =========================================================
   Leffahaku – Projekti 2a: AJAX-kutsu live REST API:in
   Data haetaan OMDb-rajapinnasta: https://www.omdbapi.com/

   Ohjelman kulku (tehtävänannon neljä vaihetta):
     1. Pyydetään dataa OMDb:ltä AJAX-kutsulla        -> fetchMovies(), fetchMovieDetails()
     2. Tallennetaan tulos ja valitaan käytettävä data -> searchState, pickMovieData(), pickDetailsData()
     3. Näytetään data sivulla                        -> renderMovies(), renderDetails()
     4. Käyttäjä käynnistää uuden haun                -> hakukenttä, pudotusvalikot, sivutus
                                                         ja elokuvakortin klikkaus
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

// Arvostelulähteiden lyhyemmät nimet tietoikkunaan
const RATING_SOURCES = {
  'Internet Movie Database': 'IMDb',
  'Rotten Tomatoes': 'Rotten Tomatoes',
  'Metacritic': 'Metacritic'
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
const detailsDialog = document.getElementById('details-dialog');
const detailsContent = document.getElementById('details-content');
const closeDialogButton = document.getElementById('close-dialog');


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

// Kesken olevat pyynnöt. AbortControllerilla vanha pyyntö perutaan, kun uusi alkaa.
let activeSearchRequest = null;
let activeDetailsRequest = null;

// Välimuisti jo haetuille elokuvien tiedoille (avain = IMDb-tunniste).
// Kun samaa elokuvaa klikataan uudelleen, uutta AJAX-kutsua ei tarvita.
const detailsCache = new Map();


/* ---------- 1. Datan pyytäminen (AJAX-kutsut) ---------- */

/**
 * Lähettää AJAX-pyynnön OMDb:hen. Tätä samaa funktiota käyttävät
 * sekä elokuvahaku että yksittäisen elokuvan tietojen haku.
 * @param {URLSearchParams} params Kyselyn parametrit (ilman API-avainta)
 * @param {AbortSignal} signal Signaali, jolla pyyntö voidaan perua kesken
 * @returns {Promise<object>} OMDb:n vastaus JavaScript-oliona
 */
async function fetchFromOmdb(params, signal) {
  params.set('apikey', API_KEY);

  // fetch() lähettää HTTP-pyynnön taustalla ilman, että sivu latautuu uudelleen (= AJAX).
  // await odottaa vastausta, ja sillä välin sivu toimii normaalisti.
  const response = await fetch(`${API_URL}?${params}`, { signal });

  // Muutetaan vastauksen JSON-teksti JavaScript-olioksi
  const data = await response.json();

  // OMDb kertoo virheistä kentässä Response: "False" (esim. "Movie not found!").
  // Heitetään silloin virhe, jonka kutsuva funktio ottaa kiinni try...catchilla.
  if (data.Response === 'False') {
    throw new Error(data.Error);
  }

  return data;
}

/**
 * Hakee elokuvia hakusanalla ja valituilla suodattimilla.
 * @param {object} search Hakuehdot: query, type, year ja page
 * @param {AbortSignal} signal
 * @returns {Promise<object>} Hakutulokset (10 kpl / sivu)
 */
function fetchMovies(search, signal) {
  // URLSearchParams rakentaa osoitteen kyselyosan (?s=...&page=...)
  // ja koodaa välilyönnit ja erikoismerkit oikein
  const params = new URLSearchParams({
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

  return fetchFromOmdb(params, signal);
}

/**
 * Hakee yhden elokuvan kaikki tiedot IMDb-tunnisteella.
 * @param {string} id IMDb-tunniste, esim. "tt0076759"
 * @param {AbortSignal} signal
 * @returns {Promise<object>} Elokuvan tiedot
 */
function fetchMovieDetails(id, signal) {
  // i = IMDb-tunniste, plot=full = pitkä juonikuvaus lyhyen sijaan
  const params = new URLSearchParams({
    i: id,
    plot: 'full'
  });
  return fetchFromOmdb(params, signal);
}


/* ---------- 2. Tuloksen tallennus ja datan valinta ---------- */

/**
 * OMDb merkitsee puuttuvan tiedon tekstillä "N/A".
 * Muutetaan se null-arvoksi, jotta puuttuvat tiedot on helppo jättää pois.
 * @param {string|undefined} value
 * @returns {string|null}
 */
function cleanValue(value) {
  return value && value !== 'N/A' ? value : null;
}

/**
 * Poimii hakuvastauksesta vain ne tiedot, joita korteissa näytetään.
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
    poster: cleanValue(item.Poster)
  }));
}

/**
 * Poimii yhden elokuvan vastauksesta tietoikkunassa näytettävät tiedot.
 * @param {object} data OMDb:n vastaus i-haulle
 * @returns {object} Elokuvan tiedot
 */
function pickDetailsData(data) {
  return {
    id: data.imdbID,
    title: data.Title,
    year: data.Year,
    type: TYPE_NAMES[data.Type] || data.Type,
    poster: cleanValue(data.Poster),
    runtime: cleanValue(data.Runtime),
    rated: cleanValue(data.Rated),
    // Genret tulevat yhtenä tekstinä ("Action, Adventure"), joten pilkotaan ne taulukoksi
    genres: cleanValue(data.Genre) ? data.Genre.split(', ') : [],
    plot: cleanValue(data.Plot),
    director: cleanValue(data.Director),
    writer: cleanValue(data.Writer),
    actors: cleanValue(data.Actors),
    totalSeasons: cleanValue(data.totalSeasons), // vain sarjoilla
    released: cleanValue(data.Released),
    language: cleanValue(data.Language),
    country: cleanValue(data.Country),
    awards: cleanValue(data.Awards),
    // Arvostelut: esim. { source: 'IMDb', value: '8.6/10' }
    ratings: (data.Ratings || []).map((rating) => ({
      source: RATING_SOURCES[rating.Source] || rating.Source,
      value: rating.Value
    }))
  };
}

/**
 * Tekee haun searchState-olion tiedoilla ja näyttää tulokset.
 * Tätä kutsutaan sekä uudessa haussa että sivua vaihdettaessa.
 */
async function runSearch() {
  // Jos edellinen haku on vielä kesken, perutaan se.
  // Näin hitaasti saapuva vanha vastaus ei voi korvata uudempia tuloksia.
  if (activeSearchRequest) {
    activeSearchRequest.abort();
  }
  activeSearchRequest = new AbortController();

  showStatus(`Haetaan "${searchState.query}"…`, 'loading');
  resultsGrid.replaceChildren();
  setPaginationDisabled(true);

  // try...catch: jos haku epäonnistuu missä tahansa kohdassa,
  // hypätään catch-lohkoon ja näytetään virheilmoitus
  try {
    const data = await fetchMovies(searchState, activeSearchRequest.signal); // 1. pyydetään data
    const movies = pickMovieData(data);                                      // 2. valitaan tiedot

    // Lasketaan sivujen määrä tulosten kokonaismäärästä (10 tulosta / sivu)
    const totalResults = Number(data.totalResults);
    searchState.totalPages = Math.min(Math.ceil(totalResults / RESULTS_PER_PAGE), MAX_PAGES);

    renderMovies(movies);                                                    // 3. näytetään sivulla
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


/* ---------- 3. Datan näyttäminen: hakutulokset ---------- */

/**
 * Apufunktio: luo HTML-elementin ja antaa sille CSS-luokan ja tekstin.
 * Teksti asetetaan textContentilla, jolloin API:n data näkyy aina
 * pelkkänä tekstinä eikä sitä voi tulkita HTML-koodiksi.
 * @param {string} tag Elementin tyyppi, esim. 'p' tai 'div'
 * @param {string} [className] CSS-luokka
 * @param {string} [text] Elementin teksti
 * @returns {HTMLElement}
 */
function makeElement(tag, className = '', text = '') {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text) {
    element.textContent = text;
  }
  return element;
}

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
 * Luo yhden elokuvakortin.
 * @param {object} movie Elokuvan tiedot
 * @returns {HTMLElement} Valmis kortti
 */
function createMovieCard(movie) {
  const card = makeElement('article', 'movie-card');

  // Tallennetaan IMDb-tunniste korttiin (data-id-attribuutti),
  // jotta klikkauksen käsittelijä tietää, minkä elokuvan tiedot avataan
  card.dataset.id = movie.id;

  // tabIndex ja role tekevät kortista painikkeen, jota voi käyttää myös näppäimistöllä
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${movie.title} (${movie.year}), näytä tiedot`);

  const info = makeElement('div', 'movie-info');
  const title = makeElement('h2', 'movie-title', movie.title);
  const meta = makeElement('p', 'movie-meta');
  meta.append(
    makeElement('span', '', movie.year),
    makeElement('span', 'type-badge', movie.type)
  );

  // Kootaan osat sisäkkäin: kortti > (juliste + info > (otsikko + meta))
  info.append(title, meta);
  card.append(createPoster(movie), info);

  return card;
}

/**
 * Luo julistekuvan. Jos julistetta ei ole, palautetaan tilalle tekstilaatikko.
 * Käytetään sekä korteissa että tietoikkunassa.
 * @param {object} movie Elokuvan tiedot (title ja poster)
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
  return makeElement('div', 'poster-placeholder', 'Ei julistetta');
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
    'Incorrect IMDb ID.': 'Elokuvan tietoja ei löytynyt.',
    'Too many results.': 'Liikaa tuloksia. Kirjoita tarkempi hakusana.',
    'Invalid API key!': 'API-avain ei kelpaa. Tarkista avain tiedostosta js/app.js.',
    'Request limit reached!': 'Päivän hakuraja (1000 hakua) on täynnä. Yritä huomenna uudelleen.'
  };

  // Jos viestille ei ole käännöstä, kyse on yleensä verkkovirheestä
  return translations[message] || 'Haku epäonnistui. Tarkista verkkoyhteys ja yritä uudelleen.';
}


/* ---------- 3. Datan näyttäminen: elokuvan tiedot ---------- */

/**
 * Avaa tietoikkunan ja hakee klikatun elokuvan tarkemmat tiedot.
 * @param {string} id IMDb-tunniste
 */
async function openDetails(id) {
  // Perutaan mahdollinen edellinen, vielä kesken oleva tietojen haku
  if (activeDetailsRequest) {
    activeDetailsRequest.abort();
  }
  activeDetailsRequest = new AbortController();

  // Avataan ikkuna heti ja näytetään latausilmoitus, kunnes tiedot saapuvat
  showDetailsMessage('Ladataan tietoja…', 'loading');
  if (!detailsDialog.open) {
    detailsDialog.showModal();
  }

  try {
    // Katsotaan ensin välimuistista. Jos tietoja ei vielä ole, tehdään AJAX-kutsu.
    let details = detailsCache.get(id);
    if (!details) {
      const data = await fetchMovieDetails(id, activeDetailsRequest.signal); // 1. pyydetään data
      details = pickDetailsData(data);                                       // 2. valitaan tiedot
      detailsCache.set(id, details);
    }
    renderDetails(details);                                                  // 3. näytetään
  } catch (error) {
    if (error.name === 'AbortError') {
      return;
    }
    showDetailsMessage(translateError(error.message), 'error');
  }
}

/**
 * Rakentaa tietoikkunan sisällön: juliste vasemmalle, tiedot oikealle.
 * @param {object} movie pickDetailsData():n palauttamat tiedot
 */
function renderDetails(movie) {
  const posterBox = makeElement('div', 'details-poster');
  posterBox.append(createPoster(movie));

  const info = makeElement('div', 'details-info');

  const title = makeElement('h2', 'details-title', movie.title);
  title.id = 'details-title'; // dialogin aria-labelledby viittaa tähän otsikkoon

  // Esim. "1977 · elokuva · 121 min · PG". filter(Boolean) jättää puuttuvat (null) tiedot pois.
  const metaText = [movie.year, movie.type, movie.runtime, movie.rated].filter(Boolean).join(' · ');
  info.append(title, makeElement('p', 'details-meta', metaText));

  if (movie.genres.length > 0) {
    const genreList = makeElement('div', 'genre-list');
    for (const genre of movie.genres) {
      genreList.append(makeElement('span', 'genre-badge', genre));
    }
    info.append(genreList);
  }

  if (movie.ratings.length > 0) {
    info.append(createRatingList(movie.ratings));
  }

  if (movie.plot) {
    info.append(makeElement('p', 'details-plot', movie.plot));
  }

  info.append(createFactList(movie));

  // Linkki elokuvan IMDb-sivulle uuteen välilehteen
  const imdbLink = makeElement('a', 'imdb-link', 'Avaa IMDb:ssä ›');
  imdbLink.href = `https://www.imdb.com/title/${movie.id}/`;
  imdbLink.target = '_blank';
  imdbLink.rel = 'noopener';
  info.append(imdbLink);

  detailsContent.replaceChildren(posterBox, info);
}

/**
 * Luo arvostelulistan, esim. "8.6/10 IMDb", "93% Rotten Tomatoes".
 * @param {Array<object>} ratings
 * @returns {HTMLElement}
 */
function createRatingList(ratings) {
  const list = makeElement('ul', 'rating-list');
  for (const rating of ratings) {
    const item = makeElement('li', 'rating');
    item.append(
      makeElement('span', 'rating-value', rating.value),
      makeElement('span', 'rating-source', rating.source)
    );
    list.append(item);
  }
  return list;
}

/**
 * Luo tietolistan (ohjaaja, näyttelijät jne.). Puuttuvat tiedot jätetään pois.
 * @param {object} movie
 * @returns {HTMLElement} <dl>-lista
 */
function createFactList(movie) {
  // [otsikko, arvo] -parit
  const facts = [
    ['Ohjaaja', movie.director],
    ['Käsikirjoitus', movie.writer],
    ['Näyttelijät', movie.actors],
    ['Tuotantokausia', movie.totalSeasons],
    ['Ensi-ilta', movie.released],
    ['Kieli', movie.language],
    ['Maa', movie.country],
    ['Palkinnot', movie.awards]
  ];

  const list = makeElement('dl', 'details-facts');
  // Taulukon purku [label, value] antaa parin molemmat osat omiin muuttujiinsa
  for (const [label, value] of facts) {
    if (value) {
      list.append(makeElement('dt', '', label), makeElement('dd', '', value));
    }
  }
  return list;
}

/**
 * Näyttää tietoikkunassa pelkän viestin (lataus tai virhe).
 * @param {string} message
 * @param {'loading'|'error'} type
 */
function showDetailsMessage(message, type) {
  detailsContent.replaceChildren(makeElement('p', `status ${type}`, message));
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

/**
 * Elokuvakortin klikkaus avaa elokuvan tiedot.
 * Tapahtuman delegointi: kortteja ei tarvitse kuunnella yksitellen, vaan
 * yksi käsittelijä koko tulosalueella riittää, koska klikkaus "kuplii" ylöspäin.
 * @param {MouseEvent} event
 */
function handleResultsClick(event) {
  // closest() etsii klikatusta kohdasta (esim. kuvasta) lähimmän kortin
  const card = event.target.closest('.movie-card');
  if (card) {
    openDetails(card.dataset.id);
  }
}

/**
 * Näppäimistön tuki korteille: Enter tai välilyönti avaa tiedot.
 * @param {KeyboardEvent} event
 */
function handleResultsKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }
  const card = event.target.closest('.movie-card');
  if (card) {
    event.preventDefault(); // estää välilyöntiä vierittämästä sivua
    openDetails(card.dataset.id);
  }
}

/**
 * Tietoikkunan sulkeminen taustaa klikkaamalla.
 * @param {MouseEvent} event
 */
function handleDialogClick(event) {
  // Kun klikataan tummaa taustaa, event.target on itse dialog-elementti.
  // Sisällön klikkaukset osuvat sen sisällä oleviin elementteihin, joten ne eivät sulje ikkunaa.
  if (event.target === detailsDialog) {
    detailsDialog.close();
  }
}

/**
 * Kun tietoikkuna sulkeutuu (×, Esc tai taustan klikkaus),
 * perutaan mahdollisesti vielä kesken oleva tietojen haku.
 */
function handleDialogClose() {
  if (activeDetailsRequest) {
    activeDetailsRequest.abort();
    activeDetailsRequest = null;
  }
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
resultsGrid.addEventListener('click', handleResultsClick);
resultsGrid.addEventListener('keydown', handleResultsKeydown);
closeDialogButton.addEventListener('click', () => detailsDialog.close());
detailsDialog.addEventListener('click', handleDialogClick);
detailsDialog.addEventListener('close', handleDialogClose);
