'use strict';

/* =========================================================
   Leffahaku – Projekti 2a: AJAX-kutsu live REST API:in
   Data haetaan OMDb-rajapinnasta: https://www.omdbapi.com/

   Ohjelman kulku (tehtävänannon neljä vaihetta):
     1. Pyydetään dataa OMDb:ltä AJAX-kutsulla      -> fetchMovies()
     2. Tallennetaan tulos ja valitaan käytettävä data -> pickMovieData()
     3. Näytetään data sivulla                      -> renderMovies()
     4. Käyttäjä käynnistää uuden haun lomakkeella   -> handleSearch()
   ========================================================= */


/* ---------- Asetukset ---------- */

// OMDb:n osoite ja oma API-avain (ilmaisavain, 1000 hakua vuorokaudessa)
const API_URL = 'https://www.omdbapi.com/';
const API_KEY = '5066635e';

// OMDb palauttaa tyypit englanniksi, joten käännetään ne suomeksi korteille
const TYPE_NAMES = {
  movie: 'elokuva',
  series: 'sarja',
  episode: 'jakso',
  game: 'peli'
};


/* ---------- HTML-elementit ---------- */

// Haetaan tarvittavat elementit muuttujiin kerran,
// ettei niitä tarvitse etsiä sivulta joka haun yhteydessä uudelleen
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const statusText = document.getElementById('status');
const resultsGrid = document.getElementById('results');


/* ---------- 1. Datan pyytäminen (AJAX-kutsu) ---------- */

/**
 * Hakee OMDb:stä elokuvia hakusanalla.
 * fetch() lähettää HTTP-pyynnön taustalla ilman, että sivu latautuu uudelleen (= AJAX).
 * @param {string} query Hakusana, esim. "batman"
 * @returns {Promise<object>} OMDb:n vastaus JavaScript-oliona
 */
async function fetchMovies(query) {
  // URLSearchParams rakentaa osoitteen kyselyosan (?apikey=...&s=...)
  // ja koodaa välilyönnit ja erikoismerkit oikein
  const params = new URLSearchParams({
    apikey: API_KEY,
    s: query
  });

  // await odottaa palvelimen vastausta ennen kuin koodi jatkuu.
  // Sillä välin selain ja sivu toimivat normaalisti.
  const response = await fetch(`${API_URL}?${params}`);

  // Muutetaan vastauksen JSON-teksti JavaScript-olioksi
  const data = await response.json();

  // OMDb kertoo virheistä kentässä Response: "False" (esim. "Movie not found!").
  // Heitetään silloin virhe, jonka handleSearch() ottaa kiinni.
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
 * @param {boolean} isError Näytetäänkö viesti virheen värillä
 */
function showStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.classList.toggle('error', isError);
}

/**
 * Kääntää OMDb:n englanninkieliset virheviestit suomeksi.
 * @param {string} message Alkuperäinen virheviesti
 * @returns {string} Käyttäjälle näytettävä viesti
 */
function translateError(message) {
  const translations = {
    'Movie not found!': 'Hakusanalla ei löytynyt yhtään elokuvaa. Kokeile toista hakusanaa.',
    'Too many results.': 'Liikaa tuloksia. Kirjoita tarkempi hakusana.',
    'Invalid API key!': 'API-avain ei kelpaa. Tarkista avain tiedostosta js/app.js.',
    'Request limit reached!': 'Päivän hakuraja (1000 hakua) on täynnä. Yritä huomenna uudelleen.'
  };

  // Jos viestille ei ole käännöstä, kyse on yleensä verkkovirheestä
  return translations[message] || 'Haku epäonnistui. Tarkista verkkoyhteys ja yritä uudelleen.';
}


/* ---------- 4. Käyttäjä käynnistää haun ---------- */

/**
 * Lomakkeen lähetyksen käsittelijä: lukee hakusanan, hakee ja näyttää tulokset.
 * @param {SubmitEvent} event Lomakkeen submit-tapahtuma
 */
async function handleSearch(event) {
  // Estetään lomakkeen oletustoiminto, joka lataisi koko sivun uudelleen
  event.preventDefault();

  const query = searchInput.value.trim();
  if (query.length < 2) {
    showStatus('Kirjoita vähintään 2 merkkiä.', true);
    return;
  }

  showStatus(`Haetaan "${query}"…`);
  resultsGrid.replaceChildren();

  // try...catch: jos haku epäonnistuu missä tahansa kohdassa,
  // hypätään catch-lohkoon ja näytetään virheilmoitus
  try {
    const data = await fetchMovies(query);   // 1. pyydetään data
    const movies = pickMovieData(data);      // 2. valitaan tarvittavat tiedot
    renderMovies(movies);                    // 3. näytetään sivulla

    const total = Number(data.totalResults).toLocaleString('fi-FI');
    showStatus(`Löytyi ${total} tulosta haulla "${query}". Näytetään ${movies.length} ensimmäistä.`);
  } catch (error) {
    // Virhe voi tulla OMDb:ltä (esim. ei tuloksia) tai verkosta (ei yhteyttä)
    showStatus(translateError(error.message), true);
  }
}


/* ---------- Tapahtumankäsittelijät ---------- */

// Kaikki tapahtumankäsittelijät lisätään dynaamisesti addEventListenerillä.
// HTML:ssä ei ole yhtään onclick- tai onsubmit-attribuuttia.
searchForm.addEventListener('submit', handleSearch);
