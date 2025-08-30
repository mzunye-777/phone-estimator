let map, markers;

function initMap(lat, lon) {
  console.log(`Initializing map at lat=${lat}, lon=${lon}`); // Debug
  map = L.map('map').setView([lat, lon], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  markers = L.layerGroup(); // Simplified for debugging
  map.addLayer(markers);
  map.on('moveend zoomend', updateDots);
}

async function updateDots() {
  const bounds = map.getBounds();
  const zoom = map.getZoom();
  const boundsStr = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
  const resultDiv = document.getElementById('result');
  console.log(`Updating dots for bounds=${boundsStr}, zoom=${zoom}`); // Debug

  try {
    const res = await fetch(`http://localhost:3000/estimate?bounds=${encodeURIComponent(boundsStr)}&zoom=${zoom}`);
    if (!res.ok) {
      throw new Error(await res.text());
    }
    const data = await res.json();
    console.log(`Received: ${data.dots.length} dots`, data.dots); // Debug

    resultDiv.innerHTML = `
      <p><strong>Area:</strong> ${data.area}</p>
      <p><strong>Estimated Population:</strong> ${data.population.toLocaleString()}</p>
      <p><strong>Mobile Penetration Rate:</strong> ${data.rate}%</p>
      <p><strong>Estimated Phones:</strong> ${data.estimate.toLocaleString()}</p>
      <p><strong>Phones per Dot:</strong> ${data.phonesPerDot}</p>
      <p><em>Disclaimer: This is an estimate based on public data.</em></p>
    `;

    markers.clearLayers();
    data.dots.forEach(dot => {
      console.log(`Adding dot: lat=${dot.lat}, lon=${dot.lon}`); // Debug
      const marker = L.circleMarker([dot.lat, dot.lon], {
        radius: 8,
        color: 'red',
        fillColor: 'red',
        fillOpacity: 0.7
      });
      markers.addLayer(marker);
    });
  } catch (error) {
    console.error('Update dots error:', error);
    resultDiv.innerHTML = `<p>Error: ${error.message}</p>`;
  }
}

document.getElementById('estimateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const address = document.getElementById('address').value;
  const resultDiv = document.getElementById('result');
  console.log(`Submitting address: ${address}`); // Debug

  try {
    const res = await fetch(`http://localhost:3000/estimate?address=${encodeURIComponent(address)}`);
    if (!res.ok) {
      throw new Error(await res.text());
    }
    const data = await res.json();
    console.log('Address response:', data); // Debug

    resultDiv.innerHTML = `
      <p><strong>Area:</strong> ${data.area}</p>
      <p><strong>Estimated Population:</strong> ${data.population.toLocaleString()}</p>
      <p><strong>Mobile Penetration Rate:</strong> ${data.rate}%</p>
      <p><strong>Estimated Phones:</strong> ${data.estimate.toLocaleString()}</p>
      <p><strong>Phones per Dot:</strong> ${data.phonesPerDot}</p>
      <p><em>Disclaimer: This is an estimate based on public data.</em></p>
    `;

    map.setView([data.lat, data.lon], 12);
    markers.clearLayers();
    data.dots.forEach(dot => {
      console.log(`Adding dot: lat=${dot.lat}, lon=${dot.lon}`); // Debug
      const marker = L.circleMarker([dot.lat, dot.lon], {
        radius: 8,
        color: 'red',
        fillColor: 'red',
        fillOpacity: 0.7
      });
      markers.addLayer(marker);
    });
  } catch (error) {
    console.error('Address fetch error:', error);
    resultDiv.innerHTML = `<p>Error: ${error.message}</p>`;
  }
});

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      console.log(`Geolocation success: lat=${position.coords.latitude}, lon=${position.coords.longitude}`); // Debug
      initMap(position.coords.latitude, position.coords.longitude);
      updateDots();
    },
    (error) => {
      console.error('Geolocation error:', error);
      initMap(-1.2921, 36.8219); // Nairobi fallback
      updateDots();
    },
    { timeout: 10000 }
  );
} else {
  console.error('Geolocation not supported');
  initMap(-1.2921, 36.8219); // Nairobi fallback
  updateDots();
}