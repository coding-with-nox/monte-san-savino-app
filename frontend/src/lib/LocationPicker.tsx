import React, { useEffect, useMemo, useRef, useState } from "react";
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
const MAP_ZOOM_ON_PICK = 15;

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | undefined>;
};

function formatCity(properties: Record<string, string | undefined>) {
  return properties.city
    || properties.locality
    || properties.county
    || properties.state
    || properties.name
    || "";
}

function formatAddress(properties: Record<string, string | undefined>) {
  const street = properties.street || properties.name || "";
  const houseNumber = properties.housenumber || "";
  return [street, houseNumber].filter(Boolean).join(" ").trim();
}

function FlyToPosition({ position }: { position: LatLngExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, MAP_ZOOM_ON_PICK, { duration: 1 });
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
  const [isLoading, setIsLoading] = useState(false);
  const queryKey = useMemo(() => `${city.trim().toLowerCase()}|${address.trim().toLowerCase()}`, [city, address]);
  const lastGeocodedKey = useRef("");
  const isAddressDisabled = !city.trim();

  async function geocodeQuery(query: string) {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`);
    const data = await res.json();
    const feature: PhotonFeature | undefined = data.features?.[0];
    const coords = feature?.geometry?.coordinates;
    if (!coords || coords.length < 2) {
      return null;
    }
    return [coords[1], coords[0]] as [number, number];
  }

  useEffect(() => {
    if (!city.trim()) {
      setMarkerPos(null);
      lastGeocodedKey.current = "";
      return;
    }
    if (queryKey === lastGeocodedKey.current) {
      return;
    }

    const timeout = setTimeout(async () => {
      const query = address.trim() ? `${address}, ${city}` : city;
      setIsLoading(true);
      try {
        const coords = await geocodeQuery(query);
        if (coords) {
          setMarkerPos(coords);
          lastGeocodedKey.current = queryKey;
        }
      } catch {
        // Geocoding failed: user can still click on the map or type manually.
      } finally {
        setIsLoading(false);
      }
    }, 450);

    return () => clearTimeout(timeout);
  }, [address, city, queryKey]);

  async function handleMapClick(lat: number, lng: number) {
    setMarkerPos([lat, lng]);
    try {
      const res = await fetch(`https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}`);
      const data = await res.json();
      const feature: PhotonFeature | undefined = data.features?.[0];
      if (feature) {
        const properties = feature.properties || {};
        const cityName = formatCity(properties);
        const addressName = formatAddress(properties);
        onCityChange(cityName);
        onAddressChange(addressName);
      }
    } catch {
      // Reverse geocoding failed: user can still type manually.
    }
  }

  function handleCityChange(nextCity: string) {
    const cityChanged = nextCity.trim().toLowerCase() !== city.trim().toLowerCase();
    onCityChange(nextCity);
    if (cityChanged && address) {
      onAddressChange("");
    }
  }

  function handleAddressChange(nextAddress: string) {
    if (isAddressDisabled) {
      return;
    }
    onAddressChange(nextAddress);
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="caption" color="text.secondary">
        {t(language, "mapClickHint")}
      </Typography>
      {isLoading && (
        <Typography variant="caption" color="text.secondary">
          {t(language, "mapLoading")}
        </Typography>
      )}
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
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          label={t(language, "profileCity")}
          value={city}
          onChange={(e) => handleCityChange(e.target.value)}
          fullWidth
          size="small"
        />
        <TextField
          label={t(language, "profileAddress")}
          value={address}
          onChange={(e) => handleAddressChange(e.target.value)}
          fullWidth
          size="small"
          disabled={isAddressDisabled}
        />
      </Stack>
    </Stack>
  );
}
