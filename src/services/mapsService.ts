import { EntryLocation } from '../types';

export interface ReverseGeocodeResult {
  name: string;
  formattedAddress: string;
  placeId?: string;
  lat: number;
  lng: number;
  isFallback: boolean;
}

export interface PlaceSearchResult {
  formattedAddress: string;
  lat: number;
  lng: number;
  placeId?: string;
}

/**
 * Retrieve the Google Maps API key from client-side environment.
 */
export function getGoogleMapsApiKey(): string {
  return ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string) || '';
}

/**
 * Request high-accuracy GPS coordinates from the browser's Geolocation API.
 */
export function getCurrentCoordinates(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
      },
      (err) => {
        let msg = 'Failed to retrieve current location.';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            msg = 'Location permission was denied. Please allow location access in your browser.';
            break;
          case err.POSITION_UNAVAILABLE:
            msg = 'Location information is unavailable.';
            break;
          case err.TIMEOUT:
            msg = 'Location request timed out.';
            break;
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}

/**
 * Reverse geocode latitude and longitude to a human-readable address.
 */
export async function reverseGeocodeLocation(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const response = await fetch('/api/maps/reverse-geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
  });

  if (!response.ok) {
    return {
      name: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      formattedAddress: `Coordinates: ${lat.toFixed(5)}°, ${lng.toFixed(5)}°`,
      lat,
      lng,
      isFallback: true,
    };
  }

  return response.json();
}

/**
 * Search places by address or landmark query.
 */
export async function searchPlacesByQuery(query: string): Promise<PlaceSearchResult[]> {
  try {
    const response = await fetch('/api/maps/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.results || [];
  } catch (err) {
    console.warn('Place search failed:', err);
    return [];
  }
}
