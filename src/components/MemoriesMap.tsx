import React, { useState, useMemo } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  MapPin,
  Calendar,
  Sparkles,
  Search,
  ExternalLink,
  BookOpen,
  Plus,
  Navigation,
  Globe,
} from 'lucide-react';
import { JournalEntry } from '../types';
import { getGoogleMapsApiKey } from '../services/mapsService';

interface MemoriesMapProps {
  entries: JournalEntry[];
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
}

// Helper child component to control camera panning with useMap()
const MapController: React.FC<{ selectedEntry: JournalEntry | null }> = ({
  selectedEntry,
}) => {
  const map = useMap('memories-world-map');

  React.useEffect(() => {
    if (!map || !selectedEntry?.location) return;
    map.panTo({
      lat: selectedEntry.location.lat,
      lng: selectedEntry.location.lng,
    });
    map.setZoom(14);
  }, [map, selectedEntry]);

  return null;
};

export const MemoriesMap: React.FC<MemoriesMapProps> = ({
  entries,
  onSelectEntry,
  onNewEntry,
}) => {
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const apiKey = getGoogleMapsApiKey();

  // Filter entries that have valid location coordinates
  const geotaggedEntries = useMemo(() => {
    return entries.filter(
      (e) =>
        e.location &&
        typeof e.location.lat === 'number' &&
        typeof e.location.lng === 'number'
    );
  }, [entries]);

  // Filter list by search query
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return geotaggedEntries;
    const q = searchQuery.toLowerCase();
    return geotaggedEntries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.location?.name && e.location.name.toLowerCase().includes(q)) ||
        (e.location?.formattedAddress && e.location.formattedAddress.toLowerCase().includes(q)) ||
        e.content.toLowerCase().includes(q)
    );
  }, [geotaggedEntries, searchQuery]);

  // Center on first entry or default
  const defaultCenter = useMemo(() => {
    if (geotaggedEntries.length > 0 && geotaggedEntries[0].location) {
      return {
        lat: geotaggedEntries[0].location.lat,
        lng: geotaggedEntries[0].location.lng,
      };
    }
    return { lat: 20, lng: 0 };
  }, [geotaggedEntries]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-140px)] min-h-[550px]">
      {/* Sidebar / List of Location-Aware Entries */}
      <div className="w-full lg:w-96 flex flex-col bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-stone-200 bg-stone-50/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-200">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-stone-900">Memories Map</h2>
                <p className="text-[11px] text-stone-500">
                  {geotaggedEntries.length} location-anchored {geotaggedEntries.length === 1 ? 'reflection' : 'reflections'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onNewEntry}
              className="flex items-center gap-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1.5 rounded-lg shadow-2xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by title, city, or landmark..."
              className="w-full bg-white border border-stone-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* List of Entries */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {geotaggedEntries.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-stone-500 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-stone-800">No Geotagged Entries Yet</h3>
                <p className="text-[11px] text-stone-400 mt-1 max-w-[220px]">
                  Write an entry and tap "Detect GPS" or "Select on Map" to start mapping your thoughts across the world.
                </p>
              </div>
              <button
                type="button"
                onClick={onNewEntry}
                className="text-xs font-semibold text-amber-700 hover:text-amber-800 bg-amber-100/70 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition"
              >
                Create Location Entry
              </button>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="p-6 text-center text-xs text-stone-400">
              No geotagged entries match your search.
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const isSelected = selectedEntry?.id === entry.id;
              return (
                <div
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className={`p-3 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300'
                      : 'bg-white hover:bg-stone-50 border-stone-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-bold text-stone-900 truncate">
                      {entry.title || 'Untitled Entry'}
                    </h3>
                    <span className="text-[10px] text-stone-400 shrink-0">
                      {new Date(entry.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-700 font-medium truncate">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {entry.location?.name || entry.location?.formattedAddress || 'Location'}
                    </span>
                  </div>

                  <p className="text-[11px] text-stone-500 mt-1 line-clamp-2">
                    {entry.content}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-100">
                    <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded capitalize">
                      {entry.mood || 'neutral'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEntry(entry);
                      }}
                      className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-0.5"
                    >
                      <span>Open</span>
                      <BookOpen className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Interactive Map View */}
      <div className="flex-1 bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden relative min-h-[350px]">
        {apiKey ? (
          <div className="w-full h-full">
            <APIProvider
              apiKey={apiKey}
              solutionChannel="GMP_mcp_codeassist_v1_aistudio"
            >
              <Map
                id="memories-world-map"
                mapId="DEMO_MAP_ID"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                defaultCenter={defaultCenter}
                defaultZoom={geotaggedEntries.length > 0 ? 5 : 2}
                style={{ width: '100%', height: '100%' }}
                gestureHandling="greedy"
                disableDefaultUI={false}
              >
                <MapController selectedEntry={selectedEntry} />

                {geotaggedEntries.map((entry) => {
                  if (!entry.location) return null;
                  const isSelected = selectedEntry?.id === entry.id;

                  return (
                    <AdvancedMarker
                      key={entry.id}
                      position={{ lat: entry.location.lat, lng: entry.location.lng }}
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <Pin
                        background={isSelected ? '#b45309' : '#d97706'}
                        glyphColor="#ffffff"
                        borderColor={isSelected ? '#78350f' : '#b45309'}
                        scale={isSelected ? 1.2 : 1.0}
                      />
                    </AdvancedMarker>
                  );
                })}

                {/* InfoWindow Popup on Marker Selection */}
                {selectedEntry && selectedEntry.location && (
                  <InfoWindow
                    position={{
                      lat: selectedEntry.location.lat,
                      lng: selectedEntry.location.lng,
                    }}
                    onCloseClick={() => setSelectedEntry(null)}
                    pixelOffset={[0, -32]}
                  >
                    <div className="p-1 max-w-xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          {selectedEntry.mode}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {new Date(selectedEntry.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-stone-900 line-clamp-1">
                        {selectedEntry.title}
                      </h4>

                      <div className="flex items-center gap-1 text-[11px] text-amber-800">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate font-medium">
                          {selectedEntry.location.name || selectedEntry.location.formattedAddress}
                        </span>
                      </div>

                      <p className="text-[11px] text-stone-600 line-clamp-3 bg-stone-50 p-1.5 rounded border border-stone-100">
                        {selectedEntry.content}
                      </p>

                      {selectedEntry.aiResponse && (
                        <div className="flex items-center gap-1 text-[10px] text-stone-500">
                          <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="truncate">Includes Gemini reflection</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => onSelectEntry(selectedEntry)}
                        className="w-full text-center text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white py-1.5 rounded-lg transition mt-1"
                      >
                        Open Full Reflection
                      </button>
                    </div>
                  </InfoWindow>
                )}
              </Map>
            </APIProvider>
          </div>
        ) : (
          /* Standby display when Google Maps Key is pending */
          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-stone-50 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-200 shadow-xs">
              <Globe className="w-8 h-8" />
            </div>
            <div className="max-w-md">
              <h3 className="text-sm font-bold text-stone-900">Google Maps Platform Key Setup</h3>
              <p className="text-xs text-stone-500 mt-1">
                To render live satellite & street maps with Advanced Markers, provide your Google Maps API key via <code className="text-stone-800 font-mono bg-stone-200/70 px-1 py-0.5 rounded text-[11px]">VITE_GOOGLE_MAPS_API_KEY</code> or get a zero-friction Maps Demo Key.
              </p>
            </div>
            <a
              href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 px-4 py-2 rounded-xl border border-amber-300 transition shadow-2xs"
            >
              <span>Get Free Google Maps Demo Key</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
