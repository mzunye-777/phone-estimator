require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

// Hardcoded mobile penetration rates (phones per 100 people)
const penetrationRates = {
  'United States': 120,
  'United Kingdom': 110,
  'China': 115,
  // Add more countries; fallback to 100
};

// Serve static files
app.use(express.static('public'));

// API endpoint for estimation
app.get('/estimate', async (req, res) => {
  const { address, bounds, zoom } = req.query;
  let lat, lon, areaName, country;

  try {
    // Step 1: Geocode address or use bounds
    if (address) {
      const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
      const geoRes = await axios.get(geoUrl, { headers: { 'User-Agent': 'PhoneEstimator/1.0' } });
      if (!geoRes.data.length) {
        return res.status(404).json({ error: 'Address not found' });
      }
      ({ lat, lon, display_name: areaName } = geoRes.data[0]);
      country = areaName.split(',').pop().trim();
    } else if (bounds) {
      // Parse bounds (e.g., "lat1,lon1,lat2,lon2")
      const [lat1, lon1, lat2, lon2] = bounds.split(',').map(Number);
      lat = (lat1 + lat2) / 2;
      lon = (lon1 + lon2) / 2;
      areaName = 'Selected Area';
      // Approximate country by reverse geocoding center
      const reverseGeoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
      const reverseRes = await axios.get(reverseGeoUrl, { headers: { 'User-Agent': 'PhoneEstimator/1.0' } });
      country = reverseRes.data.address?.country || 'Unknown';
    } else {
      return res.status(400).json({ error: 'Address or bounds required' });
    }

    // Step 2: Fetch population (US Census example; extend for global)
    const censusKey = process.env.CENSUS_API_KEY;
    if (!censusKey) {
      return res.status(500).json({ error: 'Census API key missing' });
    }
    let population = 0;
    const censusRes = await axios.get(`https://api.census.gov/data/2023/pep/population?get=POP,NAME&for=place:*&in=state:*&key=${censusKey}`);
    const matchingPlace = censusRes.data.find(row => row[1].toLowerCase().includes(address?.toLowerCase() || areaName.toLowerCase()));
    if (matchingPlace) {
      population = parseInt(matchingPlace[0], 10);
    } else {
      // Fallback: Assume small population for demo
      population = 10000; // Replace with better logic (e.g., WorldPop API)
    }

    // Step 3: Get penetration rate
    const rate = penetrationRates[country] || 100;

    // Step 4: Calculate phones
    const estimatedPhones = Math.round(population * (rate / 100));

    // Step 5: Generate dot coordinates based on zoom
    let dots = [];
    const phonesPerDot = zoom && Number(zoom) > 12 ? 1 : 100;
    const dotCount = Math.floor(estimatedPhones / phonesPerDot);
    if (bounds) {
      const [lat1, lon1, lat2, lon2] = bounds.split(',').map(Number);
      for (let i = 0; i < dotCount; i++) {
        // Randomly place within bounds
        const dotLat = lat1 + Math.random() * (lat2 - lat1);
        const dotLon = lon1 + Math.random() * (lon2 - lon1);
        dots.push({ lat: dotLat, lon: dotLon });
      }
    } else {
      // Default small area around lat/lon
      for (let i = 0; i < dotCount; i++) {
        const offset = 0.01; // Small radius (~1km)
        const dotLat = lat + (Math.random() - 0.5) * offset;
        const dotLon = lon + (Math.random() - 0.5) * offset;
        dots.push({ lat: dotLat, lon: dotLon });
      }
    }

    res.json({
      estimate: estimatedPhones,
      population,
      rate,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      area: areaName,
      dots,
      phonesPerDot
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});