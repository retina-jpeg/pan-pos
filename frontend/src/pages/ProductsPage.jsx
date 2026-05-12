import { useEffect, useRef, useState } from 'react';
import { db } from '../db';

function hslToHex(h, s, l) {
  l /= 100; s /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))
      .toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex) {
  if (!hex || hex.length < 7) return { h: 0, s: 0, l: 80 };
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function getRelativeX(e, el) {
  const rect = el.getBoundingClientRect();
  const clientX = e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX ?? e.clientX;
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
}

const DEFAULT_COLOR = '#e5e7eb';

function SpectrumPicker({ value, onChange }) {
  const hueRef   = useRef(null);
  const lightRef = useRef(null);
  const { h, l } = hexToHsl(value || DEFAULT_COLOR);

  function pickHue(e) {
    e.preventDefault();
    const newH = Math.round(getRelativeX(e, hueRef.current) * 360);
    onChange(hslToHex(newH, 100, Math.max(l, 20)));
  }

  function pickLight(e) {
    e.preventDefault();
    const newL = Math.round(getRelativeX(e, lightRef.current) * 100);
    onChange(hslToHex(h, newL < 10 ? 0 : 100, newL));
  }

  const markerStyle = (pct) => ({
    left: `calc(${pct}% - 8px)`,
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 16,
    height: 16,
    borderRadius: '50%',
    border: '2.5px solid white',
    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
    pointerEvents: 'none',
    backgroundColor: value || DEFAULT_COLOR,
  });

  return (
    <div className="space-y-3">
      {/* Hue strip */}
      <div className="relative h-9">
        <div
          ref={hueRef}
          className="absolute inset-0 rounded-xl cursor-pointer"
          style={{
            background: 'linear-gradient(to right, hsl(0,100%,50%), hsl(30,100%,50%), hsl(60,100%,50%), hsl(90,100%,50%), hsl(120,100%,50%), hsl(150,100%,50%), hsl(180,100%,50%), hsl(210,100%,50%), hsl(240,100%,50%), hsl(270,100%,50%), hsl(300,100%,50%), hsl(330,100%,50%), hsl(360,100%,50%))',
          }}
          onClick={pickHue}
          onTouchEnd={pickHue}
        />
        <div style={markerStyle(h / 360 * 100)} />
      </div>

      {/* Lightness strip */}
      <div className="relative h-9">
        <div
          ref={lightRef}
          className="absolute inset-0 rounded-xl cursor-pointer"
          style={{
            background: `linear-gradient(to right, #000, hsl(${h},100%,50%), #fff)`,
          }}
          onClick={pickLight}
          onTouchEnd={pickLight}
        />
        <div style={markerStyle(l)} />
      </div>

      {/* Preview */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl border border-gray-200 shrink-0"
          style={{ backgroundColor: value || DEFAULT_COLOR }}
        />
        <span className="text-sm text-gray-400 font-mono">{value || DEFAULT_COLOR}</span>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [name, setName]         = useState('');
  const [price, setPrice]       = useState('');
  const [color, setColor]       = useState(DEFAULT_COLOR);
  const [editId, setEditId]     = useState(null);

  async function load() {
    setProducts(await db.products.toArray());
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !price) return;
    const now = new Date().toISOString();
    if (editId) {
      await db.products.update(editId, {
        name: name.trim(), price: parseFloat(price), color, updatedAt: now, synced: false,
      });
      setEditId(null);
    } else {
      await db.products.add({
        name: name.trim(), price: parseFloat(price), color, createdAt: now, updatedAt: now, synced: false,
      });
    }
    setName(''); setPrice(''); setColor(DEFAULT_COLOR);
    load();
  }

  function startEdit(p) {
    setEditId(p.id); setName(p.name); setPrice(String(p.price)); setColor(p.color || DEFAULT_COLOR);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteProduct(id) {
    if (!confirm('Produkt löschen?')) return;
    await db.products.delete(id);
    load();
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-10">
      <h1 className="text-2xl font-bold mb-5 text-gray-800">Produkte</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 shadow-sm mb-6 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Produktname"
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-emerald-500"
          />
          <input
            type="number"
            placeholder="€ Preis"
            value={price}
            onChange={e => setPrice(e.target.value)}
            min="0" step="0.5"
            className="w-28 border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-emerald-500"
          />
        </div>
        <SpectrumPicker value={color} onChange={setColor} />
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl active:bg-emerald-700"
          >{editId ? 'Aktualisieren' : 'Hinzufügen'}</button>
          {editId && (
            <button
              type="button"
              onClick={() => { setEditId(null); setName(''); setPrice(''); setColor(DEFAULT_COLOR); }}
              className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium active:bg-gray-300"
            >Abbrechen</button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {products.map(p => (
          <div key={p.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
            <div
              className="w-5 h-5 rounded-lg shrink-0 border border-gray-200"
              style={{ backgroundColor: p.color || DEFAULT_COLOR }}
            />
            <div className="flex-1 font-bold text-gray-800">{p.name}</div>
            <div className="text-emerald-600 font-bold text-lg">€{p.price}</div>
            <button onClick={() => startEdit(p)}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium active:bg-gray-200"
            >Bearbeiten</button>
            <button onClick={() => deleteProduct(p.id)}
              className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium active:bg-red-100"
            >Löschen</button>
          </div>
        ))}
        {products.length === 0 && (
          <p className="text-center text-gray-400 py-10">Noch keine Produkte hinzugefügt</p>
        )}
      </div>
    </div>
  );
}
