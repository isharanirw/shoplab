import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { CartProvider } from './cart/CartContext';
import { ToastProvider } from './components/Toasts';
import { defineStarElement } from './components/starElement';
import { loadClientFlags } from './testability/flags';
import { WishlistProvider } from './wishlist/WishlistContext';
import './global.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

defineStarElement();

// The flag list is read once before the first render.
void loadClientFlags().then(() => {
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter useTransitions={false}>
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <WishlistProvider>
                <App />
              </WishlistProvider>
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </StrictMode>,
  );
});
