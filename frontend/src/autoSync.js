import { syncAll, countUnsynced } from './sync';
import { useSyncStore } from './syncStore';

let syncing = false;

export async function runAutoSync() {
  const { setStatus, setPending } = useSyncStore.getState();

  const pending = await countUnsynced();
  setPending(pending);

  if (!navigator.onLine) {
    setStatus('offline');
    return;
  }

  if (pending === 0) {
    setStatus('synced');
    return;
  }

  if (syncing) return;
  syncing = true;
  setStatus('syncing');

  try {
    await syncAll();
    const remaining = await countUnsynced();
    setPending(remaining);
    setStatus(remaining === 0 ? 'synced' : 'idle');
  } catch (err) {
    setStatus(err.message === 'Backend nicht erreichbar' ? 'offline' : 'error');
  } finally {
    syncing = false;
  }
}
