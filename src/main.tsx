import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// PWA install prompt handling
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __pwaInstallEvent?: BeforeInstallPromptEvent;
    __pwaInstallReady?: boolean;
  }
}

window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault();
  window.__pwaInstallEvent = e as BeforeInstallPromptEvent;
  window.__pwaInstallReady = true;
  window.dispatchEvent(new CustomEvent('pwa-install-available'));
});

window.addEventListener('appinstalled', () => {
  window.__pwaInstallEvent = undefined;
  window.__pwaInstallReady = false;
  window.dispatchEvent(new CustomEvent('pwa-install-available'));
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
