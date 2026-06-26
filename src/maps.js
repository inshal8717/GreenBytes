import { environment } from "./environment.js";

let loaderPromise;
let activeMap;
let activeInfoWindow;

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1b211f" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#d9e1dc" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#111514" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#52615c" }],
  },
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#18211f" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#22302c" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#2b3632" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#111514" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0e1718" }],
  },
];

function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const callbackName = "initAlQuaaGoogleMaps";
    window[callbackName] = () => resolve(window.google.maps);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Google Maps failed to load."));
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export async function mountGoogleMap(container, options) {
  const maps = await loadGoogleMaps();
  const { center, listings, localSpots, onListingSelect, skyOverlay } = options;

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

  listings.forEach((listing, index) => {
    new maps.Polygon({
      paths: listing.safeZone,
      strokeColor: "#80b9aa",
      strokeOpacity: 0.9,
      strokeWeight: 2,
      fillColor: "#80b9aa",
      fillOpacity: 0.18,
      map: activeMap,
    });

    const marker = new maps.Marker({
      position: listing.location,
      map: activeMap,
      label: String(index + 1),
      title: listing.title,
    });

    marker.addListener("click", () => {
      onListingSelect(listing.id);
      activeInfoWindow.setContent(`<strong>${listing.title}</strong><br>${listing.ownerName}`);
      activeInfoWindow.open({ map: activeMap, anchor: marker });
    });
  });

  localSpots.forEach((spot) => {
    const marker = new maps.Marker({
      position: spot.location,
      map: activeMap,
      label: spot.type[0],
      title: spot.name,
    });
    marker.addListener("click", () => {
      activeInfoWindow.setContent(`<strong>${spot.name}</strong><br>${spot.type} | AED ${spot.price}`);
      activeInfoWindow.open({ map: activeMap, anchor: marker });
    });
  });

  if (skyOverlay) {
    const skyBounds = {
      north: center.lat + 0.09,
      south: center.lat - 0.09,
      east: center.lng + 0.12,
      west: center.lng - 0.12,
    };
    new maps.Rectangle({
      bounds: skyBounds,
      map: activeMap,
      strokeColor: "#d7b46a",
      strokeOpacity: 0.35,
      strokeWeight: 1,
      fillColor: "#d7b46a",
      fillOpacity: 0.08,
    });
  }
}
