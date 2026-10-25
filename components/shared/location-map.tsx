"use client";

import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, MapContainer, TileLayer } from "react-leaflet";

/** OpenStreetMap view of a GPS fix with its accuracy radius (no paid map key). */
export default function LocationMap({ lat, lng, accuracy, className }: { lat: number; lng: number; accuracy?: number | null; className?: string }) {
  return (
    <MapContainer
      key={`${lat},${lng}`}
      center={[lat, lng]}
      zoom={18}
      scrollWheelZoom={false}
      className={className ?? "h-56 w-full rounded-xl"}
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      {accuracy ? <Circle center={[lat, lng]} radius={accuracy} pathOptions={{ color: "#C6A75E", fillOpacity: 0.12, weight: 1 }} /> : null}
      <CircleMarker center={[lat, lng]} radius={8} pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#1B263B", fillOpacity: 1 }} />
    </MapContainer>
  );
}
