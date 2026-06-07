import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { runAutoSync } from './autoSync';
import NavBar from './components/NavBar';
import CashierPage   from './pages/CashierPage';
import ProductsPage  from './pages/ProductsPage';
import ExpensesPage  from './pages/ExpensesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import GelirlerPage  from './pages/GelirlerPage';

export default function App() {
  useEffect(() => {
    runAutoSync();
    window.addEventListener('online', runAutoSync);
    // Pull/push every minute so the two devices stay in sync while open.
    const interval = setInterval(runAutoSync, 60 * 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') runAutoSync(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', runAutoSync);
      document.removeEventListener('visibilitychange', onVisible);
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
