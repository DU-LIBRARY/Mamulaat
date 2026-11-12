import { StrictMode } from 'react';
import { MotionConfig } from 'motion/react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initPwa } from './lib/pwa';
import { initTheme } from './lib/theme';

initTheme();
initPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Motion follows the device's reduced-motion setting everywhere. */}
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </MotionConfig>
  </StrictMode>,
);
