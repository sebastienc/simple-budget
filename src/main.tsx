import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './i18n/config';
import FirebaseProvider from './firebase/FirebaseProvider';
import FirebaseAuthProvider from './firebase/FirebaseAuthProvider';
import FirebaseFirestoreProvider from './firebase/FirebaseFirestoreProvider';
import LanguageProvider from './i18n/LanguageProvider';
import ThemeProvider from './theme/ThemeProvider';
import RouterProviderWrapper from './routes';
import ToasterProvider from '@/toast/ToasterProvider';
import ToastRegion from '@/components/toast/ToastRegion';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <FirebaseProvider>
          <FirebaseAuthProvider>
            <FirebaseFirestoreProvider>
              <ToasterProvider>
                <BrowserRouter>
                  <RouterProviderWrapper>
                    <ToastRegion />
                  </RouterProviderWrapper>
                </BrowserRouter>
              </ToasterProvider>
            </FirebaseFirestoreProvider>
          </FirebaseAuthProvider>
        </FirebaseProvider>
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>,
);
