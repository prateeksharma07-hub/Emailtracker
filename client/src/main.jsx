import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted fonts via @fontsource
import '@fontsource/bricolage-grotesque/latin-700.css';
import '@fontsource/bricolage-grotesque/latin-800.css';
import '@fontsource/instrument-sans/latin-400.css';
import '@fontsource/instrument-sans/latin-500.css';
import '@fontsource/instrument-sans/latin-600.css';
import '@fontsource/special-elite/latin-400.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';

import './index.css';
import App from './App.jsx';
import { ThemeProvider } from './design/ThemeProvider';
import { AuthProvider } from './context/AuthContext';
import GrainOverlay from './design/GrainOverlay';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <GrainOverlay />
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
