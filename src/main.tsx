import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);

// Network-only worker enables installation without retaining stale game builds.
if('serviceWorker' in navigator&&window.isSecureContext){window.addEventListener('load',()=>{void navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{});});}
