import React, { useState, useMemo } from 'react';
import { useFranchise } from '../context/FranchiseContext';
import { Clipboard, CheckCircle, Download, X, Search, CheckSquare } from 'lucide-react';

// Predefined source colors
const predefinedSourceColors = {
  'Google Maps': 'bg-blue-100 text-blue-800',
  'Official Website': 'bg-green-100 text-green-800',
  'Yelp': 'bg-red-100 text-red-800',
  'Yellow Pages': 'bg-yellow-100 text-yellow-800',
  'Default': 'bg-gray-100 text-gray-800',
};

// Collection of color pairs for random assignment
const randomColorOptions = [
  'bg-purple-100 text-purple-800',
  'bg-pink-100 text-pink-800',
  'bg-indigo-100 text-indigo-800',
  'bg-teal-100 text-teal-800',
  'bg-cyan-100 text-cyan-800',
  'bg-lime-100 text-lime-800',
  'bg-amber-100 text-amber-800',
  'bg-orange-100 text-orange-800',
  'bg-rose-100 text-rose-800',
  'bg-fuchsia-100 text-fuchsia-800',
  'bg-emerald-100 text-emerald-800',
  'bg-sky-100 text-sky-800',
];

export const ResultsPanel: React.FC = () => {
  const { results, sourceProgress, loading, streaming, error, query, clearResults } = useFranchise();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // Create a map of source names to colors, randomly assigning colors to unknown sources
  const sourceColorMap = useMemo(() => {
    const colorMap = new Map<string, string>();
    const usedRandomColors = new Set<string>();
    
    // Function to get a random color that hasn't been used yet
    const getRandomColor = () => {
      const availableColors = randomColorOptions.filter(color => !usedRandomColors.has(color));
      if (availableColors.length === 0) {
        // If all colors used, start reusing them
        return randomColorOptions[Math.floor(Math.random() * randomColorOptions.length)];
      }
      const color = availableColors[Math.floor(Math.random() * availableColors.length)];
      usedRandomColors.add(color);
      return color;
    };
    
    // Collect all unique sources from results
    const uniqueSources = new Set<string>();
    results.forEach(result => {
      result.sources.forEach(source => uniqueSources.add(source));
    });
    
    // Assign colors to each source
    uniqueSources.forEach(source => {
      if (predefinedSourceColors[source]) {
        colorMap.set(source, predefinedSourceColors[source]);
      } else {
        colorMap.set(source, getRandomColor());
      }
    });
    
    return colorMap;
  }, [results]);
  
  const getSourceColor = (source: string) => {
    return sourceColorMap.get(source) || predefinedSourceColors['Default'];
  };
  
  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const downloadCSV = () => {
    const headers = ['Address', 'Phone Number', 'Sources'];
    const csvContent = [
      headers.join(','),
      ...results.map(({ address, phoneNumber, sources }) => 
        `"${address.replace(/"/g, '""')}","${phoneNumber.replace(/"/g, '""')}","${sources.join(', ').replace(/"/g, '""')}"`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${query.franchise_name}_locations.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSearchStatusMessage = () => {
    if (!streaming) return null;
    
    const completedSources = sourceProgress.filter(s => s.status === 'complete').length;
    const totalSources = sourceProgress.length;
    
    if (completedSources === totalSources) {
      return "Search complete";
    }
    
    const activeSources = sourceProgress
      .filter(s => s.status !== 'complete' && s.status !== 'error')
      .map(s => s.source);
      
    if (activeSources.length === 0) return "Processing results...";
    
    return `Searching ${activeSources.join(', ')}...`;
  };

  if (loading && !streaming) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-3 gap-4">
              <div className="h-4 bg-gray-200 rounded col-span-1"></div>
              <div className="h-4 bg-gray-200 rounded col-span-1"></div>
              <div className="h-4 bg-gray-200 rounded col-span-1"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-l-4 border-red-500">
          <div className="flex">
            <div className="flex-shrink-0">
              <X className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (results.length === 0 && !streaming) {
    return null;
  }

  const statusMessage = getSearchStatusMessage();

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {query.franchise_name} Locations in {query.city}, {query.state}
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({results.length} results)
              </span>
            </h2>
            {streaming && (
              <div className="flex items-center mt-1 text-sm text-blue-600">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {statusMessage}
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={downloadCSV}
              className="text-blue-600 hover:text-blue-800 transition-colors flex items-center text-sm"
              disabled={results.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </button>
            <button
              onClick={clearResults}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="space-y-6">
          <div>
            <div className="flex items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Franchise Locations</h3>
              {streaming ? (
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded flex items-center">
                  <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Search in progress
                </span>
              ) : (
                <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                  Search Complete
                </span>
              )}
            </div>
            
            {results.length > 0 ? (
              <div className="overflow-x-auto shadow rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Address
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone Number
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sources
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {results.map((location, index) => (
                      <tr 
                        key={`location-${index}`} 
                        className="hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {location.address}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {location.phoneNumber}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="flex flex-wrap gap-1">
                            {location.sources.map((source, sourceIndex) => (
                              <span 
                                key={`${index}-${sourceIndex}`}
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  getSourceColor(source)
                                }`}
                              >
                                <CheckSquare className="h-3 w-3 mr-1" />
                                {source}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => copyToClipboard(`${location.address} - ${location.phoneNumber}`, index)}
                            className="text-blue-600 hover:text-blue-900 flex items-center transition-colors"
                          >
                            {copiedIndex === index ? (
                              <>
                                <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                                <span className="text-green-500">Copied</span>
                              </>
                            ) : (
                              <>
                                <Clipboard className="h-4 w-4 mr-1" />
                                Copy
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center border rounded-lg">
                <div className="animate-pulse">
                  <Search className="h-10 w-10 mx-auto text-blue-500 mb-4" />
                  <p className="text-gray-500">Searching for locations...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};