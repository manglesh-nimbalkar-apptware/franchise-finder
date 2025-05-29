import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { FranchiseQuery, FranchiseLocation, SearchHistoryItem, SourceProgress, SourcedLocation, MergedLocation } from '../types';
import { fetchFranchiseDetails, streamFranchiseDetailsWithMerging } from '../services/franchiseService';
import { fetchGooglePlaces } from '../services/googlePlacesService';
import { v4 as uuidv4 } from '../utils/uuid';

interface FranchiseContextType {
  query: FranchiseQuery;
  setQuery: React.Dispatch<React.SetStateAction<FranchiseQuery>>;
  results: MergedLocation[];
  sourceProgress: SourceProgress[];
  loading: boolean;
  streaming: boolean;
  error: string | null;
  searchHistory: SearchHistoryItem[];
  handleSearch: () => Promise<void>;
  handleStreamSearch: () => void;
  clearResults: () => void;
  loadFromHistory: (item: SearchHistoryItem) => void;
  clearHistory: () => void;
  getSourceResults: (source: string) => MergedLocation[];
}

const defaultQuery: FranchiseQuery = {
  franchise_name: '',
  country: '',
  state: '',
  city: '',
};

const FranchiseContext = createContext<FranchiseContextType | undefined>(undefined);

export const FranchiseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [query, setQuery] = useState<FranchiseQuery>(defaultQuery);
  const [results, setResults] = useState<MergedLocation[]>([]);
  const [sourceProgress, setSourceProgress] = useState<SourceProgress[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  
  // Reference to cancel streaming
  const streamCancelRef = useRef<(() => void) | null>(null);

  // Get results for a specific source
  const getSourceResults = useCallback((source: string) => {
    return results.filter(location => location.sources.includes(source));
  }, [results]);

  const handleSearch = useCallback(async () => {
    if (!query.franchise_name || !query.country || !query.state || !query.city) {
      setError('Please fill out all fields');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchFranchiseDetails(query);
      // Convert FranchiseLocation[] to MergedLocation[]
      const mergedData: MergedLocation[] = data.map(location => ({
        address: location.address,
        phoneNumber: location.phoneNumber,
        sources: [location.source || 'Default']
      }));
      setResults(mergedData);
      
      // Add to search history
      const historyItem: SearchHistoryItem = {
        ...query,
        id: uuidv4(),
        timestamp: Date.now(),
      };
      
      setSearchHistory(prev => [historyItem, ...prev.slice(0, 9)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleStreamSearch = useCallback(() => {
    if (!query.franchise_name || !query.country || !query.state || !query.city) {
      setError('Please fill out all fields');
      return;
    }

    // Cancel any existing stream
    if (streamCancelRef.current) {
      streamCancelRef.current();
      streamCancelRef.current = null;
    }

    setResults([]);
    setSourceProgress([
      { source: 'Google Places', status: 'initializing', message: 'Finding initial locations...', count: 0 },
      { source: 'Google Maps', status: 'initializing', message: 'Preparing verification...', count: 0 },
      { source: 'Official Website', status: 'initializing', message: 'Preparing verification...', count: 0 }
    ]);
    setStreaming(true);
    setError(null);
    
    // Add to search history
    const historyItem: SearchHistoryItem = {
      ...query,
      id: uuidv4(),
      timestamp: Date.now(),
    };
    
    setSearchHistory(prev => [historyItem, ...prev.slice(0, 9)]);
    
    // First fetch from Google Places API
    const placesQuery = `${query.franchise_name} in ${query.city}, ${query.state}, ${query.country}`;
    
    console.log('Initiating Google Places search for:', placesQuery);
    
    // Create a variable to store Google Places results for later use
    let googlePlacesResults: MergedLocation[] = [];
    
    fetchGooglePlaces(placesQuery)
      .then(placesResults => {
        googlePlacesResults = placesResults; // Store for backend streaming
        
        if (placesResults.length > 0) {
          console.log('Google Places returned results:', placesResults);
          setResults(placesResults);
          
          // Update Google Places source progress
          setSourceProgress(prev => {
            const updatedProgress = [...prev];
            const sourceIndex = updatedProgress.findIndex(p => p.source === 'Google Places');
            
            if (sourceIndex >= 0) {
              updatedProgress[sourceIndex] = { 
                source: 'Google Places',
                status: 'complete',
                message: `Found ${placesResults.length} locations`,
                count: placesResults.length
              };
            }
            
            return updatedProgress;
          });
        } else {
          console.log('Google Places returned no results');
          // Update progress to show no results
          setSourceProgress(prev => {
            const updatedProgress = [...prev];
            const sourceIndex = updatedProgress.findIndex(p => p.source === 'Google Places');
            
            if (sourceIndex >= 0) {
              updatedProgress[sourceIndex] = { 
                source: 'Google Places',
                status: 'complete',
                message: 'No locations found',
                count: 0
              };
            }
            
            return updatedProgress;
          });
        }
      })
      .catch(error => {
        console.error('Error fetching from Google Places:', error);
        
        // Update progress to show error
        setSourceProgress(prev => {
          const updatedProgress = [...prev];
          const sourceIndex = updatedProgress.findIndex(p => p.source === 'Google Places');
          
          if (sourceIndex >= 0) {
            updatedProgress[sourceIndex] = { 
              source: 'Google Places',
              status: 'error',
              message: error.message || 'Failed to fetch data',
              count: 0
            };
          }
          
          return updatedProgress;
        });
      })
      .finally(() => {
        // Now start the backend streaming process that will verify the Google Places results
        startBackendStreaming(query, googlePlacesResults);
      });
    
    // Function to start backend streaming
    const startBackendStreaming = (query: FranchiseQuery, initialResults: MergedLocation[]) => {
      // Update other sources to show "verifying" status
      setSourceProgress(prev => {
        return prev.map(progress => {
          if (progress.source !== 'Google Places') {
            return {
              ...progress,
              status: 'searching',
              message: `Verifying locations...`,
            };
          }
          return progress;
        });
      });

      // Start streaming with AI merging, passing the Google Places results as initial master table
      const cancelStream = streamFranchiseDetailsWithMerging(
        query,
        // Handle merged location updates
        (mergedLocations) => {
          setResults(mergedLocations);
        },
        // Handle completion
        () => {
          setStreaming(false);
          streamCancelRef.current = null;
        },
        // Handle error
        (errorMessage) => {
          setError(errorMessage);
          setStreaming(false);
          streamCancelRef.current = null;
        },
        // Handle source progress updates
        (progress) => {
          setSourceProgress(prev => {
            const updatedProgress = [...prev];
            const sourceIndex = updatedProgress.findIndex(p => p.source === progress.source);
            
            // Update the message to reflect verification rather than searching
            let updatedMessage = progress.message;
            if (progress.status === 'searching') {
              updatedMessage = progress.message.replace('Found', 'Verified').replace('Searching', 'Verifying');
            }
            
            if (sourceIndex >= 0) {
              // Update existing source progress
              const currentProgress = updatedProgress[sourceIndex];
              
              // Special case for incrementing count
              if (progress.count === -1) {
                progress.count = currentProgress.count + 1;
              }
              
              updatedProgress[sourceIndex] = { 
                ...currentProgress, 
                ...progress,
                message: updatedMessage,
                // Don't reset count if it wasn't provided
                count: progress.count >= 0 ? progress.count : currentProgress.count
              };
            } else {
              // Add new source progress
              updatedProgress.push({
                source: progress.source,
                status: progress.status,
                message: updatedMessage || '',
                count: progress.count >= 0 ? progress.count : 0
              });
            }
            
            return updatedProgress;
          });
        },
        // Pass Google Places results as initial master table
        initialResults
      );
      
      // Store the cancel function
      streamCancelRef.current = cancelStream;
    };
    
  }, [query]);

  const clearResults = useCallback(() => {
    // Cancel streaming if active
    if (streamCancelRef.current) {
      streamCancelRef.current();
      streamCancelRef.current = null;
      setStreaming(false);
    }
    
    setResults([]);
    setError(null);
  }, []);

  const loadFromHistory = useCallback((item: SearchHistoryItem) => {
    setQuery({
      franchise_name: item.franchise_name,
      country: item.country,
      state: item.state,
      city: item.city,
    });
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
  }, []);

  return (
    <FranchiseContext.Provider
      value={{
        query,
        setQuery,
        results,
        sourceProgress,
        loading,
        streaming,
        error,
        searchHistory,
        handleSearch,
        handleStreamSearch,
        clearResults,
        loadFromHistory,
        clearHistory,
        getSourceResults,
      }}
    >
      {children}
    </FranchiseContext.Provider>
  );
};

export const useFranchise = (): FranchiseContextType => {
  const context = useContext(FranchiseContext);
  if (context === undefined) {
    throw new Error('useFranchise must be used within a FranchiseProvider');
  }
  return context;
};