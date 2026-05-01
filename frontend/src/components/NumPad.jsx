import { useState } from 'react';

const KEYS = [
  '7', '8', '9',
  '4', '5', '6',
  '1', '2', '3',
  '.', '0', '⌫',
];

export default function NumPad({ label, initial, onConfirm, onCancel }) {
  const [value, setValue] = useState(String(initial ?? ''));

  function press(key) {
    if (key === '⌫') {
      setValue(v => v.slice(0, -1) || '0');
      return;
    }
    if (key === '.' && value.includes('.')) return;
    if (value === '0' && key !== '.') {
      setValue(key);
      return;
    }
    // limit to 2 decimal places
    if (value.includes('.') && value.split('.')[1]?.length >= 2) return;
    setValue(v => v + key);
  }

  function confirm() {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) onConfirm(num);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 pb-6 px-4">
      <div className="bg-gray-900 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 text-center">
          <p className="text-gray-400 text-sm mb-1">{label}</p>
          <div className="text-5xl font-bold text-white tracking-tight min-h-[60px] flex items-center justify-center">
            €{value || '0'}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-3 gap-2 px-4 pb-4">
          {KEYS.map(key => (
            <button
              key={key}
              onClick={() => press(key)}
              className={`h-16 rounded-2xl text-2xl font-bold transition-colors active:scale-95 ${
                key === '⌫'
                  ? 'bg-gray-700 text-red-400 active:bg-gray-600'
                  : 'bg-gray-800 text-white active:bg-gray-700'
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 px-4 pb-5">
          <button
            onClick={onCancel}
            className="h-14 rounded-2xl bg-gray-700 text-gray-300 font-bold text-lg active:bg-gray-600"
          >
            İptal
          </button>
          <button
            onClick={confirm}
            className="h-14 rounded-2xl bg-emerald-600 text-white font-bold text-lg active:bg-emerald-700"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
}
