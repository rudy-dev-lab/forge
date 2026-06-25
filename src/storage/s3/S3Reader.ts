// Stub S3Reader — AWS SDK sera intégré en semaine 3 (async streaming)
import type { IReader, Dataset } from "../../types/index.js";
import type { StorageOptions } from "../StorageFactory.js";

export class S3Reader implements IReader {
  constructor(private readonly options: StorageOptions) {
    if (!options.bucket) throw new Error("[S3Reader] bucket required");
    if (!options.region) throw new Error("[S3Reader] region required");
  }

  public async read(source: string): Promise<Dataset> {
    // TODO Semaine 3 : GetObjectCommand + stream parsing
    console.warn(`[S3Reader] S3 read stub — source: s3://${this.options.bucket}/${source}`);
    return [];
  }
}
