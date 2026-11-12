# Leffaparkki – elokuvahaku OMDb-rajapinnalla

Projekti 2a: AJAX call to a live REST API

**Tekijä:** Bhora Aaltonen

## Linkit

| | |
|---|---|
| **Julkaistu sovellus** | https://leffaparkki.netlify.app |
| **GitHub-repo** | https://github.com/Bhora111/Projekti_2_AJAX |
| **Esittelyvideo** | _lisätään myöhemmin_ |

## Sovelluksen kuvaus

Leffaparkki on selaimessa toimiva elokuvahaku. Käyttäjä voi hakea elokuvia, sarjoja ja jaksoja nimellä, rajata hakua tyypin ja vuoden mukaan sekä avata minkä tahansa tuloksen tarkemmat tiedot. Kaikki data haetaan reaaliajassa [OMDb-rajapinnasta](https://www.omdbapi.com/) (Open Movie Database) AJAX-kutsuilla. Sivu ei siis lataudu uudelleen missään vaiheessa.

### Ominaisuudet

- **Haku nimellä:** hakukenttä ja Hae-painike (tai Enter).
- **Pudotusvalikot:**
  - **Tyyppi:** kaikki, elokuvat, sarjat tai jaksot.
  - **Vuosi:** kaikki vuodet tai yksittäinen vuosi 1920 → kuluva vuosi. Vuodet luodaan JavaScriptillä.
  - **Pikahaku:** valmiita hakuja, esim. Star Wars, Harry Potter ja Taru sormusten herrasta.
- **Tuloskortit:** juliste, nimi, vuosi ja tyyppi. Jos juliste puuttuu tai sen osoite on rikki, tilalle tulee "Ei julistetta" -laatikko.
- **Sivutus:** OMDb palauttaa 10 tulosta kerrallaan, ja Edellinen- ja Seuraava-painikkeilla selataan sivuja.
- **Tietoikkuna:** kortin klikkaus avaa elokuvan tiedot: juonen, arvostelut (IMDb, Rotten Tomatoes, Metacritic), genret, ohjaajan, näyttelijät, palkinnot sekä linkin IMDb:hen.
- **Latausikoni ja virheilmoitukset:** OMDb:n virheet (esim. "ei tuloksia") ja verkkovirheet näytetään suomeksi.
- **Responsiivinen ulkoasu:** pinkki-musta teema, joka toimii puhelimessa, tabletissa ja tietokoneella.
- **Näppäimistökäyttö:** kortteihin pääsee Tab-näppäimellä ja ne avautuvat Enterillä. Tietoikkuna sulkeutuu Esc-näppäimellä.

## Käytetyt tekniikat

- **HTML5:** semanttiset elementit ja `<dialog>`-modaali-ikkuna.
- **CSS3:** CSS-muuttujat (teeman värit yhdessä paikassa), Grid, Flexbox, media queryt ja animaatiot.
- **JavaScript:** pelkkää natiivia JavaScriptiä, ei ulkoisia kirjastoja.
- **OMDb API:** REST-rajapinta, joka palauttaa JSON-dataa.
- **GitHub ja Netlify:** versionhallinta ja julkaisu. Netlify päivittää sivun automaattisesti jokaisen pushin jälkeen.

## Toteutus

### Tiedostorakenne

```
index.html       sivun rakenne
css/style.css    tyylit
js/app.js        sovelluksen toiminta (kommentoitu suomeksi)
```

### Näin AJAX-haku toimii

Koodi noudattaa tehtävänannon neljää vaihetta:

| Vaihe | Funktio | Mitä tapahtuu |
|---|---|---|
| 1. Datan pyytäminen | `fetchFromOmdb()`, `fetchMovies()`, `fetchMovieDetails()` | `fetch()` lähettää pyynnön OMDb:lle taustalla. `await` odottaa vastauksen, ja `response.json()` muuttaa sen JavaScript-olioksi. |
| 2. Tuloksen tallennus ja datan valinta | `searchState`, `pickMovieData()`, `pickDetailsData()` | Hakuehdot tallennetaan `searchState`-olioon. Vastauksesta poimitaan vain tarvittavat tiedot, ja OMDb:n `"N/A"`-arvot muutetaan tyhjiksi. |
| 3. Datan näyttäminen | `renderMovies()`, `renderDetails()` | Elementit luodaan `document.createElement`illa ja tekstit asetetaan `textContent`illa, jolloin API:n data ei voi koskaan suoritua HTML-koodina. |
| 4. Uusi haku | `handleSearchSubmit()`, `handleFilterChange()`, `handleQuickSearch()`, `changePage()` | Hakukenttä, pudotusvalikot, sivutus ja korttien klikkaus käynnistävät uuden haun. |

### Tapahtumankäsittelijät

Kaikki tapahtumankäsittelijät lisätään dynaamisesti `addEventListener`illa tiedoston `app.js` lopussa. HTML:ssä ei ole yhtään `onclick`-, `onchange`- tai `onsubmit`-attribuuttia.

Korttien klikkauksissa käytetään **tapahtuman delegointia**. Jokaiselle kortille ei lisätä omaa kuuntelijaa, vaan yksi käsittelijä on koko tulosalueella. `event.target.closest('.movie-card')` selvittää, mitä korttia klikattiin.

### Muita ratkaisuja

- **Vanhentuneiden hakujen peruminen:** kun uusi haku alkaa, kesken oleva haku perutaan `AbortController`illa. Muuten hitaasti saapuva vanha vastaus voisi korvata uudemmat tulokset.
- **Välimuisti:** kerran haetut elokuvan tiedot tallennetaan `Map`-olioon. Kun saman elokuvan avaa uudelleen, uutta API-kutsua ei tehdä. Tämä säästää ilmaisavaimen 1000 hakua päivässä.
- **API-avain:** ilmaisavain on näkyvissä koodissa, koska sovellus toimii kokonaan selaimessa. Oikeassa tuotantosovelluksessa avain piilotettaisiin palvelimen taakse.

## Itsearviointi

> _Täytä tämä osio omin sanoin ennen palautusta._

- **Mikä onnistui hyvin?**
- Projektin perustoiminnot onnistuivat hyvin ja sain sivun toimimaan suunnitellusti.
- **Mikä oli haastavaa ja miten ratkaisit sen?**
- Haastavinta oli AJAX-kutsujen ja datan käsittely.
- **Mitä opit (esim. AJAX, fetch/async/await, DOM, tapahtumankäsittely)?**
- Opin käyttämään fetchiä, async/awaitia ja DOM-elementtien käsittelyä
- **Mitä parantaisit tai lisäisit, jos jatkaisit projektia?**
- Parantaisin ulkoasua ja lisäisin uusia toimintoja
- **Oma arvio arvosanasta (0–6) arviointikriteerien perusteella ja perustelu:**
- 5

## Lähteet

- OMDb API. (s.a.). _The Open Movie Database API_. Haettu 12.11.2026 osoitteesta https://www.omdbapi.com/
- MDN Web Docs. (s.a.). _Using the Fetch API_. Haettu 12.11.2026 osoitteesta https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
- MDN Web Docs. (s.a.). _AbortController_. Haettu 12.11.2026 osoitteesta https://developer.mozilla.org/en-US/docs/Web/API/AbortController
- MDN Web Docs. (s.a.). _&lt;dialog&gt;: The Dialog element_. Haettu 12.11.2026 osoitteesta https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog
- Anthropic. (2026). _Claude_ [tekoälyavustaja]. Käytetty 12.11.2026. Koodin kirjoittamisessa käytettiin apuna Claude-tekoälyavustajaa.
