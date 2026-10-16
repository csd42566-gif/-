import AsyncStorage from '@react-native-async-storage/async-storage';
import { LedgerState } from '../core/model/finance';
import { normalizeLedgerState } from './normalize';
import { seedState } from './seed';

const KEY = 'strict-ledger/state';

export async function loadState(): Promise<LedgerState> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) {
    await saveState(seedState);
    return seedState;
  }
  const state = normalizeLedgerState(JSON.parse(raw));
  await saveState(state);
  return state;
}

export async function saveState(state: LedgerState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}
