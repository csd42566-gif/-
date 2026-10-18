import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { nativeFinance } from '../../integrations/notifications/nativeFinance';

export type PickedStatementFile =
  | { kind: 'text'; name: string; text: string }
  | { kind: 'xlsx'; name: string; bytes: Uint8Array };

const statementMimeTypes = [
  'text/csv',
  'text/comma-separated-values',
  'text/tab-separated-values',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

function isWorkbook(name: string, mimeType?: string): boolean {
  return /\.(xlsx|xls)$/i.test(name) || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

export async function readStatementAsset(name: string, uri: string, mimeType?: string): Promise<PickedStatementFile> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return isWorkbook(name, mimeType)
      ? { kind: 'xlsx', name, bytes }
      : { kind: 'text', name, text: decodeBytes(bytes) };
  }
  if (isWorkbook(name, mimeType)) {
    if (!nativeFinance.available) throw new Error('statement-file-read-unavailable');
    const base64 = await nativeFinance.readStatementFileBase64(uri);
    return { kind: 'xlsx', name, bytes: decodeBase64(base64) };
  }
  if (nativeFinance.available) return { kind: 'text', name, text: await nativeFinance.readStatementFile(uri) };
  throw new Error('statement-file-read-unavailable');
}
export async function pickStatementFile(): Promise<PickedStatementFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: statementMimeTypes, copyToCacheDirectory: false });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  if (Platform.OS === 'web') {
    const bytes = await readWebBytes(asset);
    return isWorkbook(asset.name, asset.mimeType)
      ? { kind: 'xlsx', name: asset.name, bytes }
      : { kind: 'text', name: asset.name, text: decodeBytes(bytes) };
  }
  if (isWorkbook(asset.name, asset.mimeType)) {
    if (!nativeFinance.available) throw new Error('statement-file-read-unavailable');
    const base64 = await nativeFinance.readStatementFileBase64(asset.uri);
    return { kind: 'xlsx', name: asset.name, bytes: decodeBase64(base64) };
  }
  if (nativeFinance.available) return { kind: 'text', name: asset.name, text: await nativeFinance.readStatementFile(asset.uri) };
  const text = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
  if (text.includes('\uFFFD')) throw new Error('statement-file-encoding-unsupported');
  return { kind: 'text', name: asset.name, text };
}

async function readWebBytes(asset: DocumentPicker.DocumentPickerAsset): Promise<Uint8Array> {
  if (asset.file) return new Uint8Array(await asset.file.arrayBuffer());
  const response = await fetch(asset.uri);
  return new Uint8Array(await response.arrayBuffer());
}

function decodeBytes(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  if (!utf8.includes('\uFFFD')) return utf8;
  try {
    return new TextDecoder('gbk').decode(bytes);
  } catch {
    throw new Error('statement-file-encoding-unsupported');
  }
}

function decodeBase64(value: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = value.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor(clean.length * 3 / 4));
  let offset = 0;
  for (let index = 0; index < clean.length; index += 4) {
    const a = alphabet.indexOf(clean[index]);
    const b = alphabet.indexOf(clean[index + 1]);
    const c = clean[index + 2] ? alphabet.indexOf(clean[index + 2]) : -1;
    const d = clean[index + 3] ? alphabet.indexOf(clean[index + 3]) : -1;
    bytes[offset++] = (a << 2) | (b >> 4);
    if (c >= 0) bytes[offset++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) bytes[offset++] = ((c & 3) << 6) | d;
  }
  return bytes.slice(0, offset);
}
