import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import './stile.css';

createRoot(document.getElementById('radice')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
