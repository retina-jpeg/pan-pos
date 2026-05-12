import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { seedDefaultData } from './db';
import { pullFromBackend } from './sync';
import { runAutoSync } from './autoSync';
import NavBar from './components/NavBar';
import CashierPage   from './pages/CashierPage';
import ProductsPage  from './pages/ProductsPage';
import ExpensesPage  from './pages/ExpensesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import GelirlerPage  from './pages/GelirlerPage';

export default function App() {
  useEffect(() => {
    pullFromBackend().then(() => seedDefaultData()).then(() => runAutoSync());
    window.addEventListener('online', runAutoSync);
    const interval = setInterval(runAutoSync, 5 * 60 * 1000);
    return () => {
      window.removeEventListener('online', runAutoSync);
      clearInterval(interval);
    };
  }, []);

  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen bg-gray-100">
        <NavBar />
        <div className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/"          element={<Navigate to="/cashier" replace />} />
            <Route path="/cashier"   element={<CashierPage />} />
            <Route path="/products"  element={<div className="h-full overflow-y-auto"><ProductsPage /></div>} />
            <Route path="/gelirler"  element={<div className="h-full overflow-y-auto"><GelirlerPage /></div>} />
            <Route path="/expenses"  element={<div className="h-full overflow-y-auto"><ExpensesPage /></div>} />
            <Route path="/analytics" element={<div className="h-full overflow-y-auto"><AnalyticsPage /></div>} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
