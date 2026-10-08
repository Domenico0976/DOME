// Weather API Integration con Meteoblue
class WeatherCard {
    constructor(cardElement) {
        this.card = cardElement;
        this.apiKey = 'YOUR_METEOBLUE_API_KEY'; // Sostituisci con la tua chiave API
        this.defaultCity = 'Milano';
        this.defaultLat = 45.4642;
        this.defaultLon = 9.1900;
        this.currentTimezone = 'Europe/Rome'; // Timezone di default
        this.clockInterval = null; // Per gestire l'intervallo dell'orologio
        this.searchTimeout = null; // Per debounce delle suggestions
        this.suggestionsContainer = null; // Container per le suggestions
        this.currentSuggestions = [];
        this.activeIndex = -1;
        this.maxSuggestions = 50; // Aumentato per mostrare più risultati
        this.debugSearch = true;
        this.requestCache = new Map();
        this.lastRequestTime = 0;
        this.defaultSuggestionResults = this.getStaticDefaultSuggestions();
        this.tempScale = 'C'; // 'C' or 'F'
        this.currentTempCelsius = null; // Store raw Celsius value
        this.tooltipElement = null;
        this.activeTooltipTarget = null;
        this.nextSunriseTs = null;
        this.nextSunsetTs = null;
        this.retryButton = null;
        this.hasLoadedWeatherData = false;
        this.retryVisibilityTimer = null;
        this.pageEnterTimestamp = Date.now();
        
        // Mappa paesi → codici ISO per Photon API
        this.COUNTRY_MAP = {
            'italy': 'IT', 'italia': 'IT',
            'france': 'FR', 'francia': 'FR',
            'spain': 'ES', 'spagna': 'ES',
            'germany': 'DE', 'germania': 'DE',
            'united states': 'US', 'usa': 'US', 'stati uniti': 'US', 'america': 'US',
            'united kingdom': 'GB', 'uk': 'GB', 'regno unito': 'GB', 'gran bretagna': 'GB',
            'canada': 'CA',
            'australia': 'AU',
            'brazil': 'BR', 'brasile': 'BR',
            'mexico': 'MX', 'messico': 'MX',
            'japan': 'JP', 'giappone': 'JP',
            'china': 'CN', 'cina': 'CN',
            'india': 'IN',
            'russia': 'RU',
            'south korea': 'KR', 'corea del sud': 'KR',
            'netherlands': 'NL', 'olanda': 'NL',
            'belgium': 'BE', 'belgio': 'BE',
            'switzerland': 'CH', 'svizzera': 'CH',
            'austria': 'AT',
            'poland': 'PL', 'polonia': 'PL',
            'sweden': 'SE', 'svezia': 'SE',
            'norway': 'NO', 'norvegia': 'NO',
            'denmark': 'DK', 'danimarca': 'DK',
            'finland': 'FI', 'finlandia': 'FI',
            'portugal': 'PT',
            'greece': 'GR', 'grecia': 'GR',
            'turkey': 'TR', 'turchia': 'TR',
            'argentina': 'AR',
            'chile': 'CL', 'cileno': 'CL',
            'colombia': 'CO',
            'peru': 'PE', 'perù': 'PE',
            'venezuela': 'VE',
            'south africa': 'ZA', 'sudafrica': 'ZA',
            'egypt': 'EG', 'egitto': 'EG',
            'nigeria': 'NG',
            'kenya': 'KE',
            'morocco': 'MA', 'marocco': 'MA',
            'thailand': 'TH', 'tailandia': 'TH',
            'vietnam': 'VN', 'vietnam': 'VN',
            'indonesia': 'ID',
            'philippines': 'PH', 'filippine': 'PH',
            'malaysia': 'MY',
            'singapore': 'SG',
            'new zealand': 'NZ', 'nuova zelanda': 'NZ',
            'ireland': 'IE', 'irlanda': 'IE',
            'czech republic': 'CZ', 'repubblica ceca': 'CZ',
            'hungary': 'HU', 'ungheria': 'HU',
            'romania': 'RO',
            'bulgaria': 'BG',
            'croatia': 'HR', 'croazia': 'HR',
            'serbia': 'RS',
            'slovakia': 'SK', 'slovacchia': 'SK',
            'slovenia': 'SI',
            'lithuania': 'LT', 'lituania': 'LT',
            'latvia': 'LV', 'lettonia': 'LV',
            'estonia': 'EE', 'estonia': 'EE',
            'ukraine': 'UA', 'ucraina': 'UA',
            'belarus': 'BY', 'bielorussia': 'BY',
            'kazakhstan': 'KZ',
            'uzbekistan': 'UZ',
            'israel': 'IL', 'israele': 'IL',
            'saudi arabia': 'SA', 'arabia saudita': 'SA',
            'united arab emirates': 'AE', 'emirati arabi uniti': 'AE', 'emirati': 'AE',
            'qatar': 'QA',
            'kuwait': 'KW',
            'bahrain': 'BH',
            'oman': 'OM',
            'jordan': 'JO', 'giordania': 'JO',
            'lebanon': 'LB', 'libano': 'LB',
            'iraq': 'IQ',
            'iran': 'IR',
            'pakistan': 'PK',
            'bangladesh': 'BD',
            'sri lanka': 'LK',
            'nepal': 'NP',
            'myanmar': 'MM', 'birmania': 'MM',
            'cambodia': 'KH', 'cambogia': 'KH',
            'laos': 'LA',
            'mongolia': 'MN',
            'taiwan': 'TW',
            'hong kong': 'HK',
            'macau': 'MO',
            'iceland': 'IS', 'islanda': 'IS',
            'luxembourg': 'LU', 'lussemburgo': 'LU',
            'malta': 'MT',
            'cyprus': 'CY', 'cipro': 'CY',
            'georgia': 'GE',
            'armenia': 'AM',
            'azerbaijan': 'AZ',
            'moldova': 'MD',
            'albania': 'AL',
            'north macedonia': 'MK', 'macedonia del nord': 'MK',
            'montenegro': 'ME',
            'bosnia and herzegovina': 'BA', 'bosnia ed erzegovina': 'BA',
            'kosovo': 'XK',
            'liechtenstein': 'LI',
            'monaco': 'MC',
            'san marino': 'SM',
            'vatican city': 'VA', 'città del vaticano': 'VA', 'vaticano': 'VA',
            'andorra': 'AD'
        };
        
        // Mappa codici ISO → nomi canonici in inglese per visualizzazione consistente
        this.COUNTRY_CANONICAL_NAMES = {};
        for (const [name, code] of Object.entries(this.COUNTRY_MAP)) {
            // Se non abbiamo ancora un nome canonico per questo codice, usiamo il primo incontrato
            // (assumiamo che il primo sia quello inglese, basandoci sull'ordine della mappa)
            if (!this.COUNTRY_CANONICAL_NAMES[code]) {
                this.COUNTRY_CANONICAL_NAMES[code] = name;
            }
        }

        // Mappa paesi → principali città (top 6 per paese)
        this.COUNTRY_MAJOR_CITIES = {
            'IT': ['Roma', 'Milano', 'Napoli', 'Torino', 'Palermo', 'Genova'],
            'FR': ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes'],
            'DE': ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart'],
            'ES': ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Malaga'],
            'GB': ['London', 'Birmingham', 'Manchester', 'Leeds', 'Glasgow', 'Sheffield'],
            'US': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia'],
            'JP': ['Tokyo', 'Yokohama', 'Osaka', 'Nagoya', 'Sapporo', 'Fukuoka'],
            'CN': ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Hangzhou'],
            'IN': ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad', 'Chennai'],
            'BR': ['Sao Paulo', 'Rio de Janeiro', 'Brasilia', 'Salvador', 'Fortaleza', 'Belo Horizonte'],
            'RU': ['Moscow', 'Saint Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Kazan', 'Nizhny Novgorod'],
            'CA': ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa'],
            'AU': ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast'],
            'MX': ['Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'Leon'],
            'KR': ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju'],
            'NL': ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Groningen'],
            'BE': ['Brussels', 'Antwerp', 'Ghent', 'Charleroi', 'Liege', 'Bruges'],
            'CH': ['Zurich', 'Geneva', 'Basel', 'Lausanne', 'Bern', 'Winterthur'],
            'AT': ['Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt'],
            'PL': ['Warsaw', 'Krakow', 'Lodz', 'Wroclaw', 'Poznan', 'Gdansk'],
            'SE': ['Stockholm', 'Gothenburg', 'Malmo', 'Uppsala', 'Vasteras', 'Orebro'],
            'NO': ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Baerum', 'Kristiansand'],
            'DK': ['Copenhagen', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg', 'Randers'],
            'FI': ['Helsinki', 'Espoo', 'Tampere', 'Vantaa', 'Oulu', 'Turku'],
            'PT': ['Lisbon', 'Porto', 'Vila Nova de Gaia', 'Amadora', 'Braga', 'Setubal'],
            'GR': ['Athens', 'Thessaloniki', 'Patras', 'Heraklion', 'Larissa', 'Volos'],
            'TR': ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Adana', 'Gaziantep'],
            'AR': ['Buenos Aires', 'Cordoba', 'Rosario', 'Mendoza', 'La Plata', 'Tucuman'],
            'ZA': ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Port Elizabeth', 'Bloemfontein'],
            'EG': ['Cairo', 'Alexandria', 'Giza', 'Shubra El Kheima', 'Port Said', 'Suez'],
            'TH': ['Bangkok', 'Nonthaburi', 'Nakhon Ratchasima', 'Chiang Mai', 'Hat Yai', 'Udon Thani']
        };
        
        this.init();
    }
    
    async init() {
        this.card.__weatherCard = this;
        this.rainContainer = this.card.querySelector('.rain-container');
        this.setupSearchBar();
        this.setupSuggestions();
        this.setupGrabScroll();
        this.setupTempToggle();
        this.setupCustomTooltips();
        this.setupRetryButton();
        this.startRetryVisibilityTimer();
        // Carica la città di default con la regione usando il geocoding
        await this.loadDefaultCity();
        // Avvia l'aggiornamento dell'orologio
        this.startClock();
    }

    setupRetryButton() {
        this.retryButton = this.card.querySelector('.weather-retry-btn');
        if (!this.retryButton) return;

        this.retryButton.addEventListener('click', () => {
            this.handleRetryClick();
        });
    }

    startRetryVisibilityTimer() {
        if (this.retryVisibilityTimer) {
            clearTimeout(this.retryVisibilityTimer);
        }

        this.retryVisibilityTimer = setTimeout(() => {
            this.updateRetryButtonVisibility();
        }, 4000);
    }

    updateRetryButtonVisibility() {
        if (!this.retryButton) return;
        const elapsed = Date.now() - this.pageEnterTimestamp;
        const shouldShow = !this.hasLoadedWeatherData && elapsed >= 4000;
        this.retryButton.classList.toggle('visible', shouldShow);
    }

    hideRetryButton() {
        if (!this.retryButton) return;
        this.retryButton.classList.remove('visible');
    }

    async handleRetryClick() {
        this.hideRetryButton();

        const searchBar = this.card.querySelector('.weather-search');
        const hasSearchValue = Boolean(searchBar && searchBar.value.trim());

        if (hasSearchValue) {
            await this.handleSearch();
            return;
        }

        await this.loadDefaultCity();
    }

    setupCustomTooltips() {
        const tooltipTargets = this.card.querySelectorAll('.weather-info-group [data-tooltip]');
        if (!tooltipTargets.length) return;

        this.tooltipElement = document.createElement('div');
        this.tooltipElement.className = 'custom-weather-tooltip';
        document.body.appendChild(this.tooltipElement);

        const showTooltip = (target) => {
            const tooltipText = target.getAttribute('data-tooltip');
            if (!tooltipText || !this.tooltipElement) return;

            this.activeTooltipTarget = target;
            this.tooltipElement.textContent = tooltipText;
            this.positionTooltip(target);
            this.tooltipElement.classList.add('is-visible');
        };

        const hideTooltip = () => {
            if (!this.tooltipElement) return;
            this.tooltipElement.classList.remove('is-visible');
            this.activeTooltipTarget = null;
        };

        tooltipTargets.forEach((target) => {
            target.addEventListener('mouseenter', () => showTooltip(target));
            target.addEventListener('mouseleave', hideTooltip);
            target.addEventListener('mousemove', () => {
                if (this.activeTooltipTarget === target) {
                    this.positionTooltip(target);
                }
            });
        });

        window.addEventListener('scroll', () => {
            if (this.activeTooltipTarget) {
                this.positionTooltip(this.activeTooltipTarget);
            }
        }, { passive: true });

        window.addEventListener('resize', () => {
            if (this.activeTooltipTarget) {
                this.positionTooltip(this.activeTooltipTarget);
            }
        });
    }

    positionTooltip(target) {
        if (!this.tooltipElement || !target) return;

        const chipRect = target.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 8;
        const gapFromChip = 8;

        let left = chipRect.left + (chipRect.width / 2);
        this.tooltipElement.style.left = `${left}px`;
        this.tooltipElement.style.top = `${chipRect.top}px`;

        const tooltipRect = this.tooltipElement.getBoundingClientRect();
        const halfTooltip = tooltipRect.width / 2;
        let top = chipRect.top - tooltipRect.height - gapFromChip;

        if (left - halfTooltip < margin) {
            left = margin + halfTooltip;
        } else if (left + halfTooltip > viewportWidth - margin) {
            left = viewportWidth - margin - halfTooltip;
        }

        if (top < margin) {
            top = margin;
        } else if (top + tooltipRect.height > viewportHeight - margin) {
            top = viewportHeight - tooltipRect.height - margin;
        }

        this.tooltipElement.style.left = `${left}px`;
        this.tooltipElement.style.top = `${top}px`;
    }

    setupTempToggle() {
        const buttons = this.card.querySelectorAll('.temp-toggle-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const scale = btn.dataset.scale;
                if (scale === this.tempScale) return;
                this.tempScale = scale;
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateTempDisplay();
            });
        });
    }

    updateTempDisplay() {
        const tempSpan = this.card.querySelector('.temp');
        if (!tempSpan || this.currentTempCelsius == null) return;
        if (this.tempScale === 'F') {
            const f = Math.round(this.currentTempCelsius * 9 / 5 + 32);
            tempSpan.textContent = `${f}°F`;
        } else {
            tempSpan.textContent = `${Math.round(this.currentTempCelsius)}°C`;
        }
    }

    setupGrabScroll() {
        const infoGroup = this.card.querySelector('.weather-info-group');
        if (!infoGroup) return;

        let isDown = false;
        let startX;
        let scrollLeft;

        // Desktop mouse drag only — mobile uses native touch scroll
        infoGroup.addEventListener('mousedown', (e) => {
            isDown = true;
            infoGroup.style.cursor = 'grabbing';
            startX = e.pageX - infoGroup.offsetLeft;
            scrollLeft = infoGroup.scrollLeft;
            e.preventDefault();
        });

        infoGroup.addEventListener('mouseleave', () => {
            isDown = false;
            infoGroup.style.cursor = 'grab';
        });

        infoGroup.addEventListener('mouseup', () => {
            isDown = false;
            infoGroup.style.cursor = 'grab';
        });

        infoGroup.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - infoGroup.offsetLeft;
            const walk = (x - startX) * 1.5;
            infoGroup.scrollLeft = scrollLeft - walk;
        });
    }

    getStaticDefaultSuggestions() {
        return [
            {
                city: 'New York',
                region: 'New York',
                country: 'United States',
                lat: '40.7128',
                lon: '-74.0060',
                address: { city: 'New York', state: 'New York', country: 'United States' },
                display_name: 'New York, New York, United States'
            },
            {
                city: 'Los Angeles',
                region: 'California',
                country: 'United States',
                lat: '34.0522',
                lon: '-118.2437',
                address: { city: 'Los Angeles', state: 'California', country: 'United States' },
                display_name: 'Los Angeles, California, United States'
            },
            {
                city: 'Roma',
                region: 'Lazio',
                country: 'Italia',
                lat: '41.9028',
                lon: '12.4964',
                address: { city: 'Roma', state: 'Lazio', country: 'Italia' },
                display_name: 'Roma, Lazio, Italia'
            },
            {
                city: 'Tokyo',
                region: 'Tokyo',
                country: 'Giappone',
                lat: '35.6762',
                lon: '139.6503',
                address: { city: 'Tokyo', state: 'Tokyo', country: 'Giappone' },
                display_name: 'Tokyo, Tokyo, Giappone'
            },
            {
                city: 'Singapore',
                region: 'Singapore',
                country: 'Singapore',
                lat: '1.3521',
                lon: '103.8198',
                address: { city: 'Singapore', state: 'Singapore', country: 'Singapore' },
                display_name: 'Singapore, Singapore'
            },
            {
                city: 'Cairo',
                region: 'Cairo Governorate',
                country: 'Egitto',
                lat: '30.0444',
                lon: '31.2357',
                address: { city: 'Cairo', state: 'Cairo Governorate', country: 'Egitto' },
                display_name: 'Cairo, Cairo Governorate, Egitto'
            }
        ];
    }

    normalizeText(value) {
        return (value || '')
            .toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
    }

    // Rileva se la query corrisponde a un paese (prefix match)
    // Es: "ita" → Italy, "fra" → France, "deu" → Germany
    detectCountryFromQuery(query) {
        const normalized = this.normalizeText(query);
        if (!normalized || normalized.length < 2) return null;
        
        for (const [name, code] of Object.entries(this.COUNTRY_MAP)) {
            if (name.startsWith(normalized)) {
                // Restituisci il nome canonico in inglese per consistenza
                const canonicalName = this.COUNTRY_CANONICAL_NAMES[code];
                return { 
                    name: canonicalName.charAt(0).toUpperCase() + canonicalName.slice(1), 
                    code,
                    normalizedName: name
                };
            }
        }
        return null;
    }

    logDebug(message, payload) {
        if (!this.debugSearch) return;
        if (payload !== undefined) {
            console.log(`[WeatherSearch] ${message}`, payload);
        } else {
            console.log(`[WeatherSearch] ${message}`);
        }
    }

    logResultsPreview(label, results = [], max = 10) {
        if (!this.debugSearch) return;
        const preview = results.slice(0, max).map(item => ({
            city: item.city,
            region: item.region,
            country: item.country,
            lat: item.lat,
            lon: item.lon
        }));
        this.logDebug(`${label} (count=${results.length})`, preview);
    }

    isCityType(location) {
        const address = location?.address || {};
        const type = (location?.type || '').toLowerCase();

        // Scarta tipi che non sono città
        const excludedTypes = ['country', 'state', 'region', 'continent', 'island',
            'residential', 'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
            'house', 'yes', 'apartments', 'retail', 'commercial', 'industrial',
            'rail', 'river', 'stream', 'forest', 'park', 'hotel', 'restaurant'];
        if (excludedTypes.includes(type)) return false;

        // Accetta se ha un campo città nell'address
        const hasCityField = Boolean(
            address.city || address.town || address.village ||
            address.municipality || address.hamlet || address.suburb
        );
        if (hasCityField) return true;

        // Accetta tipi esplicitamente città
        const cityTypes = ['city', 'town', 'village', 'municipality', 'hamlet', 'suburb', 'administrative'];
        if (cityTypes.includes(type)) {
            const hasRegion = Boolean(address.state || address.county || address.country);
            return hasRegion;
        }

        return false;
    }

    extractRegion(address = {}) {
        return (
            address.state ||
            address.region ||
            address.state_district ||
            address.county ||
            address.province ||
            ''
        );
    }

    getCityLabel(location) {
        const address = location?.address || {};
        return (
            address.city ||
            address.town ||
            address.village ||
            address.municipality ||
            address.hamlet ||
            address.suburb ||
            (location?.name || '') ||
            (location?.display_name || '').split(',')[0] ||
            ''
        ).trim();
    }

    mapToCityResult(location) {
        if (!location || !location.address) {
            // this.logDebug('mapToCityResult: scartato (no location/address)', location?.display_name);
            return null;
        }

        const cls = (location?.class || '').toLowerCase();
        const type = (location?.type || '').toLowerCase();

        if (!this.isCityType(location)) {
            // this.logDebug(`mapToCityResult: scartato per class/type (class="${cls}", type="${type}")`, location.display_name);
            return null;
        }

        const city = this.getCityLabel(location);
        const fallbackRegion = (location.display_name || '').split(',')[1]?.trim() || '';
        let region = (this.extractRegion(location.address) || fallbackRegion || location.address?.country || '').trim();
        const country = (location.address.country || '').trim();

        if (!city) {
            // this.logDebug('mapToCityResult: scartato (no city name)', location.display_name);
            return null;
        }

        if (!region) {
            // this.logDebug('mapToCityResult: scartato (no region)', { city, display_name: location.display_name, address: location.address });
            return null;
        }

        return {
            ...location,
            city,
            region,
            country,
            country_code: location.address?.country_code || ''
        };
    }

    dedupeCityResults(results = [], limit = this.maxSuggestions) {
        const seen = new Set();
        const unique = [];

        for (const result of results) {
            const cityResult = this.mapToCityResult(result);
            if (!cityResult) continue;

            const key = `${this.normalizeText(cityResult.city)}|${this.normalizeText(cityResult.region)}|${this.normalizeText(cityResult.country)}|${this.normalizeText(cityResult.country_code)}`;
            if (seen.has(key)) continue;

            seen.add(key);
            unique.push(cityResult);

            if (unique.length >= limit) break;
        }

        return unique;
    }

    async fetchCityLocations(query, limit = 50) {
        const cacheKey = `${query.toLowerCase()}|${limit}`;
        if (this.requestCache.has(cacheKey)) {
            // this.logDebug(`fetchCityLocations("${query}") → cache hit`);
            return this.requestCache.get(cacheKey);
        }

        // Usa Photon (Komoot) — stessi dati OSM, CORS abilitato, rate limit generoso
        const params = new URLSearchParams({
            q: query,
            limit: String(limit)
        });

        const geoUrl = `https://photon.komoot.io/api/?${params.toString()}`;

        try {
            const response = await fetch(geoUrl);
            if (!response.ok) {
                // this.logDebug(`fetchCityLocations("${query}") → errore HTTP ${response.status}`);
                return [];
            }

            const geoJson = await response.json();
            const features = geoJson?.features || [];

            // Converti formato Photon GeoJSON → formato compatibile Nominatim
            const results = features.map(feature => {
                const props = feature.properties || {};
                const coords = feature.geometry?.coordinates || [0, 0];
                return {
                    lat: String(coords[1]),
                    lon: String(coords[0]),
                    display_name: [props.name, props.state, props.country].filter(Boolean).join(', '),
                    name: props.name || '',
                    class: props.osm_value === 'city' || props.osm_value === 'town' || props.osm_value === 'village' || props.osm_value === 'municipality' || props.osm_value === 'hamlet' ? 'place' : (props.osm_key || ''),
                    type: props.osm_value || '',
                    address: {
                        city: props.osm_value === 'city' ? props.name : (props.city || ''),
                        town: props.osm_value === 'town' ? props.name : '',
                        village: props.osm_value === 'village' ? props.name : '',
                        municipality: props.osm_value === 'municipality' ? props.name : '',
                        hamlet: props.osm_value === 'hamlet' ? props.name : '',
                        suburb: props.osm_value === 'suburb' ? props.name : '',
                        state: props.state || '',
                        county: props.county || '',
                        country: props.country || '',
                        country_code: props.countrycode || '',
                        state_code: props.state_code || ''
                    }
                };
            });

            this.requestCache.set(cacheKey, results);
            // this.logDebug(`fetchCityLocations("${query}") → ${results.length} risultati (Photon)`);
            return results;
        } catch (error) {
            // this.logDebug(`fetchCityLocations("${query}") → errore fetch`, error.message);
            return [];
        }
    }

    // Fetch tutte le città di un paese usando il filtro country di Photon
    async fetchCountryCities(countryCode, countryName, limit = 100) {
        if (!countryName) {
            countryName = this.COUNTRY_CANONICAL_NAMES[countryCode];
        }
        if (!countryName) {
            // this.logDebug(`fetchCountryCities: No name found for country code ${countryCode}`);
            return [];
        }
        
        const cacheKey = `country:${countryName}|${countryCode}|${limit}`;
        if (this.requestCache.has(cacheKey)) {
            // this.logDebug(`fetchCountryCities("${countryName}") → cache hit`);
            return this.requestCache.get(cacheKey);
        }
        
        // Photon requires a q parameter - use the country name for the query
        const params = new URLSearchParams({
            q: countryName,
            limit: String(limit)
        });
        
        const geoUrl = `https://photon.komoot.io/api/?${params.toString()}`;
        
        try {
            const response = await fetch(geoUrl);
if (!response.ok) {
            // this.logDebug(`fetchCountryCities("${countryName}") → errore HTTP ${response.status}`);
            return [];
        }
            
            const geoJson = await response.json();
            const features = geoJson?.features || [];
            
            const results = features.map(feature => {
                const props = feature.properties || {};
                const coords = feature.geometry?.coordinates || [0, 0];
                return {
                    lat: String(coords[1]),
                    lon: String(coords[0]),
                    display_name: [props.name, props.state, props.country].filter(Boolean).join(', '),
                    name: props.name || '',
                    class: props.osm_value === 'city' || props.osm_value === 'town' || props.osm_value === 'village' || props.osm_value === 'municipality' || props.osm_value === 'hamlet' ? 'place' : (props.osm_key || ''),
                    type: props.osm_value || '',
                    address: {
                        city: props.osm_value === 'city' ? props.name : (props.city || ''),
                        town: props.osm_value === 'town' ? props.name : '',
                        village: props.osm_value === 'village' ? props.name : '',
                        municipality: props.osm_value === 'municipality' ? props.name : '',
                        hamlet: props.osm_value === 'hamlet' ? props.name : '',
                        suburb: props.osm_value === 'suburb' ? props.name : '',
                        state: props.state || '',
                        county: props.county || '',
                        country: props.country || '',
                        country_code: props.countrycode || '',
                        state_code: props.state_code || ''
                    }
                };
            });
            
            // Filter results to keep only cities from the specified country
            const countryResults = results.filter(result => 
                result.address.country_code.toUpperCase() === countryCode.toUpperCase()
            );
            
            // Filtra solo città valide (usa la logica esistente)
            const validResults = this.dedupeCityResults(countryResults, limit);
            
            this.requestCache.set(cacheKey, validResults);
            // this.logDebug(`fetchCountryCities("${countryName}") → ${validResults.length} città (Photon, filtered by country code ${countryCode})`);
            return validResults;
        } catch (error) {
            // this.logDebug(`fetchCountryCities("${countryName}") → errore fetch`, error.message);
            return [];
        }
    }

    async fetchMajorCitiesForCountry(countryCode) {
const cities = this.COUNTRY_MAJOR_CITIES[countryCode];
            // this.logDebug(`fetchMajorCitiesForCountry(${countryCode}): cities=${cities ? cities.length : 0}`);
            if (!cities) return [];
        
        const results = [];
        for (const cityName of cities) {
            const cacheKey = `city:${cityName}|${countryCode}`;
            if (this.requestCache.has(cacheKey)) {
                // this.logDebug(`fetchMajorCitiesForCountry: cache hit for ${cityName}`);
                results.push(this.requestCache.get(cacheKey));
                continue;
            }
            
            const countryName = this.COUNTRY_CANONICAL_NAMES[countryCode];
            const params = new URLSearchParams({
                q: `${cityName}, ${countryName}`,
                limit: '1'
            });
            const geoUrl = `https://photon.komoot.io/api/?${params.toString()}`;
            // this.logDebug(`fetchMajorCitiesForCountry: fetching ${geoUrl}`);
            
            try {
                const response = await fetch(geoUrl);
if (!response.ok) {
                // this.logDebug(`fetchMajorCitiesForCountry: HTTP error ${response.status} for ${cityName}`);
                continue;
            }
                
                const geoJson = await response.json();
                const feature = geoJson?.features?.[0];
                if (!feature) {
                    // this.logDebug(`fetchMajorCitiesForCountry: no features for ${cityName}`);
                    continue;
                }
                
                const props = feature.properties || {};
                // this.logDebug(`fetchMajorCitiesForCountry: found ${props.name} in ${props.country}`);
                
                const coords = feature.geometry?.coordinates || [0, 0];
                const location = {
                    lat: String(coords[1]),
                    lon: String(coords[0]),
                    display_name: [props.name, props.state, props.country].filter(Boolean).join(', '),
                    name: props.name || '',
                    class: 'place',
                    type: props.osm_value || '',
                    address: {
                        city: props.osm_value === 'city' ? props.name : (props.city || ''),
                        state: props.state || '',
                        country: props.country || '',
                        country_code: props.countrycode || ''
                    }
                };
                
                const cityResult = this.mapToCityResult(location);
                if (cityResult) {
                    // this.logDebug(`fetchMajorCitiesForCountry: mapped ${cityName} -> ${cityResult.city}, ${cityResult.country}`);
                    this.requestCache.set(cacheKey, cityResult);
                    results.push(cityResult);
                } else {
                    // this.logDebug(`fetchMajorCitiesForCountry: mapToCityResult returned null for ${cityName}`);
                }
            } catch (error) {
                this.logDebug(`fetchMajorCitiesForCountry: error for ${cityName}`, error.message);
            }
        }
        
        this.logDebug(`fetchMajorCitiesForCountry(${countryCode}): returning ${results.length} cities`);
        return results;
    }

    pickBestQueryMatch(query, results = []) {
        const normalizedQuery = this.normalizeText(query);

        const exactMatch = results.find(item => this.normalizeText(item.city) === normalizedQuery);
        if (exactMatch) return exactMatch;

        const startsWithMatch = results.find(item => this.normalizeText(item.city).startsWith(normalizedQuery));
        if (startsWithMatch) return startsWithMatch;

        return results[0] || null;
    }

    getCityMatchType(cityValue, query) {
        const city = this.normalizeText(cityValue);
        if (!city || !query) return 0;
        if (city.startsWith(query)) return 4;
        if (city.includes(query)) return 3;
        if (this.isSubsequenceMatch(city, query)) return 2;
        if (this.hasAllQueryChars(city, query)) return 1;
        return 0;
    }

    isSubsequenceMatch(value, query) {
        let queryIndex = 0;
        for (let i = 0; i < value.length && queryIndex < query.length; i++) {
            if (value[i] === query[queryIndex]) {
                queryIndex++;
            }
        }
        return queryIndex === query.length;
    }

    hasAllQueryChars(value, query) {
        if (!query) return false;

        const availableChars = new Map();
        for (const char of value) {
            availableChars.set(char, (availableChars.get(char) || 0) + 1);
        }

        for (const char of query) {
            const count = availableChars.get(char) || 0;
            if (count <= 0) return false;
            availableChars.set(char, count - 1);
        }

        return true;
    }

    rankResultsByQuery(query, results = []) {
        const normalizedQuery = this.normalizeText(query);
        if (!normalizedQuery) return results;

        const ranked = results
            .map((item, index) => {
                const cityMatchType = this.getCityMatchType(item.city, normalizedQuery);
                const cityName = this.normalizeText(item.city);

                return {
                    item,
                    index,
                    cityMatchType,
                    cityName
                };
            })
            .filter(entry => entry.cityMatchType > 0)
            .sort((a, b) => {
                if (a.cityMatchType !== b.cityMatchType) return b.cityMatchType - a.cityMatchType;
                const alphaCompare = a.cityName.localeCompare(b.cityName);
                if (alphaCompare !== 0) return alphaCompare;
                return a.index - b.index;
            })
            .map(entry => entry.item);

        this.logDebug(`Ranking completato per query="${query}"`, {
            totalInput: results.length,
            totalRanked: ranked.length,
            startsWith: ranked.filter(item => this.getCityMatchType(item.city, normalizedQuery) === 4).length,
            includes: ranked.filter(item => this.getCityMatchType(item.city, normalizedQuery) === 3).length,
            subsequence: ranked.filter(item => this.getCityMatchType(item.city, normalizedQuery) === 2).length,
            charPresence: ranked.filter(item => this.getCityMatchType(item.city, normalizedQuery) === 1).length
        });

        return ranked;
    }

    buildSuggestionQueries(query) {
        const cleaned = query.trim();
        if (!cleaned) return [];
        this.logDebug(`Query candidate costruite per "${query}"`, [cleaned]);
        return [cleaned];
    }

    async fetchSuggestionCandidates(query) {
        const results = await this.fetchCityLocations(query, 50);
        this.logDebug(`Candidati grezzi recuperati per "${query}"`, {
            rawCount: results.length
        });
        return results;
    }

    setupSuggestions() {
        const searchBar = this.card.querySelector('.weather-search');
        if (!searchBar) return;
        
        // Crea il container per le suggestions
        this.suggestionsContainer = document.createElement('div');
        this.suggestionsContainer.className = 'weather-suggestions';
        
        // Inserisci dopo l'input di ricerca
        const searchWrapper = searchBar.parentElement;
        if (searchWrapper) {
            searchWrapper.style.position = 'relative';
            searchWrapper.style.zIndex = '9999';
            searchWrapper.appendChild(this.suggestionsContainer);
        }
        
        // Event listener per input con debounce
        searchBar.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            this.logDebug(`Input utente: "${query}" (len=${query.length})`);
            
            // Cancella il timeout precedente
            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout);
            }
            
            if (query.length === 0) {
                this.showDefaultSuggestions();
                return;
            }

            // Mostra risultati dinamici dal 3° carattere
            if (query.length < 3) {
                this.logDebug('Meno di 3 caratteri: suggestions dinamiche nascoste');
                this.hideSuggestions();
                return;
            }
            
            // Debounce: aspetta 500ms prima di cercare (rispetta rate limit Nominatim)
            this.searchTimeout = setTimeout(() => {
                this.fetchSuggestions(query);
            }, 500);
        });

        searchBar.addEventListener('focus', () => {
            if (!searchBar.value.trim()) {
                this.showDefaultSuggestions();
            }
        });

        searchBar.addEventListener('click', () => {
            if (!searchBar.value.trim()) {
                this.showDefaultSuggestions();
            }
        });
        
        // Chiudi suggestions quando si clicca fuori
        document.addEventListener('click', (e) => {
            if (!this.card.contains(e.target)) {
                this.hideSuggestions();
            }
        });
        
        // Navigazione con tastiera
        searchBar.addEventListener('keydown', (e) => {
            this.handleKeyboardNavigation(e);
        });
    }

showDefaultSuggestions() {
         if (!this.defaultSuggestionResults || this.defaultSuggestionResults.length === 0) return;
         this.showSuggestions(this.defaultSuggestionResults);
     }

     isQueryACountryName(query, results) {
         const normalizedQuery = this.normalizeText(query);
         if (!normalizedQuery || !results || results.length === 0) return null;
         const match = results.find(r => this.normalizeText(r.country) === normalizedQuery);
         return match ? match.country : null;
     }

async fetchSuggestions(query) {
    try {
        // Prima controlla se la query corrisponde a un paese (prefix match)
        const detectedCountry = this.detectCountryFromQuery(query);
        
        // Fai sempre la ricerca standard con la query dell'utente
        const rawResults = await this.fetchSuggestionCandidates(query);
        const uniqueResults = this.dedupeCityResults(rawResults, 250);
        
        if (detectedCountry) {
            this.logDebug(`Paese rilevato: "${detectedCountry.name}" (${detectedCountry.code}) per query "${query}"`);
            
            const majorCities = await this.fetchMajorCitiesForCountry(detectedCountry.code);
            const rankedQueryMatches = this.rankResultsByQuery(query, uniqueResults);
            
            this.logDebug(`fetchSuggestions: queryMatches=${rankedQueryMatches.length}, countryCities=${majorCities.length}`);
            this.showSuggestions(rankedQueryMatches, query, detectedCountry, majorCities);
            return;
        }
        
        // Ricerca standard per città (when no country detected)
        this.logDebug(`Risultati unici city-only per "${query}"`, { count: uniqueResults.length });
        const rankedResults = this.rankResultsByQuery(query, uniqueResults);
        this.logResultsPreview(`Top suggestions finali per "${query}"`, rankedResults);
        
        if (rankedResults.length > 0) {
            this.showSuggestions(rankedResults, query);
        } else {
            this.logDebug(`Nessun risultato finale per "${query}"`);
            this.hideSuggestions();
        }
    } catch (error) {
        this.logDebug('Errore in fetchSuggestions', error);
        this.hideSuggestions();
    }
}

     appendSuggestionItem(location, index) {
         const item = document.createElement('div');
         item.className = 'suggestion-item';
         item.dataset.index = index;
         const cityName = location.city || this.getCityLabel(location);
         const details = [location.region, location.country].filter(Boolean).join(', ');
         item.innerHTML = `
             <span class="suggestion-city">${cityName}</span>
             <span class="suggestion-details">${details}</span>
         `;
         item.addEventListener('click', () => { this.selectSuggestion(location); });
         item.addEventListener('mouseenter', () => { this.setActiveSuggestion(index); });
         this.suggestionsContainer.appendChild(item);
     }

showSuggestions(suggestions, query, detectedCountry = null, countryCities = null) {
        if (!this.suggestionsContainer) return;
        
        this.suggestionsContainer.innerHTML = '';
        
        if (detectedCountry && countryCities && countryCities.length > 0) {
            let idx = 0;
            
            suggestions.forEach(location => {
                this.appendSuggestionItem(location, idx++);
            });
            
            const header = document.createElement('div');
            header.className = 'suggestion-country-header';
            header.textContent = detectedCountry.name.toUpperCase();
            this.suggestionsContainer.appendChild(header);
            
            countryCities.forEach(location => {
                this.appendSuggestionItem(location, idx++);
            });
            
            this.currentSuggestions = [...suggestions, ...countryCities];
        } else if (detectedCountry) {
            const normalizedQuery = this.normalizeText(query);
            
            const queryMatches = suggestions.filter(r => 
                this.normalizeText(r.city).includes(normalizedQuery)
            );
            
            const countryResults = suggestions.filter(r => 
                !this.normalizeText(r.city).includes(normalizedQuery) &&
                r.country && this.normalizeText(r.country) === this.normalizeText(detectedCountry.name)
            );
            
            let idx = 0;
            queryMatches.forEach(location => {
                this.appendSuggestionItem(location, idx++);
            });
            
            if (countryResults.length > 0) {
                const header = document.createElement('div');
                header.className = 'suggestion-country-header';
                header.textContent = detectedCountry.name.toUpperCase();
                this.suggestionsContainer.appendChild(header);
                
                countryResults.forEach(location => {
                    this.appendSuggestionItem(location, idx++);
                });
            }
            
            this.currentSuggestions = [...queryMatches, ...countryResults];
        } 
        // Caso 2: Nessun paese rilevato esplicitamente, ma la query corrisponde a un nome di paese
        else {
            const matchedCountry = this.isQueryACountryName(query, suggestions);
            if (matchedCountry) {
                // Usa la logica di fallback originale (semplificata)
                const countries = [...new Set(suggestions.map(r => r.country))];
                
                if (countries.length > 1) {
                    // Molti paesi - mostra header e filtra per paese corrispondente
                    const header = document.createElement('div');
                    header.className = 'suggestion-country-header';
                    header.textContent = matchedCountry.toUpperCase();
                    this.suggestionsContainer.appendChild(header);
                    
                    const countryResults = suggestions.filter(r =>
                        this.normalizeText(r.country) === this.normalizeText(matchedCountry)
                    );
                    
                    let idx = 0;
                    countryResults.forEach(location => {
                        this.appendSuggestionItem(location, idx++);
                    });
                    
                    // Mostra anche i risultati di altri paesi
                    const otherResults = suggestions.filter(r =>
                        this.normalizeText(r.country) !== this.normalizeText(matchedCountry)
                    );
                    otherResults.forEach(location => {
                        this.appendSuggestionItem(location, idx++);
                    });
                    this.currentSuggestions = [...countryResults, ...otherResults];
                } else {
                    // Un solo paese - nessun header
                    suggestions.forEach((location, index) => {
                        this.appendSuggestionItem(location, index);
                    });
                    this.currentSuggestions = suggestions;
                }
            } 
            // Caso 3: Nessun corrispondenza paese - ricerca standard
            else {
                // Ricerca standard per città — nessun raggruppamento per paese
                suggestions.forEach((location, index) => {
                    this.appendSuggestionItem(location, index);
                });
                this.currentSuggestions = suggestions;
            }
        }
        
        this.activeIndex = -1;
        this.suggestionsContainer.classList.add('visible');
    }
    
    hideSuggestions() {
        if (this.suggestionsContainer) {
            this.suggestionsContainer.classList.remove('visible');
            this.suggestionsContainer.innerHTML = '';
        }
        this.currentSuggestions = [];
        this.activeIndex = -1;
    }
    
    setActiveSuggestion(index) {
        const items = this.suggestionsContainer.querySelectorAll('.suggestion-item');
        items.forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });
        this.activeIndex = index;
    }
    
    handleKeyboardNavigation(e) {
        if (!this.currentSuggestions || this.currentSuggestions.length === 0) return;
        
        const items = this.suggestionsContainer.querySelectorAll('.suggestion-item');
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.activeIndex = Math.min(this.activeIndex + 1, items.length - 1);
                this.setActiveSuggestion(this.activeIndex);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                this.activeIndex = Math.max(this.activeIndex - 1, 0);
                this.setActiveSuggestion(this.activeIndex);
                break;
                
            case 'Enter':
                if (this.activeIndex >= 0 && this.currentSuggestions[this.activeIndex]) {
                    e.preventDefault();
                    this.selectSuggestion(this.currentSuggestions[this.activeIndex]);
                }
                break;
                
            case 'Escape':
                this.hideSuggestions();
                break;
        }
    }
    
    selectSuggestion(location) {
        const searchBar = this.card.querySelector('.weather-search');
        const cityName = location.city || this.getCityLabel(location);
        
        // Aggiorna l'input
        if (searchBar) {
            searchBar.value = cityName;
        }
        
        // Nascondi suggestions
        this.hideSuggestions();
        
        // Carica i dati meteo
        const lat = parseFloat(location.lat);
        const lon = parseFloat(location.lon);
        const region = location.region || this.extractRegion(location.address || {});
        const stateCode = location.address?.state_code || location.address?.ISO3166_2_lvl4 || '';
        const country = location.country || location.address?.country || '';
        const countryCode = (location.address?.country_code || '').toUpperCase();
        
        this.loadWeatherData(lat, lon, cityName, region, stateCode, country, countryCode);
    }
    
    async loadDefaultCity() {
        this.hasLoadedWeatherData = false;
        this.updateRetryButtonVisibility();
        try {
            const geoData = await this.fetchCityLocations(this.defaultCity, 20);
            const validResults = this.dedupeCityResults(geoData, 5);
            
            if (validResults.length > 0) {
                const location = validResults[0];
                const region = location.region || this.extractRegion(location.address || {});
                const stateCode = location.address?.state_code || location.address?.ISO3166_2_lvl4 || '';
                const country = location.country || location.address?.country || '';
                const countryCode = (location.address?.country_code || '').toUpperCase();
                this.logDebug(`loadDefaultCity OK: city=${location.city}, region=${region}, stateCode=${stateCode}`);
                this.loadWeatherData(this.defaultLat, this.defaultLon, this.defaultCity, region, stateCode, country, countryCode);
            } else if (geoData && geoData.length > 0) {
                // Fallback: estrai regione dal primo risultato grezzo (display_name)
                const raw = geoData[0];
                const region = this.extractRegion(raw.address || {}) || (raw.display_name || '').split(',')[1]?.trim() || '';
                const stateCode = raw.address?.state_code || raw.address?.ISO3166_2_lvl4 || '';
                const country = raw.country || raw.address?.country || '';
                const countryCode = (raw.address?.country_code || '').toUpperCase();
                this.logDebug(`loadDefaultCity fallback grezzo: region=${region}`);
                this.loadWeatherData(this.defaultLat, this.defaultLon, this.defaultCity, region, stateCode, country, countryCode);
            } else {
                // Fallback hardcoded per Milano
                this.logDebug('loadDefaultCity: nessun risultato, fallback hardcoded Lombardia');
                this.loadWeatherData(this.defaultLat, this.defaultLon, this.defaultCity, 'Lombardia', '');
            }
        } catch (error) {
            this.logDebug('loadDefaultCity errore, fallback hardcoded', error.message);
            this.loadWeatherData(this.defaultLat, this.defaultLon, this.defaultCity, 'Lombardia', '');
        }
    }
    
    setupSearchBar() {
        const searchBar = this.card.querySelector('.weather-search');
        const searchBtn = this.card.querySelector('.search-btn');
        
        if (searchBar && searchBtn) {
            searchBtn.addEventListener('click', () => this.handleSearch());
            searchBar.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSearch();
                }
            });
        }
    }
    
    async handleSearch() {
        const searchBar = this.card.querySelector('.weather-search');
        const cityName = searchBar.value.trim();
        
        if (!cityName) return;

        this.hasLoadedWeatherData = false;
        this.updateRetryButtonVisibility();
        
        try {
            // Ricerca precisa: solo città con regione valida e senza duplicati
            const rawResults = await this.fetchCityLocations(cityName, 20);
            const validResults = this.dedupeCityResults(rawResults, this.maxSuggestions);

            if (validResults.length > 0) {
                const location = this.pickBestQueryMatch(cityName, validResults);
                const lat = parseFloat(location.lat);
                const lon = parseFloat(location.lon);
                const displayName = location.city || this.getCityLabel(location);
                const region = location.region || this.extractRegion(location.address || {});
                const stateCode = location.address?.state_code || location.address?.ISO3166_2_lvl4 || '';
                const country = location.country || location.address?.country || '';
                const countryCode = (location.address?.country_code || '').toUpperCase();
                
                this.loadWeatherData(lat, lon, displayName, region, stateCode, country, countryCode);
            } else {
                this.showError('Inserisci una città valida');
                alert('Puoi cercare solo città (non regioni, stati o continenti).');
            }
        } catch (error) {
            this.showError('Non ci è stato possibile stabilire una connessione - Please check your internet connection' );
        }
    }
    
    getNextEventTimestamp(todayISO, tomorrowISO) {
        const nowTs = Date.now();
        const todayTs = todayISO ? new Date(todayISO).getTime() : NaN;
        const tomorrowTs = tomorrowISO ? new Date(tomorrowISO).getTime() : NaN;

        if (Number.isFinite(todayTs) && todayTs > nowTs) return todayTs;
        if (Number.isFinite(tomorrowTs)) return tomorrowTs;
        if (Number.isFinite(todayTs)) return todayTs + (24 * 60 * 60 * 1000);
        return null;
    }

    formatCountdownFromNow(targetTs) {
        if (!Number.isFinite(targetTs)) return '--:--:--';
        const diffMs = Math.max(0, targetTs - Date.now());
        const totalSeconds = Math.floor(diffMs / 1000);
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    setChipVisibility(containerSelector, isVisible) {
        const container = this.card.querySelector(containerSelector);
        if (!container) return;
        container.style.display = isVisible ? '' : 'none';
    }

    async resolveCountryContext(lat, lon, countryName = '', countryCode = '') {
        const normalizedCode = (countryCode || '').toUpperCase();
        if (normalizedCode) {
            return {
                country: countryName || '',
                countryCode: normalizedCode
            };
        }

        try {
            const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=en`;
            const response = await fetch(reverseUrl);
            if (!response.ok) {
                return { country: countryName || '', countryCode: '' };
            }

            const payload = await response.json();
            return {
                country: payload?.address?.country || countryName || '',
                countryCode: (payload?.address?.country_code || '').toUpperCase()
            };
        } catch (error) {
            return {
                country: countryName || '',
                countryCode: ''
            };
        }
    }

    async fetchWorldBankCountryStats(countryCode) {
        const upperCountryCode = (countryCode || '').toUpperCase();
        if (!upperCountryCode) {
            return {
                populationDensity: null,
                crimePercent: null
            };
        }

        const populationUrl = `https://api.worldbank.org/v2/country/${upperCountryCode}/indicator/EN.POP.DNST?format=json&per_page=80`;
        const crimeUrl = `https://api.worldbank.org/v2/country/${upperCountryCode}/indicator/VC.IHR.PSRC.P5?format=json&per_page=80`;

        const extractLatestNumericValue = (responsePayload) => {
            const series = Array.isArray(responsePayload) ? responsePayload[1] : [];
            if (!Array.isArray(series)) return null;
            const entry = series.find(item => item && typeof item.value === 'number' && Number.isFinite(item.value));
            return entry ? entry.value : null;
        };

        try {
            const [populationRes, crimeRes] = await Promise.allSettled([
                fetch(populationUrl),
                fetch(crimeUrl)
            ]);

            let populationDensity = null;
            let crimePercent = null;

            if (populationRes.status === 'fulfilled' && populationRes.value.ok) {
                const populationJson = await populationRes.value.json();
                const popValue = extractLatestNumericValue(populationJson);
                if (typeof popValue === 'number') {
                    populationDensity = Math.round(popValue);
                }
            }

            if (crimeRes.status === 'fulfilled' && crimeRes.value.ok) {
                const crimeJson = await crimeRes.value.json();
                const homicideRate = extractLatestNumericValue(crimeJson);
                if (typeof homicideRate === 'number') {
                    crimePercent = Math.max(0, Math.min(100, Number(homicideRate.toFixed(1))));
                }
            }

            return {
                populationDensity,
                crimePercent
            };
        } catch (error) {
            return {
                populationDensity: null,
                crimePercent: null
            };
        }
    }

    async fetchSunCountdownTargets(lat, lon) {
        try {
            const baseUrl = 'https://api.sunrise-sunset.org/json';
            const todayUrl = `${baseUrl}?lat=${lat}&lng=${lon}&formatted=0`;
            const tomorrowUrl = `${baseUrl}?lat=${lat}&lng=${lon}&formatted=0&date=tomorrow`;

            const [todayRes, tomorrowRes] = await Promise.allSettled([
                fetch(todayUrl),
                fetch(tomorrowUrl)
            ]);

            const todayJson = (todayRes.status === 'fulfilled' && todayRes.value.ok)
                ? await todayRes.value.json()
                : null;
            const tomorrowJson = (tomorrowRes.status === 'fulfilled' && tomorrowRes.value.ok)
                ? await tomorrowRes.value.json()
                : null;

            const sunriseToday = todayJson?.results?.sunrise || null;
            const sunsetToday = todayJson?.results?.sunset || null;
            const sunriseTomorrow = tomorrowJson?.results?.sunrise || null;
            const sunsetTomorrow = tomorrowJson?.results?.sunset || null;

            return {
                nextSunriseTs: this.getNextEventTimestamp(sunriseToday, sunriseTomorrow),
                nextSunsetTs: this.getNextEventTimestamp(sunsetToday, sunsetTomorrow)
            };
        } catch (error) {
            return {
                nextSunriseTs: null,
                nextSunsetTs: null
            };
        }
    }

    async loadWeatherData(lat, lon, cityName, region = '', stateCode = '', country = '', countryCode = '') {
        try {
            const countryContext = await this.resolveCountryContext(lat, lon, country, countryCode);
            let timezone = 'UTC';
            
            // Calcolo timezone basato su coordinate geografiche
            // Europa
            if (lat >= 35 && lat <= 71 && lon >= -10 && lon <= 40) {
                if (lon >= -10 && lon < -5) timezone = 'Atlantic/Azores';
                else if (lon >= -5 && lon < 5) timezone = 'Europe/London';
                else if (lon >= 5 && lon < 15) timezone = 'Europe/Paris';
                else if (lon >= 15 && lon < 25) timezone = 'Europe/Warsaw';
                else if (lon >= 25 && lon < 30) timezone = 'Europe/Athens';
                else if (lon >= 30 && lon <= 40) timezone = 'Europe/Moscow';
            }
            // Nord America
            else if (lat >= 25 && lat <= 72 && lon >= -170 && lon < -50) {
                if (lon >= -170 && lon < -140) timezone = 'America/Anchorage';
                else if (lon >= -140 && lon < -120) timezone = 'America/Los_Angeles';
                else if (lon >= -120 && lon < -105) timezone = 'America/Denver';
                else if (lon >= -105 && lon < -90) timezone = 'America/Chicago';
                else if (lon >= -90 && lon < -70) timezone = 'America/New_York';
                else if (lon >= -70 && lon < -50) timezone = 'America/Halifax';
            }
            // Sud America
            else if (lat >= -55 && lat < 15 && lon >= -80 && lon < -35) {
                if (lon >= -80 && lon < -70) timezone = 'America/Lima';
                else if (lon >= -70 && lon < -60) timezone = 'America/Santiago';
                else if (lon >= -60 && lon < -50) timezone = 'America/Argentina/Buenos_Aires';
                else if (lon >= -50 && lon < -35) timezone = 'America/Sao_Paulo';
            }
            // Asia
            else if (lat >= -10 && lat <= 55 && lon >= 40 && lon <= 150) {
                if (lon >= 40 && lon < 50) timezone = 'Asia/Dubai';
                else if (lon >= 50 && lon < 70) timezone = 'Asia/Karachi';
                else if (lon >= 70 && lon < 90) timezone = 'Asia/Kolkata';
                else if (lon >= 90 && lon < 105) timezone = 'Asia/Bangkok';
                else if (lon >= 105 && lon < 125) timezone = 'Asia/Shanghai';
                else if (lon >= 125 && lon < 145) timezone = 'Asia/Tokyo';
                else if (lon >= 145 && lon <= 150) timezone = 'Asia/Vladivostok';
            }
            // Oceania
            else if (lat >= -50 && lat < -10 && lon >= 110 && lon <= 180) {
                if (lon >= 110 && lon < 135) timezone = 'Australia/Perth';
                else if (lon >= 135 && lon < 155) timezone = 'Australia/Sydney';
                else if (lon >= 155 && lon <= 180) timezone = 'Pacific/Auckland';
            }
            // Africa
            else if (lat >= -35 && lat < 35 && lon >= -20 && lon < 55) {
                if (lon >= -20 && lon < 0) timezone = 'Africa/Casablanca';
                else if (lon >= 0 && lon < 15) timezone = 'Africa/Lagos';
                else if (lon >= 15 && lon < 30) timezone = 'Africa/Cairo';
                else if (lon >= 30 && lon < 45) timezone = 'Africa/Nairobi';
                else if (lon >= 45 && lon < 55) timezone = 'Indian/Mauritius';
            }
            // Pacifico
            else if (lat >= -30 && lat <= 30 && lon >= -180 && lon < -100) {
                if (lon >= -180 && lon < -150) timezone = 'Pacific/Honolulu';
                else if (lon >= -150 && lon < -130) timezone = 'Pacific/Tahiti';
                else if (lon >= -130 && lon < -100) timezone = 'Pacific/Galapagos';
            }
            
            // Mappa codici WMO (Open-Meteo) → Meteoblue pictocode
            // WMO: 0=Clear, 1=Mainly clear, 2=Partly cloudy, 3=Overcast, 45/48=Fog, 51-57=Drizzle, 61-67=Rain, 71-77=Snow, 80-82=Rain showers, 85-86=Snow showers, 95-99=Thunderstorm
            // Meteoblue: 1=Sereno, 2=Parz. nuvoloso, 3-4=Nuvoloso, 5-7=Pioggia leggera, 8-9=Pioggia forte, 10-15=Temporale, 16-20=Neve
            this.mapWMOToMeteoblue = function(wmoCode) {
                if (wmoCode === 0) return 1;                    // Clear sky → Sereno
                if (wmoCode === 1) return 2;                    // Mainly clear → Parz. nuvoloso
                if (wmoCode === 2) return 2;                    // Partly cloudy → Parz. nuvoloso
                if (wmoCode === 3) return 3;                    // Overcast → Nuvoloso
                if (wmoCode === 45 || wmoCode === 48) return 4; // Fog → Nuvoloso
                if (wmoCode >= 51 && wmoCode <= 57) return 5;   // Drizzle → Pioggia leggera
                if (wmoCode >= 61 && wmoCode <= 65) return 6;   // Rain → Pioggia leggera/moderata
                if (wmoCode === 66 || wmoCode === 67) return 7; // Freezing rain → Pioggia moderata
                if (wmoCode >= 71 && wmoCode <= 77) return 16;  // Snow → Neve
                if (wmoCode >= 80 && wmoCode <= 82) return 7;   // Rain showers → Pioggia moderata
                if (wmoCode === 85 || wmoCode === 86) return 17; // Snow showers → Neve
                if (wmoCode >= 95 && wmoCode <= 99) return 10;  // Thunderstorm → Temporale
                return 0;
            };
            
            // Carica i dati meteo da Open-Meteo (gratuito, no API key, no limiti restrittivi)
            const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation_probability&timezone=auto`;
            const [response, worldStats, sunTargets] = await Promise.all([
                fetch(apiUrl),
                this.fetchWorldBankCountryStats(countryContext.countryCode),
                this.fetchSunCountdownTargets(lat, lon)
            ]);

            const data = await response.json();
            
            // Open-Meteo restituisce i dati correnti in data.current
            if (data && data.current) {
                const current = data.current;
                const currentTemp = current.temperature_2m;
                const currentWeatherCode = this.mapWMOToMeteoblue(current.weather_code);
                const currentHumidity = current.relative_humidity_2m;
                const currentWindSpeed = current.wind_speed_10m;
                const currentPrecipProb = current.precipitation_probability;
                
                this.updateCard({
                    city: cityName,
                    region: region,
                    stateCode: stateCode,
                    country: '',
                    temperature: currentTemp != null ? Math.round(currentTemp) : '--',
                    humidity: currentHumidity != null ? Math.round(currentHumidity) : '--',
                    windSpeed: currentWindSpeed != null ? Math.round(currentWindSpeed) : '--',
                    precipProb: currentPrecipProb != null ? Math.round(currentPrecipProb) : '--',
                    date: this.formatDate(new Date()),
                    weatherCode: currentWeatherCode || 0,
                    timezone: timezone,
                    latitude: lat,
                    longitude: lon,
                    populationDensity: worldStats.populationDensity,
                    crimePercent: worldStats.crimePercent,
                    nextSunriseTs: sunTargets.nextSunriseTs,
                    nextSunsetTs: sunTargets.nextSunsetTs
                });
            } else {
                this.showError('Dati meteo non disponibili');
            }
        } catch (error) {
            this.showError('Errore caricamento dati meteo');
        }
    }
    
    updateCard(weatherData) {
        this.hasLoadedWeatherData = true;
        this.hideRetryButton();
        if (this.retryVisibilityTimer) {
            clearTimeout(this.retryVisibilityTimer);
        }

        // Aggiorna location (primo span)
        const locationSpan = this.card.querySelector('.card-header span:first-child');
        if (locationSpan) {
            locationSpan.textContent = weatherData.city;
            
            // Forza il ricalcolo del testo adattivo passando l'elemento
            if (window.adaptiveTextInstance) {
                window.adaptiveTextInstance.adjustTextSize(locationSpan);
            }
        }
        
        // Aggiorna o crea lo span per la regione (secondo span, dopo first-child)
        let regionSpan = this.card.querySelector('.card-header .region-label');
        if (!regionSpan) {
            regionSpan = document.createElement('span');
            regionSpan.className = 'region-label';
            const cardHeader = this.card.querySelector('.card-header');
            // Inserisci dopo il primo span (città) ma prima dell'ultimo (data)
            const citySpan = cardHeader.querySelector('span:first-child');
            if (citySpan) {
                if (citySpan.nextSibling) {
                    cardHeader.insertBefore(regionSpan, citySpan.nextSibling);
                } else {
                    cardHeader.appendChild(regionSpan);
                }
            }
        }
        
        // Aggiorna regione con abbreviazione
        const regionText = weatherData.region ? 
            `${weatherData.region}${weatherData.stateCode ? ' (' + weatherData.stateCode + ')' : ''}` : 
            '';
        regionSpan.textContent = regionText;
        
        // Aggiorna data nel container con timezone della città
        const weatherDateSpan = this.card.querySelector('.weather-date');
        if (weatherDateSpan) {
            try {
                const timezone = weatherData.timezone || 'UTC';
                const dateString = new Date().toLocaleDateString('it-IT', {
                    timeZone: timezone,
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
                weatherDateSpan.textContent = dateString;
            } catch (error) {
                weatherDateSpan.textContent = this.formatDateDDMMYYYY(new Date());
            }
        }

        // Aggiorna umidità
        const humiditySpan = this.card.querySelector('.weather-humidity');
        if (humiditySpan) {
            humiditySpan.textContent = `${weatherData.humidity}%`;
        }

        // Aggiorna velocità vento
        const windSpan = this.card.querySelector('.weather-wind');
        if (windSpan) {
            windSpan.textContent = `${weatherData.windSpeed} km/h`;
        }

        // Aggiorna probabilità precipitazioni
        const precipSpan = this.card.querySelector('.weather-precip');
        if (precipSpan) {
            precipSpan.textContent = `${weatherData.precipProb}%`;
        }

        const populationSpan = this.card.querySelector('.weather-population');
        const hasPopulationDensity = typeof weatherData.populationDensity === 'number' && Number.isFinite(weatherData.populationDensity);
        this.setChipVisibility('.weather-population-container', hasPopulationDensity);
        if (populationSpan && hasPopulationDensity) {
            populationSpan.textContent = `${weatherData.populationDensity}/km²`;
        }

        const coordinatesSpan = this.card.querySelector('.weather-coordinates');
        const hasCoordinates = Number.isFinite(weatherData.latitude) && Number.isFinite(weatherData.longitude);
        this.setChipVisibility('.weather-coordinates-container', hasCoordinates);
        if (coordinatesSpan && hasCoordinates) {
            coordinatesSpan.textContent = `${weatherData.longitude.toFixed(4)}, ${weatherData.latitude.toFixed(4)}`;
        }

        const crimeSpan = this.card.querySelector('.weather-crime');
        const hasCrimeValue = typeof weatherData.crimePercent === 'number' && Number.isFinite(weatherData.crimePercent);
        this.setChipVisibility('.weather-crime-container', hasCrimeValue);
        if (crimeSpan && hasCrimeValue) {
            crimeSpan.textContent = `${weatherData.crimePercent}%`;
        }

        this.nextSunriseTs = Number.isFinite(weatherData.nextSunriseTs) ? weatherData.nextSunriseTs : null;
        this.nextSunsetTs = Number.isFinite(weatherData.nextSunsetTs) ? weatherData.nextSunsetTs : null;
        this.setChipVisibility('.weather-sunrise-container', this.nextSunriseTs != null);
        this.setChipVisibility('.weather-sunset-container', this.nextSunsetTs != null);
        this.updateSunCountdownDisplay();
        
        // Aggiorna temperatura
        const tempSpan = this.card.querySelector('.temp');
        if (tempSpan) {
            this.currentTempCelsius = weatherData.temperature !== '--' ? weatherData.temperature : null;
            this.updateTempDisplay();
        }
        
        // Aggiorna icona meteo in base al weather code
        this.updateWeatherIcon(weatherData.weatherCode);
        
        // Salva il timezone per l'orologio
        this.currentTimezone = weatherData.timezone || 'UTC';
        
        // Riavvia l'orologio con il nuovo timezone
        this.startClock();
        
        // Trigger adaptive text resize
        if (window.adaptiveTextInstance && locationSpan) {
            // Piccolo delay per permettere al DOM di aggiornarsi
            setTimeout(() => {
                window.adaptiveTextInstance.adjustTextSize(locationSpan);
            }, 10);
        }
    }
    
    updateWeatherIcon(weatherCode) {
        // Codici meteo Meteoblue pictocode:
        // 1: Sereno (sole pieno, senza nuvole)
        // 2: Parzialmente nuvoloso (sole con nuvole)
        // 3-4: Nuvoloso (solo nuvole, no sole)
        // 5-7: Pioggia leggera/moderata
        // 8-9: Pioggia forte
        // 10-15: Temporale
        // 16-20: Neve
        
        const sun = this.card.querySelector('.sun:not(.sunshine)');
        const sunShine = this.card.querySelector('.sun.sunshine');
        const clouds = this.card.querySelectorAll('.cloud');
        const lightning = this.card.querySelector('.lightning');
        const snowContainer = this.card.querySelector('.snow-container');
        const heavyRainMain = this.card.querySelector('.heavy-rain-main');
        const stormLateralLeft = this.card.querySelector('.storm-lateral-left');
        const stormLateralRight = this.card.querySelector('.storm-lateral-right');

        let weatherType = '';
        
        if (weatherCode === 1) {
            // ☀️ SERENO - Solo sole, nuvole nascoste
            weatherType = '☀️ SOLEGGIATO (SERENO)';
            
            // Mostra il sole
            sun.classList.remove('hidden');
            sun.style.opacity = '';
            sun.style.transform = '';
            if (sunShine) {
                sunShine.classList.remove('hidden');
                sunShine.style.opacity = '';
                sunShine.style.transform = '';
            }
            
            // Nascondi le nuvole
            clouds.forEach(cloud => {
                cloud.classList.add('hidden');
                cloud.classList.remove('dark', 'storm');
                cloud.style.opacity = '';
                cloud.style.transform = '';
            });
            
            // Nascondi nuvole pioggia forte/temporale
            if (heavyRainMain) heavyRainMain.classList.add('hidden');
            if (stormLateralLeft) stormLateralLeft.classList.add('hidden');
            if (stormLateralRight) stormLateralRight.classList.add('hidden');
            
            // Nascondi pioggia, temporale, neve
            if (this.rainContainer) this.rainContainer.classList.add('hidden');
            if (lightning) {
                lightning.classList.add('hidden');
                lightning.classList.remove('active', 'flash');
            }
            if (snowContainer) snowContainer.classList.add('hidden');
            
        } else if (weatherCode === 2) {
            // ⛅ PARZIALMENTE NUVOLOSO - Sole attenuato + nuvole
            weatherType = '⛅ PARZIALMENTE NUVOLOSO';
            
            // Mostra il sole con opacity ridotta
            sun.classList.remove('hidden');
            sun.style.opacity = '0.6';
            sun.style.transform = 'scale(1)';
            if (sunShine) {
                sunShine.classList.remove('hidden');
                sunShine.style.opacity = '0.5';
                sunShine.style.transform = 'scale(1)';
            }
            
            // Mostra le nuvole
            clouds.forEach(cloud => {
                cloud.classList.remove('hidden', 'dark', 'storm');
                cloud.style.opacity = '0.75';
                cloud.style.transform = 'scale(1)';
            });
            
            // Nascondi nuvole pioggia forte/temporale
            if (heavyRainMain) heavyRainMain.classList.add('hidden');
            if (stormLateralLeft) stormLateralLeft.classList.add('hidden');
            if (stormLateralRight) stormLateralRight.classList.add('hidden');
            
            // Nascondi pioggia, temporale, neve
            if (this.rainContainer) {
                this.rainContainer.classList.add('hidden');
                this.rainContainer.classList.remove('heavy', 'fast');
            }
            if (lightning) {
                lightning.classList.add('hidden');
                lightning.classList.remove('active', 'flash');
            }
            if (snowContainer) snowContainer.classList.add('hidden');
            
        } else if (weatherCode >= 3 && weatherCode <= 4) {
            // ☁️ NUVOLOSO - Solo nuvole, sole nascosto
            weatherType = '☁️ NUVOLOSO';
            
            // Nascondi il sole
            sun.classList.add('hidden');
            sun.style.opacity = '';
            sun.style.transform = '';
            if (sunShine) {
                sunShine.classList.add('hidden');
                sunShine.style.opacity = '';
                sunShine.style.transform = '';
            }
            
            // Mostra le nuvole
            clouds.forEach(cloud => {
                cloud.classList.remove('hidden', 'dark', 'storm');
                cloud.style.opacity = '1';
                cloud.style.transform = 'scale(1)';
            });
            
            // Nascondi nuvole pioggia forte/temporale
            if (heavyRainMain) heavyRainMain.classList.add('hidden');
            if (stormLateralLeft) stormLateralLeft.classList.add('hidden');
            if (stormLateralRight) stormLateralRight.classList.add('hidden');
            
            // Nascondi pioggia, temporale, neve
            if (this.rainContainer) {
                this.rainContainer.classList.add('hidden');
                this.rainContainer.classList.remove('heavy', 'fast');
            }
            if (lightning) {
                lightning.classList.add('hidden');
                lightning.classList.remove('active', 'flash');
            }
            if (snowContainer) snowContainer.classList.add('hidden');
            
        } else if (weatherCode >= 5 && weatherCode <= 7) {
            // 🌧️ PIOGGIA LEGGERA
            weatherType = '🌧️ PIOGGIA LEGGERA';
            
            sun.classList.add('hidden');
            sun.style.opacity = '';
            sun.style.transform = '';
            if (sunShine) {
                sunShine.classList.add('hidden');
                sunShine.style.opacity = '';
                sunShine.style.transform = '';
            }
            clouds.forEach(cloud => {
                cloud.classList.remove('hidden', 'dark', 'storm');
                cloud.style.opacity = '1';
                cloud.style.transform = 'scale(1)';
            });
            
            // Nascondi nuvole pioggia forte/temporale
            if (heavyRainMain) heavyRainMain.classList.add('hidden');
            if (stormLateralLeft) stormLateralLeft.classList.add('hidden');
            if (stormLateralRight) stormLateralRight.classList.add('hidden');
            
            // Mostra pioggia leggera
            this.setRainAnimation('none');
            if (lightning) {
                lightning.classList.add('hidden');
                lightning.classList.remove('active', 'flash');
            }
            if (snowContainer) snowContainer.classList.add('hidden');
            
        } else if (weatherCode >= 8 && weatherCode <= 9) {
            // 🌧️ PIOGGIA FORTE
            weatherType = '🌧️ PIOGGIA FORTE';
            
            sun.classList.add('hidden');
            sun.style.opacity = '';
            sun.style.transform = '';
            if (sunShine) {
                sunShine.classList.add('hidden');
                sunShine.style.opacity = '';
                sunShine.style.transform = '';
            }
            
            // Nascondi nuvole front/back
            clouds.forEach(cloud => {
                cloud.classList.add('hidden');
                cloud.classList.remove('dark', 'storm');
                cloud.style.opacity = '';
                cloud.style.transform = '';
            });
            
            // Mostra nuvola centrale pioggia forte
            if (heavyRainMain) {
                heavyRainMain.classList.remove('hidden');
                heavyRainMain.classList.remove('storm');
            }
            // Nascondi nuvole laterali (solo per temporale)
            if (stormLateralLeft) stormLateralLeft.classList.add('hidden');
            if (stormLateralRight) stormLateralRight.classList.add('hidden');
            
            // Mostra pioggia forte (velocita 1.7x)
            this.setRainAnimation('heavy');
            if (lightning) {
                lightning.classList.add('hidden');
                lightning.classList.remove('active', 'flash');
            }
            if (snowContainer) snowContainer.classList.add('hidden');
            
        } else if (weatherCode >= 10 && weatherCode <= 15) {
            // ⛈️ TEMPORALE
            weatherType = '⛈️ TEMPORALE';
            
            sun.classList.add('hidden');
            sun.style.opacity = '';
            sun.style.transform = '';
            if (sunShine) {
                sunShine.classList.add('hidden');
                sunShine.style.opacity = '';
                sunShine.style.transform = '';
            }
            
            // Nascondi nuvole front/back
            clouds.forEach(cloud => {
                cloud.classList.add('hidden');
                cloud.classList.remove('dark', 'storm');
                cloud.style.opacity = '';
                cloud.style.transform = '';
            });
            
            // Mostra nuvola centrale temporale (molto scura)
            if (heavyRainMain) {
                heavyRainMain.classList.remove('hidden');
                heavyRainMain.classList.add('storm');
            }
            // Mostra nuvole laterali grigie
            if (stormLateralLeft) {
                stormLateralLeft.classList.remove('hidden');
            }
            if (stormLateralRight) {
                stormLateralRight.classList.remove('hidden');
            }
            
            // Mostra pioggia veloce (2.5x)
            this.setRainAnimation('fast');
            
            // Lampi realistici - cerchio nero che si espande con cerchio grigio
            if (lightning) {
                lightning.classList.remove('hidden');
                lightning.classList.add('active');
            }
            if (snowContainer) snowContainer.classList.add('hidden');
            
        } else if (weatherCode >= 16 && weatherCode <= 20) {
            // ❄️ NEVE
            weatherType = '❄️ NEVE';
            
            sun.classList.add('hidden');
            sun.style.opacity = '';
            sun.style.transform = '';
            if (sunShine) {
                sunShine.classList.add('hidden');
                sunShine.style.opacity = '';
                sunShine.style.transform = '';
            }
            clouds.forEach(cloud => {
                cloud.classList.remove('hidden', 'dark', 'storm');
                cloud.style.opacity = '0.9';
                cloud.style.transform = 'scale(1)';
            });
            
            // Nascondi nuvole pioggia forte/temporale
            if (heavyRainMain) heavyRainMain.classList.add('hidden');
            if (stormLateralLeft) stormLateralLeft.classList.add('hidden');
            if (stormLateralRight) stormLateralRight.classList.add('hidden');
            
            // Mostra neve
            if (this.rainContainer) {
                this.rainContainer.classList.add('hidden');
                this.rainContainer.classList.remove('heavy', 'fast');
            }
            if (lightning) {
                lightning.classList.add('hidden');
                lightning.classList.remove('active', 'flash');
            }
            if (snowContainer) {
                snowContainer.classList.remove('hidden');
                snowContainer.style.opacity = '1';
            }
            
        } else {
            // 🌫️ ALTRO (neve, nebbia, ecc.)
            weatherType = '🌫️ ALTRO';
            
            sun.classList.remove('hidden');
            sun.style.opacity = '0.3';
            sun.style.transform = 'scale(1)';
            if (sunShine) {
                sunShine.classList.remove('hidden');
                sunShine.style.opacity = '0.2';
                sunShine.style.transform = 'scale(1)';
            }
            clouds.forEach(cloud => {
                cloud.classList.remove('hidden', 'dark', 'storm');
                cloud.style.opacity = '0.9';
                cloud.style.transform = 'scale(1)';
            });
            
            // Nascondi nuvole pioggia forte/temporale
            if (heavyRainMain) heavyRainMain.classList.add('hidden');
            if (stormLateralLeft) stormLateralLeft.classList.add('hidden');
            if (stormLateralRight) stormLateralRight.classList.add('hidden');
            
            if (this.rainContainer) {
                this.rainContainer.classList.add('hidden');
                this.rainContainer.classList.remove('heavy', 'fast');
            }
            if (lightning) {
                lightning.classList.add('hidden');
                lightning.classList.remove('active', 'flash');
            }
            if (snowContainer) snowContainer.classList.add('hidden');
        }
    }
    
    setRainAnimation(type) {
        if (!this.rainContainer) return;
        
        // Always hide first to prevent real-time modifications
        this.rainContainer.classList.add('hidden');
        this.rainContainer.classList.remove('heavy', 'fast');
        
        // Force reflow
        void this.rainContainer.offsetHeight;
        
        // Show with new animation immediately
        setTimeout(() => {
            if (type === 'heavy') {
                this.rainContainer.classList.add('heavy');
            } else if (type === 'fast') {
                this.rainContainer.classList.add('fast');
            }
            this.rainContainer.classList.remove('hidden');
        }, 10);
    }
    
    formatDate(date) {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
        return `${months[date.getMonth()]} ${date.getDate()}`;
    }
    
    formatDateDDMMYYYY(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }
    
    startClock() {
        // Ferma l'intervallo precedente se esiste
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
        }
        
        const updateTime = () => {
            const timezone = this.currentTimezone || 'Europe/Rome';
            const now = new Date();
            
            try {
                const timeString = now.toLocaleTimeString('it-IT', {
                    timeZone: timezone,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
                
                const weatherTimeSpan = this.card.querySelector('.weather-time');
                if (weatherTimeSpan) {
                    weatherTimeSpan.textContent = timeString;
                }
                this.updateSunCountdownDisplay();
            } catch (error) {
                // Fallback a orario locale
                const timeString = now.toLocaleTimeString('it-IT', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
                const weatherTimeSpan = this.card.querySelector('.weather-time');
                if (weatherTimeSpan) {
                    weatherTimeSpan.textContent = timeString;
                }
                this.updateSunCountdownDisplay();
            }
        };
        
        // Aggiorna immediatamente
        updateTime();
        // Aggiorna ogni secondo e salva l'intervallo
        this.clockInterval = setInterval(updateTime, 1000);
    }

    updateSunCountdownDisplay() {
        const sunriseSpan = this.card.querySelector('.weather-sunrise-countdown');
        if (sunriseSpan && this.nextSunriseTs != null) {
            sunriseSpan.textContent = this.formatCountdownFromNow(this.nextSunriseTs);
        }

        const sunsetSpan = this.card.querySelector('.weather-sunset-countdown');
        if (sunsetSpan && this.nextSunsetTs != null) {
            sunsetSpan.textContent = this.formatCountdownFromNow(this.nextSunsetTs);
        }
    }
    
    showError(message) {
        const locationSpan = this.card.querySelector('.card-header span:first-child');
        if (locationSpan) {
            locationSpan.textContent = message;
        }

        this.hasLoadedWeatherData = false;
        this.updateRetryButtonVisibility();
    }
}

// Inizializza la weather card quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    const weatherCards = document.querySelectorAll('.weather-card-wrapper');
    weatherCards.forEach(card => new WeatherCard(card));
});
