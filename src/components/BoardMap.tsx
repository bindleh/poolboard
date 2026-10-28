
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type {
  CircleMarker as LeafletCircleMarker,
  Map as LeafletMap,
  LatLngBoundsExpression,
} from "leaflet";
import "leaflet/dist/leaflet.css";

import { ItemImage } from "./ui";
import type { Item } from "../types";

const API_URL = "https://api.kulturpool.at/institutions";

type Institution = {
  id: string;
  legal_name: string | null;
  location: {
    type: string;
    coordinates: number[][];
  } | null;
  provider_names?: { name: string; canonical?: boolean }[] | null;
  translations?: {
    title: string | null;
    place: string | null;
    languages_code: string;
  }[];
};

type LocatedGroup = {
  id: string;
  name: string;
  place: string;
  lat: number;
  lng: number;
  items: Item[];
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function MapBounds({ groups }: { groups: LocatedGroup[] }) {
  const map = useMap();

  useEffect(() => {
    if (groups.length === 0) return;

    if (groups.length === 1) {
      map.setView([groups[0].lat, groups[0].lng], 13);
      return;
    }

    const bounds: LatLngBoundsExpression = groups.map(
      (group) => [group.lat, group.lng] as [number, number],
    );

    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 13,
    });
  }, [groups, map]);

  return null;
}

function MapInstance({
  onReady,
}: {
  onReady: (map: LeafletMap) => void;
}) {
  const map = useMap();

  useEffect(() => {
    onReady(map);
  }, [map, onReady]);

  return null;
}

interface BoardMapProps {
  items: Item[];
  onSelect: (item: Item) => void;
}

export function BoardMap({ items, onSelect }: BoardMapProps) {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);

  const markerRefs = useRef(
    new Map<string, LeafletCircleMarker>(),
  );

  const handleMapReady = useCallback((map: LeafletMap) => {
    setMapInstance(map);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch(API_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Institutions API: ${response.status}`);
        }
        return response.json();
      })
      .then((result: { data: Institution[] }) => {
        setInstitutions(result.data ?? []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setError("Die Institutionen konnten nicht geladen werden.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const groups = useMemo<LocatedGroup[]>(() => {
    const index = new Map<string, Institution>();

    for (const institution of institutions) {
      const aliases = [
        institution.id,
        institution.legal_name ?? "",
        ...(institution.provider_names ?? []).map((p) => p.name),
        ...(institution.translations ?? []).map((t) => t.title ?? ""),
      ];

      for (const alias of aliases) {
        const key = normalize(alias);
        if (key) index.set(key, institution);
      }
    }

    const grouped = new Map<string, LocatedGroup>();

    for (const item of items) {
      if (item.removed || !item.institution) continue;

      const institution = index.get(normalize(item.institution));
      const coordinates = institution?.location?.coordinates?.[0];

      if (
        !institution ||
        !coordinates ||
        coordinates.length < 2 ||
        !Number.isFinite(coordinates[0]) ||
        !Number.isFinite(coordinates[1])
      ) {
        continue;
      }

      // GeoJSON coordinates use [longitude, latitude].
      const [lng, lat] = coordinates;

      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        continue;
      }

      const existing = grouped.get(institution.id);

      if (existing) {
        existing.items.push(item);
      } else {
        const translation =
          institution.translations?.find(
            (t) => t.languages_code === "de",
          ) ?? institution.translations?.[0];

        grouped.set(institution.id, {
          id: institution.id,
          name:
            translation?.title ??
            institution.legal_name ??
            institution.id,
          place: translation?.place ?? "",
          lat,
          lng,
          items: [item],
        });
      }
    }

    return [...grouped.values()];
  }, [items, institutions]);

  const visibleItems = useMemo(
    () => items.filter((item) => !item.removed),
    [items],
  );

  const objectCount = groups.reduce(
    (total, group) => total + group.items.length,
    0,
  );

  const handleListSelect = (item: Item) => {

    const group = groups.find((group) =>
      group.items.some((groupItem) => groupItem.id === item.id),
    );

    if (!group || !mapInstance) return;

    mapInstance.flyTo(
      [group.lat, group.lng],
      Math.max(mapInstance.getZoom(), 14),
      { duration: 0.8 },
    );

    markerRefs.current.get(group.id)?.openPopup();
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-500">
        Karte wird geladen …
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-neutral-700" role="alert">
        {error}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex h-full min-h-[350px] items-center justify-center p-6 text-center text-sm text-neutral-600">
        Für die Objekte auf diesem Board wurden keine passenden
        Institutionsstandorte gefunden.
      </div>
    );
  }

  return (
    <div className="kulturpool-map flex h-full min-h-[350px] w-full overflow-hidden">
      {/* Map */}
      <div className="relative min-w-0 flex-1">
        <MapContainer
          center={[48.2085, 16.3738]}
          zoom={7}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
            minZoom={0}
            maxZoom={20}
            attribution='&copy; <a href="https://www.stadiamaps.com/" target="_blank" rel="noopener noreferrer">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
          />

          <MapInstance onReady={handleMapReady} />
          <MapBounds groups={groups} />

          {groups.map((group) => (
            <CircleMarker
              key={group.id}
              ref={(marker) => {
                if (marker) {
                  markerRefs.current.set(group.id, marker);
                } else {
                  markerRefs.current.delete(group.id);
                }
              }}
              center={[group.lat, group.lng]}
              radius={Math.min(
                18 + Math.sqrt(group.items.length) * 2,
                33,
              )}
              pathOptions={{
                stroke: false,
                fillColor: "#5cc8f2",
                fillOpacity: 0.65,
              }}
            >
              <Popup minWidth={240} maxWidth={320}>
                <div className="space-y-3 text-ink">
                  <div className="border-b border-neutral-200 pb-2">
                    <div className="text-sm font-semibold leading-snug">
                      {group.name}
                    </div>

                    {group.place && (
                      <div className="mt-1 text-xs text-neutral-500">
                        {group.place}
                      </div>
                    )}

                    <div className="mt-2 text-xs text-neutral-500">
                      {group.items.length}{" "}
                      {group.items.length === 1 ? "Objekt" : "Objekte"}
                    </div>
                  </div>

                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelect(item)}
                        className="flex w-full items-center gap-3 rounded-lg border border-transparent p-2 text-left transition-colors hover:border-neutral-200 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-pink"
                      >
                        <ItemImage
                          item={item}
                          className="h-12 w-12 shrink-0 rounded-lg"
                        />

                        <span className="text-sm font-medium leading-snug">
                          {item.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-xs text-ink shadow-sm">
          <span className="font-semibold">{groups.length}</span>{" "}
          {groups.length === 1 ? "Standort" : "Standorte"}
          <span className="mx-2 text-neutral-300">·</span>
          <span className="font-semibold">{objectCount}</span>{" "}
          {objectCount === 1 ? "Objekt" : "Objekte"}
        </div>
      </div>

      {/* Ordered object list */}
      <aside className="flex w-64 shrink-0 flex-col border-l border-neutral-200 bg-white sm:w-80">
        <div className="border-b border-neutral-200 px-4 py-3">
          <div className="text-sm font-semibold text-ink">Objekte</div>
          <div className="mt-1 text-xs text-neutral-500">
            {visibleItems.length}{" "}
            {visibleItems.length === 1 ? "Objekt" : "Objekte"}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleItems.map((item, index) => {
            const hasLocation = groups.some((group) =>
              group.items.some(
                (groupItem) => groupItem.id === item.id,
              ),
            );

            return (
              <button
                key={item.id}
                type="button"
                disabled={!hasLocation}
                onClick={() => handleListSelect(item)}
                title={
                  hasLocation
                    ? `Standort von „${item.title}“ anzeigen`
                    : "Kein Institutionsstandort verfügbar"
                }
                className="flex w-full items-center gap-3 border-b border-neutral-100 px-3 py-3 text-left transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand-pink disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="w-5 shrink-0 text-xs tabular-nums text-neutral-400">
                  {index + 1}
                </span>

                <ItemImage
                  item={item}
                  className="h-12 w-12 shrink-0 rounded-lg"
                />

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-snug text-ink">
                    {item.title}
                  </span>

                  {!hasLocation && (
                    <span className="mt-1 block text-xs text-neutral-400">
                      Kein Standort
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
