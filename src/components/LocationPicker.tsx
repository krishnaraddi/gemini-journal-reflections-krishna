import React, { useState, useEffect } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
} from '@vis.gl/react-google-maps';
import {
  MapPin,
  Navigation,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Globe,
  Loader2,
  ExternalLink,
  Check,
} from 'lucide-react';
import { EntryLocation } from '../types';
import {
  getGoogleMapsApiKey,
  getCurrentCoordinates,
  reverseGeocodeLocation,
  searchPlacesByQuery,
  PlaceSearchResult,
} from '../services/mapsService';

interface LocationPickerProps {
  location?: EntryLocation;
  onChange: (loc: EntryLocation | undefined) => void;
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  location,
  onChange,
  addToast,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState<boolean>(false);

  const apiKey = getGoogleMapsApiKey();
  const defaultCenter = location
    ? { lat: location.lat, lng: location.lng }
    : { lat: 37.7749, lng: -122.4194 }; // Default San Francisco

  // Handle GPS detection
  const handleDetectCurrentLocation = async () => {
    setIsDetectingGps(true);
    try {
      const coords = await getCurrentCoordinates();
      setIsReverseGeocoding(true);
      const geo = await reverseGeocodeLocation(coords.lat, coords.lng);

      const newLoc: EntryLocation = {
        lat: coords.lat,
        lng: coords.lng,
        name: geo.name || `Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
        formattedAddress: geo.formattedAddress,
        placeId: geo.placeId,
        accuracy: coords.accuracy,
      };

      onChange(newLoc);
      setIsOpen(true);
      addToast('success', `Location detected: ${newLoc.name}`);
    } catch (err: any) {
      console.error('GPS error:', err);
      addToast('error', err.message || 'Unable to detect location. Please check browser permissions.');
    } finally {
      setIsDetectingGps(false);
      setIsReverseGeocoding(false);
    }
  };

  // Handle Place Search
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearching) return;

    setIsSearching(true);
    try {
      const results = await searchPlacesByQuery(searchQuery.trim());
      setSearchResults(results);
      if (results.length === 0) {
        addToast('info', 'No matching places found. Try another city or landmark name.');
      }
    } catch (err: any) {
      addToast('error', 'Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Select place from search results
  const handleSelectSearchResult = (res: PlaceSearchResult) => {
    const newLoc: EntryLocation = {
      lat: res.lat,
      lng: res.lng,
      name: res.formattedAddress.split(',')[0] || res.formattedAddress,
      formattedAddress: res.formattedAddress,
      placeId: res.placeId,
    };
    onChange(newLoc);
    setSearchResults([]);
    setSearchQuery('');
    addToast('success', `Anchored entry to ${newLoc.name}`);
  };

  // Map Click Handler
  const handleMapClick = async (e: any) => {
    const lat =
      e.detail?.latLng?.lat ??
      (typeof e.latLng?.lat === 'function' ? e.latLng.lat() : e.latLng?.lat);
    const lng =
      e.detail?.latLng?.lng ??
      (typeof e.latLng?.lng === 'function' ? e.latLng.lng() : e.latLng?.lng);

    if (typeof lat !== 'number' || typeof lng !== 'number') return;

    setIsReverseGeocoding(true);
    try {
      const geo = await reverseGeocodeLocation(lat, lng);
      const newLoc: EntryLocation = {
        lat,
        lng,
        name: geo.name,
        formattedAddress: geo.formattedAddress,
        placeId: geo.placeId,
      };
      onChange(newLoc);
      addToast('info', `Pinned to: ${newLoc.name}`);
    } catch (err) {
      onChange({
        lat,
        lng,
        name: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        formattedAddress: `Coordinates: ${lat.toFixed(5)}°, ${lng.toFixed(5)}°`,
      });
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // Clear Location
  const handleClearLocation = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
    setIsOpen(false);
    addToast('info', 'Location removed from entry.');
  };

  return (
    <div className="border border-stone-200 bg-stone-50/50 rounded-xl overflow-hidden transition">
      {/* Top Location Bar */}
      <div className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              location
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-stone-100 text-stone-500 border border-stone-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
          </div>

          <div className="min-w-0">
            {location ? (
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-stone-900 truncate">
                    {location.name || 'Pinned Location'}
                  </span>
                  <span className="text-[10px] font-mono text-stone-500 bg-stone-200/70 px-1.5 py-0.5 rounded">
                    {location.lat.toFixed(4)}°, {location.lng.toFixed(4)}°
                  </span>
                  {location.accuracy && (
                    <span className="text-[10px] text-stone-400">
                      (±{location.accuracy}m)
                    </span>
                  )}
                </div>
                {location.formattedAddress && (
                  <span className="text-[11px] text-stone-500 truncate max-w-md">
                    {location.formattedAddress}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-col">
                <span className="text-xs font-medium text-stone-700">
                  Location Context
                </span>
                <span className="text-[11px] text-stone-400">
                  Anchor this reflection to where it was written (Google Maps)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 ml-auto">
          {!location ? (
            <>
              <button
                type="button"
                onClick={handleDetectCurrentLocation}
                disabled={isDetectingGps}
                className="flex items-center gap-1.5 text-xs font-semibold bg-white hover:bg-stone-100 text-stone-800 px-3 py-1.5 rounded-lg border border-stone-200 shadow-2xs transition disabled:opacity-50"
              >
                {isDetectingGps ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                ) : (
                  <Navigation className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>{isDetectingGps ? 'Detecting GPS...' : 'Detect GPS'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg border border-stone-200 transition"
              >
                <Globe className="w-3.5 h-3.5 text-stone-500" />
                <span>{isOpen ? 'Close Map' : 'Select on Map'}</span>
                {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1 text-xs font-semibold bg-white hover:bg-stone-100 text-stone-800 px-3 py-1.5 rounded-lg border border-stone-200 shadow-2xs transition"
              >
                <Globe className="w-3.5 h-3.5 text-amber-600" />
                <span>{isOpen ? 'Hide Map' : 'View on Map'}</span>
                {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <button
                type="button"
                onClick={handleClearLocation}
                className="text-stone-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                title="Remove location"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expandable Interactive Map & Search Drawer */}
      {isOpen && (
        <div className="border-t border-stone-200 bg-white p-4 space-y-3 animate-fadeIn">
          {/* Search & GPS Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search a landmark, street, or city (e.g., Central Park, Kyoto)..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-stone-800 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white px-3 py-1.5 rounded-lg transition disabled:opacity-50 shrink-0"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>

            <button
              type="button"
              onClick={handleDetectCurrentLocation}
              disabled={isDetectingGps}
              className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 transition shrink-0"
            >
              {isDetectingGps ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Navigation className="w-3.5 h-3.5" />
              )}
              <span>Current GPS</span>
            </button>
          </div>

          {/* Search Results List */}
          {searchResults.length > 0 && (
            <div className="border border-stone-200 rounded-lg bg-stone-50 p-2 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-1">
                Matching Places
              </span>
              {searchResults.map((res, i) => (
                <button
                  key={`${res.placeId || i}`}
                  type="button"
                  onClick={() => handleSelectSearchResult(res)}
                  className="w-full text-left p-2 rounded-md hover:bg-white hover:shadow-2xs text-xs text-stone-800 flex items-start gap-2 transition"
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <span className="truncate">{res.formattedAddress}</span>
                </button>
              ))}
            </div>
          )}

          {/* Interactive Google Map Preview */}
          <div className="relative rounded-xl overflow-hidden border border-stone-200">
            {apiKey ? (
              <div className="w-full h-64 sm:h-72">
                <APIProvider
                  apiKey={apiKey}
                  solutionChannel="GMP_mcp_codeassist_v1_aistudio"
                >
                  <Map
                    id="entry-location-map"
                    mapId="DEMO_MAP_ID"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    defaultCenter={defaultCenter}
                    center={location ? { lat: location.lat, lng: location.lng } : undefined}
                    defaultZoom={location ? 14 : 11}
                    style={{ width: '100%', height: '100%' }}
                    onClick={handleMapClick}
                    gestureHandling="greedy"
                    disableDefaultUI={false}
                  >
                    {location && (
                      <AdvancedMarker position={{ lat: location.lat, lng: location.lng }}>
                        <Pin
                          background="#d97706"
                          glyphColor="#ffffff"
                          borderColor="#b45309"
                        />
                      </AdvancedMarker>
                    )}
                  </Map>
                </APIProvider>
              </div>
            ) : (
              /* Fallback view when VITE_GOOGLE_MAPS_API_KEY is not yet supplied */
              <div className="w-full h-60 bg-stone-100 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-stone-800">
                    {location ? location.name : 'Interactive Map Standby'}
                  </h4>
                  <p className="text-[11px] text-stone-500 max-w-sm mx-auto mt-0.5">
                    {location
                      ? `Anchored to coordinates: ${location.lat.toFixed(5)}°, ${location.lng.toFixed(5)}°`
                      : 'Detect your location with GPS above or configure a Google Maps API Key to render interactive street maps.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 transition"
                  >
                    <span>Get Free Maps Demo Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {/* Overlay notification for map click feedback */}
            <div className="absolute bottom-2 left-2 bg-stone-900/80 backdrop-blur-xs text-white text-[10px] px-2.5 py-1 rounded-md pointer-events-none flex items-center gap-1">
              <MapPin className="w-3 h-3 text-amber-400" />
              <span>Click anywhere on the map to pin this entry</span>
              {isReverseGeocoding && <Loader2 className="w-3 h-3 animate-spin text-amber-300 ml-1" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
