import type { IValidator, Dataset, ValidationResult } from "../../types/index.js";
import type { StorageOptions } from "../StorageFactory.js";

export class S3Validator implements IValidator {
  constructor(private readonly _options: StorageOptions) {}

  public validate(data: Dataset): ValidationResult {
    const errors: { row: number; field: string; message: string }[] = [];
    try {
      JSON.stringify(data);
    } catch {
      errors.push({ row: -1, field: "*", message: "Dataset is not JSON-serializable" });
    }
    return { valid: errors.length === 0, errors, rowsChecked: data.length };
  }
}
