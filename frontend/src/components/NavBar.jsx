import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { syncAll, countUnsynced } from '../sync';

const links = [
  { to: '/cashier',   label: 'Kasa',    icon: '🛒' },
  { to: '/products',  label: 'Ürünler', icon: '📦' },
  { to: '/expenses',  label: 'Giderler',icon: '💸' },
  { to: '/analytics', label: 'Analiz',  icon: '📊' },
];

export default function NavBar() {
  const [unsynced, setUnsynced] = useState(0);
  const [status, setStatus]     = useState('idle'); // idle | syncing | ok | error
  const [message, setMessage]   = useState('');

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, 10000);
    return () => clearInterval(id);
  }, []);

  async function refreshCount() {
    setUnsynced(await countUnsynced());
  }

  async function handleSync() {
    setStatus('syncing');
    setMessage('');
    try {
      await syncAll(msg => setMessage(msg));
      setStatus('ok');
      await refreshCount();
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
      setTimeout(() => setStatus('idle'), 5000);
    }
  }

  return (
    <>
      <nav className="bg-gray-900 text-white flex h-14 shrink-0 items-center">
        <div className="flex items-center px-4 font-bold text-emerald-400 text-lg mr-auto">
          PAN POS
        </div>

        <div className="flex h-full">
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center px-5 text-xs font-medium transition-colors border-b-2 ${
                  isActive
                    ? 'text-emerald-400 border-emerald-400'
                    : 'text-gray-400 border-transparent hover:text-white'
                }`
              }
            >
              <span className="text-lg leading-none">{link.icon}</span>
              <span className="mt-0.5">{link.label}</span>
            </NavLink>
          ))}
        </div>

        {/* Sync button */}
        <div className="px-3">
          <button
            onClick={handleSync}
            disabled={status === 'syncing'}
            title={status === 'error' ? message : 'Sunucuya senkronize et'}
            className={`relative flex flex-col items-center justify-center px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              status === 'syncing' ? 'text-yellow-400' :
              status === 'ok'     ? 'text-emerald-400' :
              status === 'error'  ? 'text-red-400' :
                                    'text-gray-400 hover:text-white'
            }`}
          >
            <span className={`text-lg leading-none ${status === 'syncing' ? 'animate-spin' : ''}`}>
              {status === 'ok' ? '✅' : status === 'error' ? '⚠️' : '☁️'}
            </span>
            <span className="mt-0.5">
              {status === 'syncing' ? '...' : status === 'ok' ? 'Tamam' : 'Sync'}
            </span>
            {unsynced > 0 && status === 'idle' && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unsynced > 9 ? '9+' : unsynced}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Status bar */}
      {(status === 'syncing' || status === 'error') && message && (
        <div className={`text-xs px-4 py-1 text-center ${
          status === 'error' ? 'bg-red-900 text-red-200' : 'bg-gray-800 text-gray-300'
        }`}>
          {message}
        </div>
      )}
    </>
  );
}
