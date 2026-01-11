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
        
        this.init();
    }
    
    async init() {
        this.setupSearchBar();
        this.setupSuggestions();
        // Carica la città di default con la regione usando il geocoding
        await this.loadDefaultCity();
        // Avvia l'aggiornamento dell'orologio
        this.startClock();
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
            
            // Cancella il timeout precedente
            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout);
            }
            
            // Nascondi se meno di 2 caratteri
            if (query.length < 2) {
                this.hideSuggestions();
                return;
            }
            
            // Debounce: aspetta 300ms prima di cercare
            this.searchTimeout = setTimeout(() => {
                this.fetchSuggestions(query);
            }, 300);
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
    
    async fetchSuggestions(query) {
        try {
            // Usa Nominatim per le suggestions - cerca solo città/luoghi abitati
            const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1&featuretype=city`;
            const geoResponse = await fetch(geoUrl);
            const geoData = await geoResponse.json();
            
            if (geoData && geoData.length > 0) {
                // Filtra duplicati basandosi sul nome città + paese
                const seen = new Set();
                const uniqueResults = geoData.filter(location => {
                    const cityName = location.display_name.split(',')[0].toLowerCase().trim();
                    const country = location.address?.country || '';
                    const key = `${cityName}-${country.toLowerCase()}`;
                    
                    if (seen.has(key)) {
                        return false;
                    }
                    seen.add(key);
                    return true;
                }).slice(0, 5); // Limita a 5 risultati unici
                
                if (uniqueResults.length > 0) {
                    this.showSuggestions(uniqueResults);
                } else {
                    this.hideSuggestions();
                }
            } else {
                this.hideSuggestions();
            }
        } catch (error) {
            this.hideSuggestions();
        }
    }
    
    showSuggestions(suggestions) {
        if (!this.suggestionsContainer) return;
        
        // Svuota il container
        this.suggestionsContainer.innerHTML = '';
        
        suggestions.forEach((location, index) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.dataset.index = index;
            
            // Estrai nome città e dettagli
            const cityName = location.display_name.split(',')[0];
            const details = location.display_name.split(',').slice(1, 3).join(',').trim();
            
            item.innerHTML = `
                <span class="suggestion-city">${cityName}</span>
                <span class="suggestion-details">${details}</span>
            `;
            
            // Click per selezionare
            item.addEventListener('click', () => {
                this.selectSuggestion(location);
            });
            
            // Hover effect
            item.addEventListener('mouseenter', () => {
                this.setActiveSuggestion(index);
            });
            
            this.suggestionsContainer.appendChild(item);
        });
        
        // Salva i dati per la navigazione
        this.currentSuggestions = suggestions;
        this.activeIndex = -1;
        
        // Mostra il container
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
        const cityName = location.display_name.split(',')[0];
        
        // Aggiorna l'input
        if (searchBar) {
            searchBar.value = cityName;
        }
        
        // Nascondi suggestions
        this.hideSuggestions();
        
        // Carica i dati meteo
        const lat = parseFloat(location.lat);
        const lon = parseFloat(location.lon);
        const addressParts = location.display_name.split(',');
        const region = addressParts.length > 1 ? addressParts[1].trim() : '';
        const stateCode = location.address?.state_code || location.address?.ISO3166_2_lvl4 || '';
        
        this.loadWeatherData(lat, lon, cityName, region, stateCode);
    }
    
    async loadDefaultCity() {
        try {
            // Usa Nominatim per ottenere anche la regione della città di default
            const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.defaultCity)}`;
            const geoResponse = await fetch(geoUrl);
            const geoData = await geoResponse.json();
            
            if (geoData && geoData.length > 0) {
                const location = geoData[0];
                const addressParts = location.display_name.split(',');
                const region = addressParts.length > 1 ? addressParts[1].trim() : '';
                const stateCode = location.address?.state_code || location.address?.ISO3166_2_lvl4 || '';
                
                this.loadWeatherData(this.defaultLat, this.defaultLon, this.defaultCity, region, stateCode);
            } else {
                // Fallback senza regione
                this.loadWeatherData(this.defaultLat, this.defaultLon, this.defaultCity);
            }
        } catch (error) {
            // Fallback senza regione
            this.loadWeatherData(this.defaultLat, this.defaultLon, this.defaultCity);
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
        
        try {
            // Usa Nominatim per geocoding (gratuito, no API key)
            const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}`;
            const geoResponse = await fetch(geoUrl);
            const geoData = await geoResponse.json();
            
            if (geoData && geoData.length > 0) {
                const location = geoData[0];
                const lat = parseFloat(location.lat);
                const lon = parseFloat(location.lon);
                const displayName = location.display_name.split(',')[0]; // Prendi solo il nome della città
                
                // Estrai regione/stato (secondo elemento nell'indirizzo)
                const addressParts = location.display_name.split(',');
                const region = addressParts.length > 1 ? addressParts[1].trim() : '';
                const stateCode = location.address?.state_code || location.address?.ISO3166_2_lvl4 || '';
                
                this.loadWeatherData(lat, lon, displayName, region, stateCode);
            } else {
                this.showError('Città non trovata');
                alert('Guarda che la città esista davvero! - Have you tried turning it off and on again?');
            }
        } catch (error) {
            this.showError('Non ci è stato possibile stabilire una connessione - Please check your internet connection' );
        }
    }
    
    async loadWeatherData(lat, lon, cityName, region = '', stateCode = '') {
        try {
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
            
            // Poi carica i dati meteo da Meteoblue
            const apiUrl = `https://my.meteoblue.com/packages/basic-1h?apikey=3K6IU1W0fYGBSQ5n&lat=${lat}&lon=${lon}&asl=0&format=json`;
            
            const response = await fetch(apiUrl);
            const data = await response.json();
            
            // Meteoblue ha una struttura diversa: data_1h contiene arrays per ogni parametro
            if (data && data.data_1h && data.data_1h.time && data.data_1h.time.length > 0) {
                // Prendi i dati dell'ora corrente (primo elemento degli array)
                const currentTemp = data.data_1h.temperature?.[0];
                const currentWeatherCode = data.data_1h.pictocode?.[0];
                
                this.updateCard({
                    city: cityName,
                    region: region,
                    stateCode: stateCode,
                    country: '',
                    temperature: currentTemp ? Math.round(currentTemp) : '--',
                    date: this.formatDate(new Date()),
                    weatherCode: currentWeatherCode || 0,
                    timezone: timezone
                });
            } else {
                this.showError('Dati meteo non disponibili');
            }
        } catch (error) {
            this.showError('Errore caricamento dati meteo');
        }
    }
    
    updateCard(weatherData) {
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
            if (citySpan && citySpan.nextSibling) {
                cardHeader.insertBefore(regionSpan, citySpan.nextSibling);
            }
        }
        
        // Aggiorna regione con abbreviazione
        const regionText = weatherData.region ? 
            `${weatherData.region}${weatherData.stateCode ? ' (' + weatherData.stateCode + ')' : ''}` : 
            '';
        regionSpan.textContent = regionText;
        
        // Aggiorna data
        const dateSpan = this.card.querySelector('.card-header span:last-child');
        if (dateSpan) {
            dateSpan.textContent = weatherData.date;
        }
        
        // Aggiorna data nel nuovo container con timezone della città
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
        
        // Aggiorna temperatura
        const tempSpan = this.card.querySelector('.temp');
        if (tempSpan) {
            tempSpan.textContent = `${weatherData.temperature}°`;
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
            
            // Nascondi le nuvole - aggiungi classe hidden
            clouds.forEach((cloud, index) => {
                cloud.classList.add('hidden');
                cloud.style.opacity = '';
                cloud.style.transform = '';
            });
            
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
                cloud.classList.remove('hidden');
                cloud.style.opacity = '0.75';
                cloud.style.transform = 'scale(1)';
            });
            
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
                cloud.classList.remove('hidden');
                cloud.style.opacity = '1';
                cloud.style.transform = 'scale(1)';
            });
            
        } else if (weatherCode >= 5 && weatherCode <= 7) {
            // 🌧️ PIOGGIA LEGGERA (da implementare)
            weatherType = '🌧️ PIOGGIA LEGGERA (TODO)';
            
            sun.classList.add('hidden');
            sun.style.opacity = '';
            sun.style.transform = '';
            if (sunShine) {
                sunShine.classList.add('hidden');
                sunShine.style.opacity = '';
                sunShine.style.transform = '';
            }
            clouds.forEach(cloud => {
                cloud.classList.remove('hidden');
                cloud.style.opacity = '1';
                cloud.style.transform = 'scale(1)';
            });
            
        } else if (weatherCode >= 8 && weatherCode <= 9) {
            // 🌧️ PIOGGIA FORTE (da implementare)
            weatherType = '🌧️ PIOGGIA FORTE (TODO)';
            
            sun.classList.add('hidden');
            sun.style.opacity = '';
            sun.style.transform = '';
            if (sunShine) {
                sunShine.classList.add('hidden');
                sunShine.style.opacity = '';
                sunShine.style.transform = '';
            }
            clouds.forEach(cloud => {
                cloud.classList.remove('hidden');
                cloud.style.opacity = '1';
                cloud.style.transform = 'scale(1)';
            });
            
        } else if (weatherCode >= 10 && weatherCode <= 15) {
            // ⛈️ TEMPORALE (da implementare)
            weatherType = '⛈️ TEMPORALE (TODO)';
            
            sun.classList.add('hidden');
            sun.style.opacity = '';
            sun.style.transform = '';
            if (sunShine) {
                sunShine.classList.add('hidden');
                sunShine.style.opacity = '';
                sunShine.style.transform = '';
            }
            clouds.forEach(cloud => {
                cloud.classList.remove('hidden');
                cloud.style.opacity = '1';
                cloud.style.transform = 'scale(1)';
            });
            
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
                cloud.classList.remove('hidden');
                cloud.style.opacity = '0.9';
                cloud.style.transform = 'scale(1)';
            });
        }
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
            }
        };
        
        // Aggiorna immediatamente
        updateTime();
        // Aggiorna ogni secondo e salva l'intervallo
        this.clockInterval = setInterval(updateTime, 1000);
    }
    
    showError(message) {
        const locationSpan = this.card.querySelector('.card-header span:first-child');
        if (locationSpan) {
            locationSpan.textContent = message;
        }
    }
}

// Inizializza la weather card quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    const weatherCards = document.querySelectorAll('.weather-card-wrapper');
    weatherCards.forEach(card => new WeatherCard(card));
});
