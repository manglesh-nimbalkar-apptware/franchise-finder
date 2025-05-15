import React from 'react';
import { Search, History, X } from 'lucide-react';
import { useFranchise } from '../context/FranchiseContext';
import { SearchHistoryItem } from '../types';

export const SearchPanel: React.FC = () => {
  const { 
    query, 
    setQuery, 
    handleStreamSearch, 
    loading,
    streaming,
    searchHistory,
    loadFromHistory,
    clearHistory
  } = useFranchise();
  
  const [showHistory, setShowHistory] = React.useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setQuery(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleStreamSearch();
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">Find Franchise Locations</h2>
          {searchHistory.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-blue-500 hover:text-blue-700 flex items-center text-sm font-medium transition-colors"
            >
              <History className="h-4 w-4 mr-1" />
              {showHistory ? 'Hide History' : 'Show History'}
            </button>
          )}
        </div>
        
        {showHistory && searchHistory.length > 0 && (
          <div className="mb-6 bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium text-gray-700">Recent Searches</h3>
              <button 
                onClick={clearHistory}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Clear All
              </button>
            </div>
            <ul className="space-y-2">
              {searchHistory.map((item: SearchHistoryItem) => (
                <li key={item.id} className="text-sm bg-white p-3 rounded border border-gray-200 hover:border-blue-200 transition-colors">
                  <button 
                    onClick={() => {
                      loadFromHistory(item);
                      setShowHistory(false);
                    }}
                    className="w-full text-left"
                  >
                    <div className="font-medium">{item.franchise_name}</div>
                    <div className="text-gray-600">{item.city}, {item.state}, {item.country}</div>
                    <div className="text-xs text-gray-400 mt-1">{formatDate(item.timestamp)}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="franchise_name" className="block text-sm font-medium text-gray-700 mb-1">
                Franchise Name
              </label>
              <input
                type="text"
                id="franchise_name"
                name="franchise_name"
                value={query.franchise_name}
                onChange={handleChange}
                placeholder="e.g. McDonald's"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              />
            </div>
            
            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                Country
              </label>
              <input
                type="text"
                id="country"
                name="country"
                value={query.country}
                onChange={handleChange}
                placeholder="e.g. USA"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              />
            </div>
            
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <input
                type="text"
                id="state"
                name="state"
                value={query.state}
                onChange={handleChange}
                placeholder="e.g. California"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              />
            </div>
            
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                type="text"
                id="city"
                name="city"
                value={query.city}
                onChange={handleChange}
                placeholder="e.g. Los Angeles"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              />
            </div>
          </div>
          
          <div>
            <button
              type="submit"
              disabled={loading || streaming}
              className={`w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                (loading || streaming) ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {streaming ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Streaming Results...
                </>
              ) : loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search Locations
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};