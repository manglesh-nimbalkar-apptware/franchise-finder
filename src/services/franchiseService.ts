import { FranchiseQuery, FranchiseResponse, FranchiseLocation, LocationDetails, SourceProgress, SourcedLocation, MergedLocation } from '../types';
import { compareAndMergeLocations, compareAndMergeBatchLocations } from './geminiService';

const API_URL = 'http://localhost:8000';

export const streamFranchiseDetails = (
  query: FranchiseQuery,
  onLocation: (location: SourcedLocation) => void,
  onComplete: () => void,
  onError: (error: string) => void,
  onSourceProgress?: (progress: SourceProgress) => void
): () => void => {
  console.log("Starting location streaming with query:", query);
  
  let abortController: AbortController | null = new AbortController();
  
  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(query),
    signal: abortController.signal
  };
  
  fetch(`${API_URL}/get-franchise-details-stream`, fetchOptions)
    .then(response => {
      console.log("Stream response status:", response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      function processStream() {
        reader.read().then(({ done, value }) => {
          if (done) {
            if (buffer.length > 0) {
              processBuffer(buffer);
            }
            console.log("Stream complete");
            onComplete();
            return;
          }
          
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          const messages = buffer.split('\n\n');
          buffer = messages.pop() || '';
          
          for (const message of messages) {
            if (message.trim().startsWith('data: ')) {
              try {
                const dataStr = message.trim().substring(6);
                const data = JSON.parse(dataStr);
                console.log("Received SSE data:", data);
                
                if (data.status === 'all_complete') {
                  console.log("Received all_complete signal");
                  onComplete();
                } else if (data.status && data.source && onSourceProgress) {
                  onSourceProgress({
                    source: data.source,
                    status: data.status,
                    message: data.message || '',
                    count: 0
                  });
                } else if (data.error) {
                  console.error("Received error:", data.error);
                  onError(data.error);
                } else if (data.location) {
                  const address = data.location.Address || data.location.address || '';
                  const phoneNumber = data.location.Phone || data.location.phone || '';
                  const source = data.source || data.location.Source || data.location.source || 'Unknown';
                  
                  const locationData: SourcedLocation = {
                    address: address,
                    phoneNumber: phoneNumber,
                    source: source,
                  };
                  
                  if (address && address.length > 0) {
                    console.log("Sending location to UI:", locationData);
                    onLocation(locationData);
                    
                    if (onSourceProgress && source) {
                      onSourceProgress({
                        source: source,
                        status: 'searching',
                        message: `Found a location from ${source}`,
                        count: -1
                      });
                    }
                  } else {
                    console.warn("Skipping location with empty address:", data.location);
                  }
                }
              } catch (e) {
                console.error("Error parsing SSE message:", e, message);
              }
            }
          }
          
          if (abortController) {
            processStream();
          }
        }).catch(error => {
          if (error.name !== 'AbortError') {
            console.error("Stream error:", error);
            onError(error.message);
          }
        });
      }
      
      function processBuffer(buf: string) {
        if (!buf.trim()) return;
        
        const lines = buf.split('\n');
        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            try {
              const dataStr = line.trim().substring(6);
              const data = JSON.parse(dataStr);
              
              if (data.location) {
                const locationData: SourcedLocation = {
                  address: data.location.Address || data.location.address || '',
                  phoneNumber: data.location.Phone || data.location.phone || '',
                  source: data.source || data.location.Source || data.location.source || 'Unknown',
                };
                
                onLocation(locationData);
              } else if (data.status === 'all_complete') {
                onComplete();
              }
            } catch (e) {
              // Ignore parsing errors for incomplete messages
            }
          }
        }
      }
      
      processStream();
    })
    .catch(error => {
      console.error("Connection error:", error);
      if (error.name !== 'AbortError') {
        onError(error.message);
      }
    });
  
  return () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  };
};

export const streamFranchiseDetailsWithMerging = (
  query: FranchiseQuery,
  onLocationUpdate: (locations: MergedLocation[]) => void,
  onComplete: () => void,
  onError: (error: string) => void,
  onSourceProgress?: (progress: SourceProgress) => void
): () => void => {
  console.log("Starting location streaming with AI batch merging:", query);
  
  let abortController: AbortController | null = new AbortController();
  let masterTable: MergedLocation[] = [];
  
  // Collection of locations by source to process in batches
  const locationsBySource: Record<string, SourcedLocation[]> = {};
  // Track which sources have completed
  const completedSources: Set<string> = new Set();
  
  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(query),
    signal: abortController.signal
  };

  // Process all locations from a source at once
  const processBatchFromSource = async (source: string) => {
    if (!locationsBySource[source] || locationsBySource[source].length === 0) {
      return;
    }
    
    console.log(`Processing batch of ${locationsBySource[source].length} locations from ${source}`);
    
    try {
      // Send all locations from this source to Gemini at once
      masterTable = await compareAndMergeBatchLocations(masterTable, locationsBySource[source]);
      console.log("Updated master table after batch merge:", masterTable);
      onLocationUpdate([...masterTable]);
      
      if (onSourceProgress) {
        onSourceProgress({
          source: source,
          status: 'complete',
          message: `Processed ${locationsBySource[source].length} locations from ${source}`,
          count: locationsBySource[source].length
        });
      }
      
      // Clear processed locations to free memory
      delete locationsBySource[source];
      
    } catch (error) {
      console.error(`Error in batch processing for ${source}:`, error);
      
      if (onSourceProgress) {
        onSourceProgress({
          source: source,
          status: 'error',
          message: `Error processing locations: ${error}`,
          count: locationsBySource[source].length
        });
      }
      
      // Try to handle individually as fallback
      try {
        for (const location of locationsBySource[source]) {
          masterTable = await compareAndMergeLocations(masterTable, location);
        }
        onLocationUpdate([...masterTable]);
      } catch (fallbackError) {
        console.error("Even fallback processing failed:", fallbackError);
      }
      
      // Clear processed locations
      delete locationsBySource[source];
    }
  };
  
  fetch(`${API_URL}/get-franchise-details-stream`, fetchOptions)
    .then(response => {
      console.log("Stream response status:", response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      async function processStream() {
        try {
          const { done, value } = await reader.read();
          
          if (done) {
            if (buffer.length > 0) {
              await processBuffer(buffer);
            }
            
            // Process any remaining sources
            const remainingSources = Object.keys(locationsBySource);
            for (const source of remainingSources) {
              if (!completedSources.has(source)) {
                await processBatchFromSource(source);
                completedSources.add(source);
              }
            }
            
            console.log("Stream complete");
            onComplete();
            return;
          }
          
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          const messages = buffer.split('\n\n');
          buffer = messages.pop() || '';
          
          for (const message of messages) {
            if (message.trim().startsWith('data: ')) {
              try {
                const dataStr = message.trim().substring(6);
                const data = JSON.parse(dataStr);
                console.log("Received SSE data:", data);
                
                if (data.status === 'all_complete') {
                  console.log("Received all_complete signal");
                  
                  // Process any remaining sources
                  const remainingSources = Object.keys(locationsBySource);
                  for (const source of remainingSources) {
                    if (!completedSources.has(source)) {
                      await processBatchFromSource(source);
                      completedSources.add(source);
                    }
                  }
                  
                  onComplete();
                } else if (data.status === 'complete' && data.source) {
                  // Source completed - process all its locations at once
                  if (!completedSources.has(data.source)) {
                    await processBatchFromSource(data.source);
                    completedSources.add(data.source);
                  }
                  
                  if (onSourceProgress) {
                    onSourceProgress({
                      source: data.source,
                      status: 'complete',
                      message: data.message || 'Complete',
                      count: locationsBySource[data.source]?.length || 0
                    });
                  }
                } else if (data.status && data.source && onSourceProgress) {
                  onSourceProgress({
                    source: data.source,
                    status: data.status,
                    message: data.message || '',
                    count: locationsBySource[data.source]?.length || 0
                  });
                } else if (data.error) {
                  console.error("Received error:", data.error);
                  onError(data.error);
                } else if (data.location) {
                  const address = data.location.Address || data.location.address || '';
                  const phoneNumber = data.location.Phone || data.location.phone || 'N/A';
                  const source = data.source || data.location.Source || data.location.source || 'Unknown';
                  
                  if (address && address.trim().length > 0) {
                    const newLocation: SourcedLocation = {
                      address: address,
                      phoneNumber: phoneNumber,
                      source: source,
                    };
                    
                    // Collect the location in the source batch instead of processing immediately
                    if (!locationsBySource[source]) {
                      locationsBySource[source] = [];
                    }
                    locationsBySource[source].push(newLocation);
                    
                    // Update progress without processing yet
                    if (onSourceProgress) {
                      onSourceProgress({
                        source: source,
                        status: 'searching',
                        message: `Found ${locationsBySource[source].length} locations from ${source}`,
                        count: locationsBySource[source].length
                      });
                    }
                  } else {
                    console.warn("Skipping location with empty address:", data.location);
                  }
                }
              } catch (e) {
                console.error("Error parsing SSE message:", e, message);
              }
            }
          }
          
          if (abortController) {
            processStream();
          }
        } catch (error) {
          if (error.name !== 'AbortError') {
            console.error("Stream error:", error);
            onError(error.message);
          }
        }
      }
      
      async function processBuffer(buf: string) {
        if (!buf.trim()) return;
        
        const lines = buf.split('\n');
        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            try {
              const dataStr = line.trim().substring(6);
              const data = JSON.parse(dataStr);
              
              if (data.location) {
                const source = data.source || data.location.Source || data.location.source || 'Unknown';
                const newLocation: SourcedLocation = {
                  address: data.location.Address || data.location.address || '',
                  phoneNumber: data.location.Phone || data.location.phone || 'N/A',
                  source: source,
                };
                
                if (newLocation.address && newLocation.address.trim().length > 0) {
                  if (!locationsBySource[source]) {
                    locationsBySource[source] = [];
                  }
                  locationsBySource[source].push(newLocation);
                }
              } else if (data.status === 'complete' && data.source) {
                // Process this source's batch
                if (!completedSources.has(data.source)) {
                  await processBatchFromSource(data.source);
                  completedSources.add(data.source);
                }
              } else if (data.status === 'all_complete') {
                // Process any remaining sources
                const remainingSources = Object.keys(locationsBySource);
                for (const source of remainingSources) {
                  if (!completedSources.has(source)) {
                    await processBatchFromSource(source);
                    completedSources.add(source);
                  }
                }
                onComplete();
              }
            } catch (e) {
              // Ignore parsing errors for incomplete messages
            }
          }
        }
      }
      
      processStream();
    })
    .catch(error => {
      console.error("Connection error:", error);
      if (error.name !== 'AbortError') {
        onError(error.message);
      }
    });
  
  return () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  };
};

export const fetchFranchiseDetails = async (query: FranchiseQuery): Promise<FranchiseLocation[]> => {
  try {
    const response = await fetch(`${API_URL}/get-franchise-details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch franchise details');
    }

    const data: FranchiseResponse = await response.json();

    if (data.status !== 'success' || !data.data) {
      throw new Error('No data received from the server');
    }

    return parseJsonData(data.data);
  } catch (error) {
    console.error('Error fetching franchise details:', error);
    throw error;
  }
};

const parseJsonData = (jsonData: any): FranchiseLocation[] => {
  const locations = jsonData.locations;

  if (!Array.isArray(locations)) {
    throw new Error('Expected "locations" to be an array');
  }

  return locations.map(convertToFranchiseLocation);
};

const convertToFranchiseLocation = (location: LocationDetails): FranchiseLocation => ({
  address: location.Address || 'N/A',
  phoneNumber: location.Phone || 'N/A',
  source: location.Source || 'N/A',
});
