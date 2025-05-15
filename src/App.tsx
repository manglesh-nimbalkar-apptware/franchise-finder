import React from 'react';
import { SearchPanel } from './components/SearchPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { FranchiseProvider } from './context/FranchiseContext';
import { Layout } from './components/Layout';

function App() {
  return (
    <FranchiseProvider>
      <Layout>
        <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto px-4 py-8">
          <SearchPanel />
          <ResultsPanel />
        </div>
      </Layout>
    </FranchiseProvider>
  );
}

export default App;