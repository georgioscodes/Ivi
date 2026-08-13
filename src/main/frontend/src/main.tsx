import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted and subset by unicode-range, so a Latin-only page never downloads the Greek file.
import '@fontsource-variable/inter';

import './styles/tokens.css';
import './styles/base.css';
import { App } from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
