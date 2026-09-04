import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Fonts are self-hosted rather than pulled from a CDN: the app runs entirely
// on 127.0.0.1 and must render identically with no network available.
import '@fontsource-variable/fraunces';
import '@fontsource-variable/public-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './index.css';
import './i18n/config';
import LanguageProvider from './i18n/LanguageProvider';
import ThemeProvider from './theme/ThemeProvider';
import RouterProviderWrapper from './routes';
import ToasterProvider from '@/toast/ToasterProvider';
import ToastRegion from '@/components/toast/ToastRegion';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <ToasterProvider>
          <BrowserRouter>
            <RouterProviderWrapper>
              <ToastRegion />
            </RouterProviderWrapper>
          </BrowserRouter>
        </ToasterProvider>
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>,
);
