export type ModuleFeatureKey = 'notificationCapture' | 'repaymentDetection' | 'billScan' | 'rootEnhancement' | 'cloudSync';

export interface ModuleConfig {
  moduleEnabled: boolean;
  notificationCapture: boolean;
  repaymentDetection: boolean;
  billScan: boolean;
  rootEnhancement: boolean;
  cloudSync: boolean;
}

export interface MagiskModuleStatus {
  available: boolean;
  installed: boolean;
  version: string;
  config: ModuleConfig;
  lastBootAt?: string;
}

export const DEFAULT_MODULE_CONFIG: ModuleConfig = {
  moduleEnabled: true,
  notificationCapture: true,
  repaymentDetection: true,
  billScan: true,
  rootEnhancement: true,
  cloudSync: false,
};

const CONFIG_KEYS: Record<string, keyof ModuleConfig> = {
  module_enabled: 'moduleEnabled',
  notification_capture: 'notificationCapture',
  repayment_detection: 'repaymentDetection',
  bill_scan: 'billScan',
  root_enhancement: 'rootEnhancement',
  cloud_sync: 'cloudSync',
};

const CONFIG_ORDER: Array<[keyof ModuleConfig, string]> = [
  ['moduleEnabled', 'module_enabled'],
  ['notificationCapture', 'notification_capture'],
  ['repaymentDetection', 'repayment_detection'],
  ['billScan', 'bill_scan'],
  ['rootEnhancement', 'root_enhancement'],
  ['cloudSync', 'cloud_sync'],
];

export function parseModuleConfig(raw: string): ModuleConfig {
  const config = { ...DEFAULT_MODULE_CONFIG };
  const seen = new Set<string>();
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) throw new Error('module-config-invalid-line');
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    const target = CONFIG_KEYS[key];
    if (!target) throw new Error('module-config-unknown-key');
    if (seen.has(key)) throw new Error('module-config-duplicate-key');
    if (value !== '0' && value !== '1') throw new Error('module-config-invalid-value');
    seen.add(key);
    config[target] = value === '1';
  }
  return config;
}

export function serializeModuleConfig(config: ModuleConfig): string {
  return CONFIG_ORDER.map(([property, key]) => `${key}=${config[property] ? '1' : '0'}`).join('\n') + '\n';
}

export function isModuleControlDeepLink(value: string | null | undefined): boolean {
  if (!value) return false;
  const match = /^strictledger:\/\/([^/?#]+)/i.exec(value.trim());
  return match?.[1].toLowerCase() === 'module-control';
}
