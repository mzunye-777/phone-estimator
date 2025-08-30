require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

console.log('Starting server...'); // Debug

const penetrationRates = {
  'United States': 120,
  'United Kingdom': 110,
  'Kenya': 90, // Adjusted for Nairobi context
  'China': 115,
};

app.use(express.static('public'));

app.get('/estimate', async (req, res) => {
  console.log('Received /estimate request:', req.query); // Debug
  const { address, bounds, zoom } = req.query;
  let lat, lon, areaName, country;

  try {
    if (address) {
      console.log(`Processing address: ${address}`); // Debug
      const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&addressdetails=1&limit=1`;
      const geoRes = await axios.get(geoUrl, { headers: { 'User-Agent': 'PhoneEstimator/1.0' } });
      if (!geoRes.data.length) {
        console.error('Address not found:', address);
        return res.status(404).json({ error: 'Address not found' });
      }
      ({ lat, lon, display_name: areaName } = geoRes.data[0]);
      lat = parseFloat(lat);
      lon = parseFloat(lon);
      country = geoRes.data[0].address.country;
      console.log(`Geocoded: lat=${lat}, lon=${lon}, country=${country}`); // Debug
    } else if (bounds) {
      console.log(`Processing bounds: ${bounds}`); // Debug
      const [lat1, lon1, lat2, lon2] = bounds.split(',').map(Number);
      lat = (lat1 + lat2) / 2;
      lon = (lon1 + lon2) / 2;
      areaName = 'Selected Area';
      const reverseGeoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
      const reverseRes = await axios.get(reverseGeoUrl, { headers: { 'User-Agent': 'PhoneEstimator/1.0' } });
      country = reverseRes.data.address?.country || 'Unknown';
      console.log(`Bounds center: lat=${lat}, lon=${lon}, country=${country}`); // Debug
    } else {
      console.error('No address or bounds provided');
      return res.status(400).json({ error: 'Address or bounds required' });
    }

    // Fetch population from REST Countries
    let population = 10000; // Fallback
    try {
      const countryRes = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(country)}?fields=population`);
      population = countryRes.data[0]?.population || 10000;
      console.log(`Fetched population from REST Countries: ${population} for ${country}`);
    } catch (e) {
      console.error('REST Countries error:', e.message);
    }

    const rate = penetrationRates[country] || 100;
    const estimatedPhones = Math.round(population * (rate / 100));
    console.log(`Population=${population}, Rate=${rate}, Estimated Phones=${estimatedPhones}`); // Debug

    let dots = [];
    const phonesPerDot = zoom && Number(zoom) > 12 ? 1 : 100;
    const dotCount = Math.min(Math.floor(estimatedPhones / phonesPerDot), 1000);
    console.log(`Generating ${dotCount} dots for ${estimatedPhones} phones, phonesPerDot=${phonesPerDot}`); // Debug
    const offset = bounds ? null : 0.05; // ~5km for visibility
    let lat1, lon1, lat2, lon2;

    if (bounds) {
      [lat1, lon1, lat2, lon2] = bounds.split(',').map(Number);
    } else {
      lat1 = lat - offset;
      lon1 = lon - offset;
      lat2 = lat + offset;
      lon2 = lon + offset;
    }
    console.log(`Dot area: lat1=${lat1}, lon1=${lon1}, lat2=${lat2}, lon2=${lon2}`); // Debug

    for (let i = 0; i < dotCount; i++) {
      const dotLat = lat1 + Math.random() * (lat2 - lat1);
      const dotLon = lon1 + Math.random() * (lon2 - lon1);
      dots.push({ lat: dotLat, lon: dotLon });
    }
    console.log(`Generated ${dots.length} dots`); // Debug

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
    console.error('Server error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});