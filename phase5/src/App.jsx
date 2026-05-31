import { useState } from 'react';
import Sidebar from './components/Sidebar';
import CollectorPage from './pages/CollectorPage';
import TailorPage from './pages/TailorPage';
import AnalyserPage from './pages/AnalyserPage';
import TrackerPage from './pages/TrackerPage';
import SettingsPage from './pages/SettingsPage';
import { ToastContainer } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const [page, setPage] = useState('collector');
  const [jobCount, setJobCount] = useState(0);

  return (
    <>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar currentPage={page} onNavigate={setPage} jobCount={jobCount} />
        <main
          style={{
            flex: 1,
            overflow: page === 'tracker' ? 'hidden' : 'auto',
            background: 'var(--bg)',
          }}
          className={page !== 'tracker' ? 'grid-bg' : ''}
        >
          <ErrorBoundary key={page}>
            {page === 'collector' && <CollectorPage onJobCountChange={setJobCount} />}
            {page === 'tailor'    && <TailorPage />}
            {page === 'analyser'  && <AnalyserPage />}
            {page === 'tracker'   && <TrackerPage />}
            {page === 'settings'  && <SettingsPage />}
          </ErrorBoundary>
        </main>
      </div>
      <ToastContainer />
    </>
  );
}
