import { NativeModules, Platform } from 'react-native';
import { NativeNotificationEvent } from './parser';
import { DEFAULT_MODULE_CONFIG, MagiskModuleStatus, ModuleFeatureKey } from '../magisk/module';

export interface ModuleInboxFile {
  inboxName: string;
  displayName: string;
  size: string;
  modifiedAt: string;
  digest: string;
  source: string;
  uri: string;
}

type FinanceBridge = {
  isNotificationAccessEnabled(): Promise<boolean>;
  openNotificationAccessSettings(): Promise<boolean>;
  getRootStatus(): Promise<'detected' | 'not-detected' | 'unavailable'>;
  setNavigationBarStyle(backgroundColor: string, lightButtons: boolean): Promise<boolean>;
  consumeNotificationCandidates(): Promise<NativeNotificationEvent[]>;
  startStatusService(text: string): Promise<boolean>;
  updateStatusService(text: string): Promise<boolean>;
  stopStatusService(): Promise<boolean>;
  readStatementFile(uri: string): Promise<string>;
  readStatementFileBase64(uri: string): Promise<string>;
  requestBillScan(): Promise<boolean>;
  listModuleInbox(): Promise<ModuleInboxFile[]>;
  getMagiskModuleStatus(): Promise<MagiskModuleStatus>;
  setMagiskModuleFeature(feature: ModuleFeatureKey, enabled: boolean): Promise<MagiskModuleStatus>;
};

const bridge = Platform.OS === 'android' ? NativeModules.FinanceBridge as FinanceBridge | undefined : undefined;
const unavailableModule: MagiskModuleStatus = {
  available: false,
  installed: false,
  version: '',
  config: { ...DEFAULT_MODULE_CONFIG },
};

export const nativeFinance = {
  available: !!bridge,
  isNotificationAccessEnabled: () => bridge?.isNotificationAccessEnabled() ?? Promise.resolve(false),
  openNotificationAccessSettings: () => bridge?.openNotificationAccessSettings() ?? Promise.resolve(false),
  getRootStatus: () => bridge?.getRootStatus() ?? Promise.resolve('unavailable' as const),
  setNavigationBarStyle: (backgroundColor: string, lightButtons: boolean) => bridge?.setNavigationBarStyle(backgroundColor, lightButtons) ?? Promise.resolve(false),
  consumeNotificationCandidates: () => bridge?.consumeNotificationCandidates() ?? Promise.resolve([]),
  startStatusService: (text: string) => bridge?.startStatusService(text) ?? Promise.reject(new Error('status-service-unavailable')),
  updateStatusService: (text: string) => bridge?.updateStatusService(text) ?? Promise.reject(new Error('status-service-unavailable')),
  stopStatusService: () => bridge?.stopStatusService() ?? Promise.reject(new Error('status-service-unavailable')),
  readStatementFile: (uri: string) => bridge?.readStatementFile(uri) ?? Promise.reject(new Error('statement-file-read-unavailable')),
  readStatementFileBase64: (uri: string) => bridge?.readStatementFileBase64(uri) ?? Promise.reject(new Error('statement-file-read-unavailable')),
  requestBillScan: () => bridge?.requestBillScan() ?? Promise.resolve(false),
  listModuleInbox: () => bridge?.listModuleInbox() ?? Promise.resolve([]),
  getMagiskModuleStatus: () => bridge?.getMagiskModuleStatus() ?? Promise.resolve(unavailableModule),
  setMagiskModuleFeature: (feature: ModuleFeatureKey, enabled: boolean) => bridge?.setMagiskModuleFeature(feature, enabled) ?? Promise.resolve(unavailableModule),
};
