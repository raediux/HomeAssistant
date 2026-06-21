import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/dm-sans';
import './styles/tokens.css';
import './styles/reset.css';
import './styles/shared.css';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { HouseholdProvider } from './contexts/HouseholdContext.jsx';
import App from './App.jsx';


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <HouseholdProvider>
        <App />
      </HouseholdProvider>
    </AuthProvider>
  </StrictMode>,
);
