export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = coordinateX(polygon[i]);
    const yi = coordinateY(polygon[i]);
    const xj = coordinateX(polygon[j]);
    const yj = coordinateY(polygon[j]);
    const intersects =
      yi > coordinateY(point) !== yj > coordinateY(point) &&
      coordinateX(point) < ((xj - xi) * (coordinateY(point) - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function safeZoneBox(polygon) {
  if (polygon[0]?.x == null) {
    return { left: 35, top: 34, width: 30, height: 28 };
  }
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
}

export function distanceLabel(a, b) {
  if (a.lat != null && b.lat != null) {
    const km = haversineKm(a, b);
    return km < 0.35 ? "arrived" : `${km.toFixed(1)} km away`;
  }
  const dx = coordinateX(a) - coordinateX(b);
  const dy = coordinateY(a) - coordinateY(b);
  const km = Math.sqrt(dx * dx + dy * dy) / 9;
  return km < 0.35 ? "arrived" : `${km.toFixed(1)} km away`;
}

function coordinateX(point) {
  return point.lng ?? point.x;
}

function coordinateY(point) {
  return point.lat ?? point.y;
}

function haversineKm(a, b) {
  const earthKm = 6371;
  const latDelta = toRad(b.lat - a.lat);
  const lngDelta = toRad(b.lng - a.lng);
  const latA = toRad(a.lat);
  const latB = toRad(b.lat);
  const h =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(latA) * Math.cos(latB) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2);
  return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRad(value) {
  return (value * Math.PI) / 180;
}
