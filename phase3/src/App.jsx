import { useState } from 'react';
import Sidebar from './components/Sidebar';
import CollectorPage from './pages/CollectorPage';
import TailorPage from './pages/TailorPage';
import AnalyserPage from './pages/AnalyserPage';
import SettingsPage from './pages/SettingsPage';
import { ToastContainer } from './components/Toast';

export default function App() {
  const [page, setPage] = useState('collector');
  const [jobCount, setJobCount] = useState(0);

  return (
    <>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar currentPage={page} onNavigate={setPage} jobCount={jobCount} />
        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }} className="grid-bg">
          {page === 'collector' && <CollectorPage onJobCountChange={setJobCount} />}
          {page === 'tailor'    && <TailorPage />}
          {page === 'analyser'  && <AnalyserPage />}
          {page === 'settings'  && <SettingsPage />}
        </main>
      </div>
      <ToastContainer />
    </>
  );
}
