let map, markers;

function initMap(lat, lon) {
  map = L.map('map').setView([lat, lon], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  markers = L.markerClusterGroup();
  map.addLayer(markers);

  // Update dots on move or zoom
  map.on('moveend zoomend', updateDots);
}

async function updateDots() {
  const bounds = map.getBounds();
  const zoom = map.getZoom();
  const boundsStr = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
  const resultDiv = document.getElementById('result');

  try {
    const res = await fetch(`/estimate?bounds=${encodeURIComponent(boundsStr)}&zoom=${zoom}`);
    if (!res.ok) {
      throw new Error(await res.text());
    }
    const data = await res.json();

    resultDiv.innerHTML = `
      <p><strong>Area:</strong> ${data.area}</p>
      <p><strong>Estimated Population:</strong> ${data.population.toLocaleString()}</p>
      <p><strong>Mobile Penetration Rate:</strong> ${data.rate}%</p>
      <p><strong>Estimated Phones:</strong> ${data.estimate.toLocaleString()}</p>
      <p><strong>Phones per Dot:</strong> ${data.phonesPerDot}</p>
      <p><em>Disclaimer: This is an estimate based on public data.</em></p>
    `;

    // Clear existing markers
    markers.clearLayers();

    // Add new dots
    data.dots.forEach(dot => {
      const marker = L.circleMarker([dot.lat, dot.lon], {
        radius: 5,
        color: 'red',
        fillColor: 'red',
        fillOpacity: 0.5
      });
      markers.addLayer(marker);
    });
  } catch (error) {
    resultDiv.innerHTML = `<p>Error: ${error.message}</p>`;
  }
}

document.getElementById('estimateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const address = document.getElementById('address').value;
  const resultDiv = document.getElementById('result');

  try {
    const res = await fetch(`/estimate?address=${encodeURIComponent(address)}`);
    if (!res.ok) {
      throw new Error(await res.text());
    }
    const data = await res.json();

    resultDiv.innerHTML = `
      <p><strong>Area:</strong> ${data.area}</p>
      <p><strong>Estimated Population:</strong> ${data.population.toLocaleString()}</p>
      <p><strong>Mobile Penetration Rate:</strong> ${data.rate}%</p>
      <p><strong>Estimated Phones:</strong> ${data.estimate.toLocaleString()}</p>
      <p><strong>Phones per Dot:</strong> ${data.phonesPerDot}</p>
      <p><em>Disclaimer: This is an estimate based on public data.</em></p>
    `;

    // Update map
    map.setView([data.lat, data.lon], 12);
    markers.clearLayers();
    data.dots.forEach(dot => {
      const marker = L.circleMarker([dot.lat, dot.lon], {
        radius: 5,
        color: 'red',
        fillColor: 'red',
        fillOpacity: 0.5
      });
      markers.addLayer(marker);
    });
  } catch (error) {
    resultDiv.innerHTML = `<p>Error: ${error.message}</p>`;
  }
});

// Initialize map with user’s location
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      initMap(position.coords.latitude, position.coords.longitude);
      updateDots();
    },
    () => {
      // Fallback: Default to New York
      initMap(40.7128, -74.0060);
      updateDots();
    }
  );
} else {
  // Fallback: Default to New York
  initMap(40.7128, -74.0060);
  updateDots();
}