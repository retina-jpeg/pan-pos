import { syncAll, countUnsynced, pullFromBackend } from './sync';
import { useSyncStore } from './syncStore';

let syncing = false;

export async function runAutoSync() {
  const { setStatus, setPending } = useSyncStore.getState();

  if (!navigator.onLine) {
    setStatus('offline');
    setPending(await countUnsynced());
    return;
  }

  if (syncing) return;
  syncing = true;
  setStatus('syncing');

  try {
    // Pull remote changes down first, then push local changes up.
    const changed = await pullFromBackend();
    await syncAll();

    const remaining = await countUnsynced();
    setPending(remaining);
    setStatus(remaining === 0 ? 'synced' : 'idle');

    // Let open pages reload their data when the pull brought something new.
    if (changed) window.dispatchEvent(new Event('pos-synced'));
  } catch (err) {
    setStatus(err.message === 'Backend nicht erreichbar' ? 'offline' : 'error');
  } finally {
    syncing = false;
  }
}
