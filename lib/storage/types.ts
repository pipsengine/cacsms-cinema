export interface StoredObject {
  key: string;
  byteSize: number;
  sha256: string;
}

export interface AssetStorage {
  put(key: string, bytes: Buffer): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  deliveryUrl(key: string): string;
}
