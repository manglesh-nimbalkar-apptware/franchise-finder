import { MergedLocation } from '../types';
import { formatPhoneNumber } from '../utils/phoneFormatter';

// Load Google Places library and handle script loading
const loadGooglePlacesScript = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof google !== 'undefined' && google.maps && google.maps.places) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=googlePlacesCallback`;
    script.async = true;
    script.defer = true;
    
    // Define the callback
    window.googlePlacesCallback = () => {
      resolve();
    };
    
    script.onerror = () => {
      reject(new Error('Failed to load Google Places API'));
    };
    
    document.head.appendChild(script);
  });
};

// Fetch places from Google Places API
export const fetchGooglePlaces = async (
  query: string,
  apiKey: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
): Promise<MergedLocation[]> => {
  if (!apiKey) {
    console.warn('Google Maps API key not provided');
    return [];
  }

  try {
    // Load Google Places script if needed
    await loadGooglePlacesScript(apiKey);
    
    // Load Places library
    const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
    
    const request = {
      textQuery: query,
      fields: ['displayName', 'formattedAddress', 'internationalPhoneNumber'],
      includedType: 'restaurant',
      language: 'en-US',
      maxResultCount: 10,
      minRating: 3.0,
      region: 'us',
      useStrictTypeFiltering: false,
    };

    console.log('Sending Google Places API request:', request);

    // Make the API request
    const { places } = await Place.searchByText(request);

    // const places = [
    //   {
    //     formattedAddress: '123 Main St, New York, NY 10001',
    //     internationalPhoneNumber: '+12125550123',
    //   },
    //   {
    //     formattedAddress: '456 Broadway Ave, New York, NY 10002',
    //     internationalPhoneNumber: '+12125550124',
    //   },
    //   {
    //     formattedAddress: '789 Park Road, New York, NY 10003',
    //     internationalPhoneNumber: '+12125550125',
    //   }
    // ];
    
    console.log('Google Places API response:', places);
    
    // Convert to MergedLocation format with formatted phone numbers
    const mergedLocations = places.map(place => ({
      address: place.formattedAddress || 'No address available',
      phoneNumber: formatPhoneNumber(place.internationalPhoneNumber || 'N/A'),
      sources: ['Google Places'] // Changed from 'Google Places API' to 'Google Places'
    }));
    
    console.log('Converted locations:', mergedLocations);
    
    return mergedLocations;
  } catch (error) {
    console.error('Error fetching from Google Places API:', error);
    return [];
  }
};

// Type definition for global callback
declare global {
  interface Window {
    googlePlacesCallback: () => void;
  }
}
