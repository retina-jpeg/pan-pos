import { NavLink } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useSyncStore } from '../syncStore';

const links = [
  { to: '/cashier',   label: 'Kasse',    icon: '🛒' },
  { to: '/products',  label: 'Produkte', icon: '📦' },
  { to: '/gelirler',  label: 'Einnahmen',icon: '💰' },
  { to: '/expenses',  label: 'Ausgaben', icon: '💸' },
  { to: '/analytics', label: 'Analyse',  icon: '📊' },
];

const DOT = {
  idle:    'bg-gray-500',
  syncing: 'bg-yellow-400 animate-pulse',
  synced:  'bg-emerald-400',
  error:   'bg-red-400',
  offline: 'bg-orange-400',
};

export default function NavBar() {
  const { status, pending } = useSyncStore();

  return (
    <nav className="bg-gray-900 text-white flex h-20 shrink-0 items-center">
      <div className="flex items-center px-4 mr-auto">
        <img src={logo} alt="Pan Pos" className="h-16 w-auto" />
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

      {/* Sync status indicator */}
      <div className="px-4 flex flex-col items-center gap-1">
        <div className="relative">
          <div className={`w-3 h-3 rounded-full ${DOT[status] ?? DOT.idle}`} />
          {pending > 0 && status !== 'syncing' && (
            <span className="absolute -top-1 -right-2 bg-orange-500 text-white text-[9px] font-bold px-1 rounded-full leading-tight">
              {pending > 99 ? '99+' : pending}
            </span>
          )}
        </div>
        <span className="text-[10px] text-gray-500">
          {status === 'syncing' ? 'Sync...' :
           status === 'synced'  ? 'Synced' :
           status === 'offline' ? 'Offline' :
           status === 'error'   ? 'Fehler' : ''}
        </span>
      </div>
    </nav>
  );
}
