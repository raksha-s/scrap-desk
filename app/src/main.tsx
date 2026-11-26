import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/caveat/500.css';
import '@fontsource/caveat/600.css';
import '@fontsource/reenie-beanie/400.css';
// order matters: it reproduces the cascade of the prototype's single stylesheet
import './styles/base.css';
import './styles/keys.css';
import './styles/list.css';
import './styles/folder.css';
import './styles/page.css';
import './styles/sheet.css';
import './styles/dialogs.css';
import './styles/pad.css';
import './styles/generating.css';
import './styles/responsive.css';
import './styles/stickers.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
