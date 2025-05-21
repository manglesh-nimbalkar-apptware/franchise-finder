import React, { useState } from 'react';
import { useFranchise } from '../context/FranchiseContext';
import { FranchiseLocation, SourcedLocation } from '../types';
import { Clipboard, CheckCircle, Download, X, ChevronDown, ChevronUp, AlertCircle, CheckSquare } from 'lucide-react';

export const ResultsPanel: React.FC = () => {
  const { results, sourceProgress, loading, streaming, error, query, clearResults, getSourceResults } = useFranchise();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({
    'Google Maps': true,
    'Official Website': true,
  });

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const downloadCSV = () => {
    const headers = ['Address', 'Phone Number', 'Source'];
    const csvContent = [
      headers.join(','),
      ...results.map(({ address, phoneNumber, source }) => 
        `"${address.replace(/"/g, '""')}","${phoneNumber.replace(/"/g, '""')}","${source.replace(/"/g, '""')}"`
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

  const toggleSource = (source: string) => {
    setExpandedSources(prev => ({
      ...prev,
      [source]: !prev[source]
    }));
  };

  const getSourceStatus = (source: string) => {
    const progress = sourceProgress.find(p => p.source === source);
    return progress || { 
      source, 
      status: 'initializing', 
      message: 'Waiting to start...', 
      count: 0 
    };
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

  const sourcesMap = new Map<string, SourcedLocation[]>();
  results.forEach(location => {
    if (!sourcesMap.has(location.source)) {
      sourcesMap.set(location.source, []);
    }
    sourcesMap.get(location.source)!.push(location);
  });

  const standardSources = ['Google Maps', 'Official Website'];
  const availableSources = Array.from(new Set([
    ...standardSources,
    ...Array.from(sourcesMap.keys())
  ]));

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
                Searching multiple sources...
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
          {availableSources.map(source => {
            const sourceResults = getSourceResults(source);
            const status = getSourceStatus(source);
            const isExpanded = expandedSources[source] ?? true;
            
            if (sourceResults.length === 0 && status.status === 'complete' && !streaming) {
              return null;
            }
            
            return (
              <div key={source} className="border rounded-lg overflow-hidden">
                <div 
                  className="flex justify-between items-center px-4 py-3 bg-gray-50 cursor-pointer"
                  onClick={() => toggleSource(source)}
                >
                  <div className="flex items-center">
                    <h3 className="font-medium text-gray-800">{source}</h3>
                    <span className="ml-2 text-sm text-gray-500">
                      ({sourceResults.length} results)
                    </span>
                    
                    {streaming && status.status !== 'complete' && (
                      <div className="flex items-center ml-3 text-sm text-blue-600">
                        <svg className="animate-spin -ml-1 mr-2 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {status.message || 'Searching...'}
                      </div>
                    )}
                    
                    {status.status === 'complete' && (
                      <span className="ml-3 text-sm text-green-600">Complete</span>
                    )}
                    
                    {status.status === 'error' && (
                      <div className="flex items-center ml-3 text-sm text-red-600">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {status.message || 'Error occurred'}
                      </div>
                    )}
                  </div>
                  
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-500" />
                  )}
                </div>
                
                {isExpanded && (
                  <div className="overflow-x-auto">
                    {sourceResults.length > 0 ? (
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
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {sourceResults.map((location, index) => (
                            <tr key={`${source}-${index}`} className={`hover:bg-gray-50 transition-colors ${
                              index === sourceResults.length - 1 && streaming && status.status !== 'complete' 
                                ? "animate-pulse bg-blue-50" 
                                : ""
                            }`}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {location.address}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {location.phoneNumber}
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
                    ) : (
                      <div className="px-6 py-4 text-center text-sm text-gray-500">
                        {streaming && status.status !== 'complete' ? (
                          <div className="animate-pulse">{status.message || 'Searching for locations...'}</div>
                        ) : status.status === 'error' ? (
                          <div className="text-red-500">{status.message || 'Error finding locations'}</div>
                        ) : (
                          <div>No locations found</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Summary Table - Show after streaming is complete */}
          {!streaming && results.length > 0 && (
            <div className="mt-8 border-t pt-6">
              <div className="flex items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Verified Locations Summary</h3>
                <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                  Search Complete
                </span>
              </div>
              
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
                        Verified By
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {results.map((location, index) => (
                      <tr key={`summary-${index}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {location.address}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {location.phoneNumber}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <CheckSquare className="h-3 w-3 mr-1" />
                            {location.source}
                          </span>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};