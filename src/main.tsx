import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
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
