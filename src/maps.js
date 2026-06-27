import { environment } from "./environment.js";

let loaderPromise;
let activeMap;
let activeInfoWindow;

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#101827" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#dce9ff" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#070b16" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#4e6388" }],
  },
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#101b31" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#182744" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#263a60" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#080d19" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#071225" }],
  },
];

function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const callbackName = "initAlQuaaGoogleMaps";
    window[callbackName] = () => resolve(window.google.maps);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&callback=${callbackName}&loading=async&language=${document.documentElement.lang || "en"}&region=AE`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Google Maps failed to load."));
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export async function mountGoogleMap(container, options) {
  const maps = await loadGoogleMaps();
  const { center, listings, localSpots, onListingSelect, highlightedListingId } = options;

  activeMap = new maps.Map(container, {
    center,
    zoom: 12,
    disableDefaultUI: true,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    styles: darkMapStyle,
  });

  activeInfoWindow = new maps.InfoWindow();

  const areaMarker = new maps.Marker({
    position: center,
    map: activeMap,
    label: "AQ",
    title: "Al Qua'a area",
    zIndex: 3,
  });
  areaMarker.addListener("click", () => {
    activeInfoWindow.setContent("<strong>Al Qua'a visitor hub</strong><br>Map centre: 23.603656, 54.748052");
    activeInfoWindow.open({ map: activeMap, anchor: areaMarker });
  });

  listings.forEach((listing, index) => {
    const isHighlighted = listing.id === highlightedListingId;
    const safeZone = new maps.Polygon({
      paths: listing.safeZone,
      strokeColor: isHighlighted ? "#ff4d4d" : "#78a8ff",
      strokeOpacity: 0.95,
      strokeWeight: isHighlighted ? 4 : 2,
      fillColor: isHighlighted ? "#ff4d4d" : "#78a8ff",
      fillOpacity: isHighlighted ? 0.3 : 0.18,
      map: activeMap,
      zIndex: isHighlighted ? 2 : 1,
    });
    safeZone.addListener("click", () => onListingSelect(listing.id, true));

    if (isHighlighted) {
      const bounds = new maps.LatLngBounds();
      listing.safeZone.forEach((point) => bounds.extend(point));
      activeMap.fitBounds(bounds, 70);
      maps.event.addListenerOnce(activeMap, "idle", () => {
        if (activeMap.getZoom() > 15) activeMap.setZoom(15);
      });
    }

    const marker = new maps.Marker({
      position: listing.location,
      map: activeMap,
      label: String(index + 1),
      title: listing.title,
    });

    marker.addListener("click", () => {
      activeInfoWindow.setContent(
        `<strong>${listing.title}</strong><br>${listing.businessName || listing.ownerName}<br>` +
          `${listing.duration || "Flexible duration"} · Best: ${listing.bestTime || "Ask host"}<br>` +
          `<span style="color:#78a8ff">Blue polygon: visitor safe zone</span>`,
      );
      activeInfoWindow.open({ map: activeMap, anchor: marker });
      onListingSelect(listing.id);
    });
  });

  localSpots.forEach((spot) => {
    const marker = new maps.Marker({
      position: spot.location,
      map: activeMap,
      label: spot.type === "Restaurant" ? "R" : spot.type === "Cafe" ? "C" : "B",
      title: spot.name,
    });
    marker.addListener("click", () => {
      const directions = `https://www.google.com/maps/dir/?api=1&destination=${spot.location.lat},${spot.location.lng}`;
      activeInfoWindow.setContent(
        `<strong>${spot.name}</strong><br>${spot.type} · ${spot.priceLabel}<br>${spot.description}<br>` +
          `<small>${spot.hours} · Demo pricing</small><br><a href="${directions}" target="_blank">Directions</a>`,
      );
      activeInfoWindow.open({ map: activeMap, anchor: marker });
    });
  });

}

export async function mountLocationPicker(container, options) {
  const maps = await loadGoogleMaps();
  const { center, initialLocation, onPick } = options;
  const map = new maps.Map(container, {
    center: initialLocation || center,
    zoom: 13,
    disableDefaultUI: true,
    zoomControl: true,
    styles: darkMapStyle,
  });
  const marker = new maps.Marker({
    position: initialLocation || center,
    map,
    draggable: true,
    title: "Listing location",
  });

  const update = (position) => {
    const location = { lat: position.lat(), lng: position.lng() };
    marker.setPosition(location);
    onPick(location);
  };

  map.addListener("click", (event) => update(event.latLng));
  marker.addListener("dragend", (event) => update(event.latLng));
  onPick(marker.getPosition().toJSON());
}

export async function mountSafeZonePicker(container, options) {
  const maps = await loadGoogleMaps();
  const { center, initialPoints = [], onChange } = options;
  const map = new maps.Map(container, {
    center,
    zoom: 14,
    disableDefaultUI: true,
    zoomControl: true,
    styles: darkMapStyle,
  });
  const points = initialPoints.map((point) => ({ ...point }));
  const markers = [];
  const polygon = new maps.Polygon({
    paths: points,
    map,
    strokeColor: "#78a8ff",
    strokeOpacity: 0.95,
    strokeWeight: 3,
    fillColor: "#78a8ff",
    fillOpacity: 0.22,
  });

  const redrawMarkers = () => {
    markers.splice(0).forEach((marker) => marker.setMap(null));
    points.forEach((point, index) => {
      markers.push(
        new maps.Marker({
          position: point,
          map,
          label: String(index + 1),
          title: `Boundary point ${index + 1}`,
        }),
      );
    });
  };

  map.addListener("click", (event) => {
    points.push(event.latLng.toJSON());
    polygon.setPath(points);
    redrawMarkers();
    onChange([...points]);
  });
  redrawMarkers();
  onChange([...points]);
}
