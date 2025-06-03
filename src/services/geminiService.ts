import { GoogleGenerativeAI } from '@google/generative-ai';
import { MergedLocation, SourcedLocation } from '../types';
import { formatPhoneNumber } from '../utils/phoneFormatter';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

let genAI: GoogleGenerativeAI | null = null;

// Initialize Gemini only if API key is available
if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your-api-key-here') {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

export const compareAndMergeLocations = async (
  masterTable: MergedLocation[],
  newResult: SourcedLocation
): Promise<MergedLocation[]> => {
  // If Gemini is not available, use fallback logic
  if (!genAI) {
    console.log('Gemini API not configured, using fallback merge logic');
    return fallbackMerge(masterTable, newResult);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const prompt = `
You are a data comparison expert. I have a master table of franchise locations and a new location result from an agent. 
Please analyze and return a JSON response with the updated master table.

Rules:
1. If the new location is a duplicate of an existing one (same or similar address), merge them by:
   - Adding the new source to the existing location's sources array (avoid duplicates)
   - Using the more detailed/complete address
   - Using the phone number from whichever record has one (prefer non-empty phone numbers)
2. If the new location is unique, add it as a new entry
3. Consider addresses as duplicates if they refer to the same physical location (ignore minor formatting differences)
4. Always preserve all existing sources when merging and avoid duplicate sources
5. Return the complete updated table
6. Always format phone numbers as "+1 XXX-XXX-XXXX" format (US phone numbers)

Master Table:
${JSON.stringify(masterTable, null, 2)}

New Result:
${JSON.stringify(newResult, null, 2)}

Return only a JSON array with this structure:
[
  {
    "address": "complete address",
    "phoneNumber": "phone in +1 XXX-XXX-XXXX format or N/A",
    "sources": ["source1", "source2"]
  }
]
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean the response to extract JSON array
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from Gemini');
    }
    
    const parsedResponse = JSON.parse(jsonMatch[0]);
    
    // Ensure no duplicate sources in the response
    return parsedResponse.map((location: MergedLocation) => ({
      ...location,
      phoneNumber: formatPhoneNumber(location.phoneNumber),
      sources: [...new Set(location.sources)]
    }));
    
  } catch (error) {
    console.error('Error in Gemini comparison:', error);
    // Fallback to simple merge logic
    return fallbackMerge(masterTable, newResult);
  }
};

export const compareAndMergeBatchLocations = async (
  masterTable: MergedLocation[],
  newResults: SourcedLocation[]
): Promise<MergedLocation[]> => {
  // If no new results, return master table as is
  if (newResults.length === 0) {
    return masterTable;
  }

  // If Gemini is not available, use fallback logic
  if (!genAI) {
    console.log('Gemini API not configured, using fallback batch merge logic');
    return fallbackBatchMerge(masterTable, newResults);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `
You are a data comparison expert. I have a master table of franchise locations and multiple new location results from an agent. 
Please analyze and return a JSON response with the updated master table that intelligently merges all the new results.

Rules:
1. If any new location is a duplicate of an existing one (same or similar address), merge them by:
   - Adding the new source to the existing location's sources array
   - Using the more detailed/complete address
   - Using the phone number from whichever record has one (prefer non-empty phone numbers)
2. If new locations are duplicates among themselves, merge them before adding to master table
3. If a new location is unique, add it as a new entry
4. Consider addresses as duplicates if they refer to the same physical location (ignore minor formatting differences)
5. Always preserve all existing sources when merging
6. Process all new results together to avoid duplicate entries
7. Always format phone numbers as "+1 XXX-XXX-XXXX" format (US phone numbers)

Master Table:
${JSON.stringify(masterTable, null, 2)}

New Results (from same agent):
${JSON.stringify(newResults, null, 2)}

Return only a JSON object with this structure:
{
  "updatedTable": [
    {
      "address": "complete address",
      "phoneNumber": "phone in +1 XXX-XXX-XXXX format or N/A",
      "sources": ["source1", "source2"]
    }
  ],
  "summary": {
    "totalProcessed": number,
    "merged": number,
    "added": number
  }
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean the response to extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from Gemini');
    }
    
    const parsedResponse = JSON.parse(jsonMatch[0]);
    console.log('Gemini batch merge summary:', parsedResponse.summary);
    return parsedResponse.updatedTable.map((location: MergedLocation) => ({
      ...location,
      phoneNumber: formatPhoneNumber(location.phoneNumber),
      sources: [...new Set(location.sources)]
    }));
    
  } catch (error) {
    console.error('Error in Gemini batch comparison:', error);
    // Fallback to simple merge logic
    return fallbackBatchMerge(masterTable, newResults);
  }
};

// Fallback merge logic if Gemini fails
const fallbackMerge = (masterTable: MergedLocation[], newResult: SourcedLocation): MergedLocation[] => {
  const existingIndex = masterTable.findIndex(location => 
    location.address.toLowerCase().includes(newResult.address.toLowerCase()) ||
    newResult.address.toLowerCase().includes(location.address.toLowerCase())
  );
  
  if (existingIndex >= 0) {
    // Merge with existing location
    const existing = masterTable[existingIndex];
    const updatedTable = [...masterTable];
    
    updatedTable[existingIndex] = {
      address: newResult.address.length > existing.address.length ? newResult.address : existing.address,
      phoneNumber: formatPhoneNumber(newResult.phoneNumber !== 'N/A' ? newResult.phoneNumber : existing.phoneNumber),
      sources: [...existing.sources, newResult.source].filter((source, index, arr) => 
        arr.indexOf(source) === index
      )
    };
    
    return updatedTable;
  } else {
    // Add as new location
    return [
      ...masterTable,
      {
        address: newResult.address,
        phoneNumber: formatPhoneNumber(newResult.phoneNumber),
        sources: [newResult.source]
      }
    ];
  }
};

// Fallback batch merge logic if Gemini fails
const fallbackBatchMerge = (masterTable: MergedLocation[], newResults: SourcedLocation[]): MergedLocation[] => {
  let updatedTable = [...masterTable];
  
  for (const newResult of newResults) {
    const existingIndex = updatedTable.findIndex(location => 
      location.address.toLowerCase().includes(newResult.address.toLowerCase()) ||
      newResult.address.toLowerCase().includes(location.address.toLowerCase())
    );
    
    if (existingIndex >= 0) {
      // Merge with existing location
      const existing = updatedTable[existingIndex];
      updatedTable[existingIndex] = {
        address: newResult.address.length > existing.address.length ? newResult.address : existing.address,
        phoneNumber: formatPhoneNumber(newResult.phoneNumber !== 'N/A' ? newResult.phoneNumber : existing.phoneNumber),
        sources: [...existing.sources, newResult.source].filter((source, index, arr) => 
          arr.indexOf(source) === index
        )
      };
    } else {
      // Add as new location
      updatedTable.push({
        address: newResult.address,
        phoneNumber: formatPhoneNumber(newResult.phoneNumber),
        sources: [newResult.source]
      });
    }
  }
  
  return updatedTable;
};
