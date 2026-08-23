## IMPLEMENTATION PLAN

### 1. Add COUNTRY_MAJOR_CITIES map
Add in constructor after COUNTRY_CANONICAL_NAMES (around line 143):
```javascript
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
```

### 2. Add fetchMajorCitiesForCountry method
Add after fetchCountryCities (around line 710):
```javascript
async fetchMajorCitiesForCountry(countryCode) {
    const cities = this.COUNTRY_MAJOR_CITIES[countryCode];
    if (!cities) return [];
    
    const results = [];
    for (const cityName of cities) {
        const cacheKey = `city:${cityName}|${countryCode}`;
        if (this.requestCache.has(cacheKey)) {
            results.push(this.requestCache.get(cacheKey));
            continue;
        }
        
        const params = new URLSearchParams({
            q: `${cityName}, ${this.COUNTRY_CANONICAL_NAMES[countryCode]}`,
            limit: '1'
        });
        const geoUrl = `https://photon.komoot.io/api/?${params.toString()}`;
        
        try {
            const response = await fetch(geoUrl);
            if (!response.ok) continue;
            
            const geoJson = await response.json();
            const feature = geoJson?.features?.[0];
            if (!feature) continue;
            
            const props = feature.properties || {};
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
                this.requestCache.set(cacheKey, cityResult);
                results.push(cityResult);
            }
        } catch (error) {
            this.logDebug(`Errore geocoding ${cityName}`, error.message);
        }
    }
    
    return results;
}
```

### 3. Modify fetchSuggestions
Replace the current country detection block (lines 895-915 approximately):
```javascript
if (detectedCountry) {
    this.logDebug(`Paese rilevato: "${detectedCountry.name}" (${detectedCountry.code}) per query "${query}"`);
    
    // Fetch major cities for the country
    const majorCities = await this.fetchMajorCitiesForCountry(detectedCountry.code);
    
    // Also do standard search
    const rawResults = await this.fetchSuggestionCandidates(query);
    const uniqueResults = this.dedupeCityResults(rawResults, 250);
    
    // Combine: major cities first, then standard results (avoiding duplicates)
    const seen = new Set();
    const combinedResults = [];
    
    for (const city of majorCities) {
        const key = `${this.normalizeText(city.city)}|${this.normalizeText(city.region)}|${this.normalizeText(city.country)}`;
        if (!seen.has(key)) {
            seen.add(key);
            combinedResults.push(city);
        }
    }
    
    for (const city of uniqueResults) {
        const key = `${this.normalizeText(city.city)}|${this.normalizeText(city.region)}|${this.normalizeText(city.country)}`;
        if (!seen.has(key)) {
            seen.add(key);
            combinedResults.push(city);
        }
    }
    
    const rankedResults = this.rankResultsByQuery(query, combinedResults);
    this.logResultsPreview(`Risultati per paese "${detectedCountry.name}"`, rankedResults);
    this.showSuggestions(rankedResults, query, detectedCountry);
    return;
}
```

### 4. Modify showSuggestions
Replace the country detection case (lines 969-1000 approximately):
```javascript
if (detectedCountry) {
    // Separate country cities from other results
    const countryResults = suggestions.filter(r => 
        r.country && this.normalizeText(r.country) === this.normalizeText(detectedCountry.name)
    );
    const otherResults = suggestions.filter(r => 
        !r.country || this.normalizeText(r.country) !== this.normalizeText(detectedCountry.name)
    );
    
    // Show header + country cities
    if (countryResults.length > 0) {
        const header = document.createElement('div');
        header.className = 'suggestion-country-header';
        header.textContent = detectedCountry.name.toUpperCase();
        this.suggestionsContainer.appendChild(header);
        
        let idx = 0;
        countryResults.forEach(location => {
            this.appendSuggestionItem(location, idx++);
        });
    }
    
    // Show other results (without header)
    if (otherResults.length > 0) {
        let idx = countryResults.length;
        otherResults.forEach(location => {
            this.appendSuggestionItem(location, idx++);
        });
    }
    
    this.currentSuggestions = [...countryResults, ...otherResults];
} 
```

### 5. Update mapToCityResult to include country_code
Around line 541, add country_code to the returned object:
```javascript
return {
    ...location,
    city,
    region,
    country,
    country_code: location.address?.country_code || ''
};
```

## IMPORTANT NOTES
- Remove ALL lang parameters from Photon API calls (already done)
- Use country_name comparison for filtering (Photon returns English names without lang)
- Major cities are geocoded with cache
- Header appears ONLY above cities from the detected country
