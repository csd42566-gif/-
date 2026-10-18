import AsyncStorage from '@react-native-async-storage/async-storage';
import { LedgerState } from '../core/model/finance';
import { normalizeLedgerState } from './normalize';
import { createInitialLedgerState } from './initialState';

const KEY = 'strict-ledger/state';
const TEMP_KEY = 'strict-ledger/state.tmp';
const CORRUPT_KEY_PREFIX = 'strict-ledger/state.corrupt.';
const CURRENT_SCHEMA_VERSION = 1;

type StoredLedger = {
  schemaVersion: number;
  state: LedgerState;
};

let saveQueue: Promise<void> = Promise.resolve();

export async function loadState(): Promise<LedgerState> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(KEY);
    if (!raw) raw = await AsyncStorage.getItem(TEMP_KEY);
  } catch {
    return fallbackToInitial();
  }

  if (!raw) return fallbackToInitial();

  try {
    const state = normalizeLedgerState(unwrapStoredState(JSON.parse(raw)));
    try {
      await saveState(state);
    } catch {
      // Keep the valid in-memory state even if the storage migration cannot be persisted.
    }
    return state;
  } catch {
    await backupCorrupt(raw);
    return fallbackToInitial();
  }
}

export function saveState(state: LedgerState): Promise<void> {
  const payload = JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, state } as StoredLedger);
  const operation = saveQueue.then(async () => {
    await AsyncStorage.setItem(TEMP_KEY, payload);
    await AsyncStorage.setItem(KEY, payload);
    try {
      await AsyncStorage.removeItem(TEMP_KEY);
    } catch {
      // The committed main key is authoritative; a stale temp key is harmless.
    }
  });
  saveQueue = operation.catch(() => undefined);
  return operation;
}

function unwrapStoredState(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const stored = value as { schemaVersion?: unknown; state?: unknown };
  if (!('schemaVersion' in stored)) return value;
  if (stored.schemaVersion !== CURRENT_SCHEMA_VERSION && stored.schemaVersion !== 0) {
    throw new Error('ledger-schema-unsupported');
  }
  return stored.state;
}

async function backupCorrupt(raw: string): Promise<void> {
  const suffix = new Date().toISOString().replace(/[:.]/g, '-');
  try {
    await AsyncStorage.setItem(`${CORRUPT_KEY_PREFIX}${suffix}`, raw);
  } catch {
    // Falling back must not depend on the backup succeeding.
  }
}

async function fallbackToInitial(): Promise<LedgerState> {
  const initialState = createInitialLedgerState();
  try {
    await saveState(initialState);
  } catch {
    // Return a usable state even when storage itself is unavailable.
  }
  return initialState;
}