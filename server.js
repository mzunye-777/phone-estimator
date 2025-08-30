require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

console.log('Starting server with express:', express); // Debug dependency
console.log('Starting server with axios:', axios); // Debug dependency

const penetrationRates = {
  'United States': 120,
  'United Kingdom': 110,
  'Kenya': 90,
  'China': 115,
};

app.use(express.static('public'));

app.get('/estimate', async (req, res) => {
  console.log('Handling /estimate request:', req.query); // Debug
  const { address, bounds, zoom } = req.query;
  let lat = 0, lon = 0, areaName = 'Unknown', country = 'Unknown';

  try {
    if (address) {
      console.log(`Geocoding address: ${address}`);
      const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&addressdetails=1&limit=1`;
      const geoRes = await axios.get(geoUrl, { headers: { 'User-Agent': 'PhoneEstimator/1.0' } }).catch(err => {
        console.error('Geocoding failed:', err.message);
        return { data: [] };
      });
      if (!geoRes.data.length) {
        console.warn('Address not found, using fallback');
      } else {
        ({ lat, lon, display_name: areaName } = geoRes.data[0]);
        lat = parseFloat(lat) || 0;
        lon = parseFloat(lon) || 0;
        country = geoRes.data[0].address?.country || 'Unknown';
        console.log(`Geocoded: lat=${lat}, lon=${lon}, country=${country}`);
      }
    } else if (bounds) {
      console.log(`Processing bounds: ${bounds}`);
      const [lat1, lon1, lat2, lon2] = bounds.split(',').map(Number);
      lat = (lat1 + lat2) / 2 || 0;
      lon = (lon1 + lon2) / 2 || 0;
      areaName = 'Selected Area';
      const reverseGeoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
      const reverseRes = await axios.get(reverseGeoUrl, { headers: { 'User-Agent': 'PhoneEstimator/1.0' } }).catch(err => {
        console.error('Reverse geocoding failed:', err.message);
        return { data: { address: { country: 'Unknown' } } };
      });
      country = reverseRes.data.address?.country || 'Unknown';
      console.log(`Bounds center: lat=${lat}, lon=${lon}, country=${country}`);
    } else {
      console.error('No address or bounds provided');
      return res.status(400).json({ error: 'Address or bounds required' });
    }

    // Fetch population from REST Countries with fallback
    let population = 10000; // Default fallback
    try {
      console.log(`Fetching population for ${country}`);
      const countryRes = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(country)}?fields=population`, { timeout: 5000 });
      population = countryRes.data[0]?.population || 10000;
      console.log(`Population fetched: ${population}`);
    } catch (e) {
      console.error('REST Countries fetch failed:', e.message);
      population = 10000; // Fallback on error
    }

    const rate = penetrationRates[country] || 100;
    const estimatedPhones = Math.round(population * (rate / 100));
    console.log(`Calculated: population=${population}, rate=${rate}%, estimatedPhones=${estimatedPhones}`);

    let dots = [];
    const phonesPerDot = zoom && Number(zoom) > 12 ? 1 : 100;
    const dotCount = Math.min(Math.floor(estimatedPhones / phonesPerDot), 1000);
    console.log(`Generating ${dotCount} dots, phonesPerDot=${phonesPerDot}`);
    const offset = bounds ? null : 0.05;
    let lat1 = lat - (offset || 0), lon1 = lon - (offset || 0), lat2 = lat + (offset || 0), lon2 = lon + (offset || 0);

    for (let i = 0; i < dotCount; i++) {
      const dotLat = lat1 + Math.random() * (lat2 - lat1);
      const dotLon = lon1 + Math.random() * (lon2 - lon1);
      dots.push({ lat: dotLat, lon: dotLon });
    }
    console.log(`Generated ${dots.length} dots`);

    res.json({
      estimate: estimatedPhones,
      population,
      rate,
      lat,
      lon,
      area: areaName,
      dots,
      phonesPerDot
    });
  } catch (error) {
    console.error('Unexpected server error:', error.message, error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});