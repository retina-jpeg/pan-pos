import { useEffect, useState } from 'react';
import { db } from '../db';
import { useCartStore } from '../stores/cartStore';

export default function LocationSelector() {
  const [locations, setLocations] = useState([]);
  const { locationId, setLocation } = useCartStore();

  useEffect(() => {
    db.locations.toArray().then(locs => {
      setLocations(locs);
      if (!locationId && locs.length > 0) setLocation(locs[0].id);
    });
  }, []);

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <span className="text-sm text-gray-500 font-medium">Pazar:</span>
      {locations.map(loc => (
        <button
          key={loc.id}
          onClick={() => setLocation(loc.id)}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            locationId === loc.id
              ? 'bg-emerald-600 text-white shadow'
              : 'bg-white text-gray-700 border border-gray-300 active:bg-gray-50'
          }`}
        >
          {loc.name}
        </button>
      ))}
    </div>
  );
}
