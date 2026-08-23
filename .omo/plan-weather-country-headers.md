# Weather Search: Country Group Headers

## Context
When the user types a country name (e.g. "Italia") in the weather search bar, the suggestions panel should group all matching cities under a sticky country header. The header is non-clickable. If all results belong to a single country, no header is shown.

## Files to Modify
- `js/weather.js` — add country detection, grouping logic, and render changes
- `main.css` — add `.suggestion-country-header` style (sticky, non-clickable)

## Changes

### 1. `main.css` — add after `.suggestion-details` block (~line 1811)

```css
/* Country group header */
.suggestion-country-header {
  padding: 8px 14px;
  font-family: "Bricolage Grotesque";
  font-size: 12px;
  font-weight: 700;
  color: rgba(87, 77, 51, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid rgba(87, 77, 51, 0.15);
  background: rgba(255, 255, 255, 0.95);
  position: sticky;
  top: 0;
  z-index: 1;
  pointer-events: none;
  user-select: none;
}
```

### 2. `js/weather.js` — add new methods

#### a. `isQueryACountryName(query, results)` — NEW
Returns the matched country name string or `null`.

```javascript
isQueryACountryName(query, results) {
    const normalizedQuery = this.normalizeText(query);
    if (!normalizedQuery || !results || results.length === 0) return null;
    const match = results.find(r => this.normalizeText(r.country) === normalizedQuery);
    return match ? match.country : null;
}
```

#### b. `appendSuggestionItem(location, index)` — NEW (extract from showSuggestions)
Replaces the inline DOM building in `showSuggestions`.

```javascript
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
```

#### c. Modified `showSuggestions(suggestions, query)` — change signature, add grouping logic
- If `isQueryACountryName(query, suggestions)` returns a country AND there are multiple distinct countries → show sticky header + grouped cities
- If single country → show flat list (no header, same as before)
- If not a country match → show flat list (same as before)
- `this.currentSuggestions` always contains only clickable city objects

#### d. Modified `fetchSuggestions(query)` — pass query to showSuggestions
Change: `this.showSuggestions(rankedResults);` → `this.showSuggestions(rankedResults, query);`

### 3. No changes needed to keyboard navigation
`currentSuggestions` stays as the flat clickable array. `setActiveSuggestion` queries `.suggestion-item` elements — the header uses a different class so it's naturally skipped.

### 4. `hideSuggestions()` — no changes needed
Clears `currentSuggestions` and `innerHTML` as before.

## Edge Cases
- Query matches country but 0 cities found → panel hides (existing behavior)
- Partial country name (e.g. "Ita") → works if Photon returns full country name "Italia" in results
- Default static suggestions → not affected (they bypass fetchSuggestions)
- Mixed results (query matches country but some results are from other countries) → matched country gets header, others rendered below without header
