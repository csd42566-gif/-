import {
  DEFAULT_MODULE_CONFIG,
  isModuleControlDeepLink,
  parseModuleConfig,
  serializeModuleConfig,
} from './module';

test('uses safe defaults for a missing module configuration', () => {
  expect(DEFAULT_MODULE_CONFIG).toEqual({
    moduleEnabled: true,
    notificationCapture: true,
    repaymentDetection: true,
    billScan: true,
    rootEnhancement: true,
    cloudSync: false,
  });
});

test('parses only the allowlisted module configuration keys', () => {
  expect(parseModuleConfig('module_enabled=0\nnotification_capture=1\ncloud_sync=1\n')).toEqual({
    moduleEnabled: false,
    notificationCapture: true,
    repaymentDetection: true,
    billScan: true,
    rootEnhancement: true,
    cloudSync: true,
  });
});

test('rejects unknown module configuration keys', () => {
  expect(() => parseModuleConfig('module_enabled=1\nexec_command=rm -rf /')).toThrow('module-config-unknown-key');
});

test('serializes configuration as stable shell-safe key value pairs', () => {
  expect(serializeModuleConfig({ ...DEFAULT_MODULE_CONFIG, moduleEnabled: false })).toBe(
    'module_enabled=0\nnotification_capture=1\nrepayment_detection=1\nbill_scan=1\nroot_enhancement=1\ncloud_sync=0\n',
  );
});

test('recognizes only the module control deep link', () => {
  expect(isModuleControlDeepLink('strictledger://module-control')).toBe(true);
  expect(isModuleControlDeepLink('strictledger://module-control?source=magisk')).toBe(true);
  expect(isModuleControlDeepLink('strictledger://home')).toBe(false);
  expect(isModuleControlDeepLink('https://example.com/module-control')).toBe(false);
});
