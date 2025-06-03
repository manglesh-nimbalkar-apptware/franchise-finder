import { QueryInput, QueryResponse } from '../types';

const API_URL = 'http://localhost:8080';

export const fetchLocations = async (queryInput: QueryInput): Promise<QueryResponse> => {
  try {
    const response = await fetch(`${API_URL}/get-franchise-details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryInput),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch locations:', error);
    throw error;
  }
};

export const streamLocations = (
  queryInput: QueryInput,
  onLocation: (location: any) => void,
  onComplete: () => void,
  onError: (error: string) => void
): () => void => {
  console.log("Starting location streaming with input:", queryInput);
  
  // Set up a POST request for the EventSource
  fetch(`${API_URL}/get-franchise-details-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(queryInput),
  })
  .then(response => {
    console.log("Got stream response, status:", response.status);
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    // Set up stream reading
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    function processChunk() {
      reader.read().then(({ done, value }) => {
        if (done) {
          console.log("Stream complete");
          onComplete();
          return;
        }
        
        // Decode and add to buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Process complete SSE messages
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || ''; // Keep last incomplete chunk
        
        for (const message of messages) {
          if (message.trim().startsWith('data:')) {
            try {
              const jsonStr = message.substring(message.indexOf('{')).trim();
              const data = JSON.parse(jsonStr);
              console.log("Received SSE data:", data);
              
              // Handle different message types
              if (data.status === 'complete' || data.status === 'all_complete') {
                // Will be handled at stream end
              } else if (data.error) {
                onError(data.error);
              } else if (data.location) {
                // Process location data
                console.log("Processing location:", data.location);
                const locationData = {
                  address: data.location.Address || '',
                  phoneNumber: data.location.Phone || '',
                  source: data.source || data.location.Source || 'Unknown',
                };
                onLocation(locationData);
              }
            } catch (e) {
              console.error("Error parsing SSE message:", e, message);
            }
          }
        }
        
        // Continue reading
        processChunk();
      }).catch(error => {
        console.error("Stream error:", error);
        onError(`Stream error: ${error.message}`);
      });
    }
    
    // Start processing
    processChunk();
  })
  .catch(error => {
    console.error("Connection error:", error);
    onError(`Connection error: ${error.message}`);
  });
  
  // Return a function to cancel the connection if needed
  return () => {
    console.log("Stream connection canceled by user");
  };
};