import type { IWriter, Dataset, WriteResult } from "../../types/index.js";
import type { StorageOptions } from "../StorageFactory.js";

export class S3Writer implements IWriter {
  constructor(private readonly options: StorageOptions) {}

  public async write(destination: string, _data: Dataset): Promise<WriteResult> {
    // TODO Semaine 3 : PutObjectCommand avec stream
    console.warn(`[S3Writer] S3 write stub — s3://${this.options.bucket}/${destination}`);
    return { rowsWritten: 0, duration: 0, errors: ["S3Writer not yet implemented"] };
  }
}
