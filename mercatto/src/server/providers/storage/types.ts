export type StoredObject = { url: string; key: string; size: number; contentType: string };

export interface StorageProvider {
  readonly name: string;
  put(key: string, data: Buffer, contentType: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
}
