import React, { useState, useEffect } from "react";
import { Box, Stack, TextField, Typography } from "@mui/material";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { Language, t } from "./i18n";

interface LocationPickerProps {
  city: string;
  address: string;
  onCityChange: (city: string) => void;
  onAddressChange: (address: string) => void;
  language: Language;
}

const ITALY_CENTER: LatLngExpression = [43.0, 11.8];
const DEFAULT_ZOOM = 6;

function FlyToPosition({ position }: { position: LatLngExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 15, { duration: 1 });
    }
  }, [position, map]);
  return null;
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

export default function LocationPicker({ city, address, onCityChange, onAddressChange, language }: LocationPickerProps) {
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(null);

  async function handleMapClick(lat: number, lng: number) {
    setMarkerPos([lat, lng]);
    try {
      const res = await fetch(`https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}`);
      const data = await res.json();
      const feature = data.features?.[0];
      if (feature) {
        const p = feature.properties || {};
        const cityName = p.city || p.name || "";
        const country = p.country || "";
        const street = p.street || "";
        const houseNumber = p.housenumber || "";
        onCityChange(cityName ? `${cityName}, ${country}` : "");
        onAddressChange(street ? (houseNumber ? `${street} ${houseNumber}` : street) : "");
      }
    } catch {
      // Reverse geocoding failed — user can still type manually
    }
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="caption" color="text.secondary">
        {t(language, "mapClickHint")}
      </Typography>
      <Box sx={{ height: 300, borderRadius: 1, overflow: "hidden", border: 1, borderColor: "divider" }}>
        <MapContainer center={ITALY_CENTER} zoom={DEFAULT_ZOOM} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onClick={handleMapClick} />
          <FlyToPosition position={markerPos} />
          {markerPos && <Marker position={markerPos} />}
        </MapContainer>
      </Box>
      <Stack direction="row" spacing={2}>
        <TextField
          label={t(language, "profileCity")}
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          fullWidth
          size="small"
        />
        <TextField
          label={t(language, "profileAddress")}
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          fullWidth
          size="small"
        />
      </Stack>
    </Stack>
  );
}
