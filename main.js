/* Initialize MapLibre + Firebase realtime updates */
maplibregl.accessToken = 'none';

/* Firebase */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

/* --- Firebase Config --- */
const firebaseConfig = {
  databaseURL: "https://yurmam-40325-default-rtdb.firebaseio.com/"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* --- Username from URL --- */
const username = new URLSearchParams(window.location.search).get("user");
if (!username) {
  alert("⚠️ Please provide a username in the URL (e.g. ?user=jlcerna)");
  throw new Error("Username missing");
}

/* --- Map setup --- */
const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      satellite: {
        type: 'raster',
        tiles: [
          `https://api.maptiler.com/maps/satellite/256/{z}/{x}/{y}.jpg?key=k0zBlTOs7WrHcJIfCohH`
        ],
        tileSize: 256,
        attribution:
          '<a href="https://www.maptiler.com/" target="_blank">© MapTiler</a> © OpenStreetMap contributors'
      }
    },
    layers: [
      {
        id: 'satellite-layer',
        type: 'raster',
        source: 'satellite',
        minzoom: 0,
        maxzoom: 22
      }
    ]
  },
  center: [125.2647, 6.9248],
  zoom: 18,
  bearing: 270, // facing west
  pitch: 0 // top-down
});

/* ✅ Add compass control only */
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

let markers = {};

/* --- Firebase Realtime Updates --- */
map.on("load", () => {
  const userRef = ref(db, `Users/${username}/Farm/Nodes`);
  onValue(userRef, (snapshot) => {
    const data = snapshot.val();
    if (data) updateMap(data);
  });
});

/* --- Update Map with markers only --- */
function updateMap(data) {
  // Remove old markers
  Object.values(markers).forEach(m => m.remove());
  markers = {};

  const coordsList = [];

  Object.entries(data).forEach(([nodeName, nodeData]) => {
    const coords = nodeData.Coordinates;
    if (!coords) return;

    coordsList.push([coords.X, coords.Y]);

    const marker = new maplibregl.Marker({ color: "red" })
      .setLngLat([coords.X, coords.Y])
      .addTo(map);

    markers[nodeName] = marker;
  });

  // Adjust zoom and bounds
  if (coordsList.length > 0) {
    let minX = Math.min(...coordsList.map(c => c[0]));
    let maxX = Math.max(...coordsList.map(c => c[0]));
    let minY = Math.min(...coordsList.map(c => c[1]));
    let maxY = Math.max(...coordsList.map(c => c[1]));

    map.resize();

    const w = map.getContainer().clientWidth || window.innerWidth;
    const h = map.getContainer().clientHeight || window.innerHeight;
    const viewRatio = w / h;

    let lngSpan = Math.max(0.00001, maxX - minX);
    let latSpan = Math.max(0.00001, maxY - minY);

    const boundsRatio = lngSpan / latSpan;

    if (boundsRatio < viewRatio) {
      const targetLngSpan = latSpan * viewRatio;
      const add = (targetLngSpan - lngSpan) / 2;
      minX -= add;
      maxX += add;
    } else if (boundsRatio > viewRatio) {
      const targetLatSpan = lngSpan / viewRatio;
      const add = (targetLatSpan - latSpan) / 2;
      minY -= add;
      maxY += add;
    }

    const adjustedBounds = new maplibregl.LngLatBounds([minX, minY], [maxX, maxY]);
    const padding = {
      top: 40,
      bottom: 40,
      left: Math.round(w * 0.12),
      right: Math.round(w * 0.12),
    };

    map.fitBounds(adjustedBounds, {
      padding,
      animate: true,
      maxZoom: 16,
      bearing: 270,
      pitch: 0,
    });
  }
}
