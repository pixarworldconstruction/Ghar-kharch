import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

console.log('GharKharch: Initializing React app...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('GharKharch: Root element not found!');
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
