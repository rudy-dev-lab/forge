import type { IValidator, Dataset, ValidationResult, ValidationError } from "../../types/index.js";
import type { StorageOptions } from "../StorageFactory.js";

export class FilesystemValidator implements IValidator {
  constructor(private readonly options: StorageOptions) {}
  public validate(data: Dataset): ValidationResult {
    const schema = this.options.schema ?? {};
    const errors: ValidationError[] = [];

    if (Object.keys(schema).length === 0) {
      const isValid = Array.isArray(data) && data.every((r) => typeof r === "object" && r !== null);
      return {
        valid: isValid,
        errors: isValid
          ? []
          : [{ row: -1, field: "*", message: "Data must be an array of objects" }],
        rowsChecked: data.length,
      };
    }

    data.forEach((row, i) => {
      Object.keys(schema).forEach((field) => {
        if (row[field] === undefined) {
          errors.push({ row: i, field, message: `Missing field: ${field}` });
        }
      });
    });

    return { valid: errors.length === 0, errors, rowsChecked: data.length };
  }
}
