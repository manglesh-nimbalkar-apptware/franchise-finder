import { FranchiseQuery, FranchiseResponse, FranchiseLocation, LocationDetails, SourceProgress, SourcedLocation } from '../types';

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
