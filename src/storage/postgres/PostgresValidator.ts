import type { IValidator, Dataset, ValidationResult, ValidationError } from "../../types/index.js";
import type { StorageOptions } from "../StorageFactory.js";
export class PostgresValidator implements IValidator {
  private readonly schema: Record<string, string>;
  constructor(options: StorageOptions) {
    this.schema = options.schema ?? {};
  }
  public validate(data: Dataset): ValidationResult {
    const errors: ValidationError[] = [];

    data.forEach((row, rowIdx) => {
      Object.entries(this.schema).forEach(([field, expectedType]) => {
        const value = row[field];

        if (value === undefined || value === null) {
          errors.push({ row: rowIdx, field, message: `Missing required field "${field}"` });
          return;
        }

        const actualType = Array.isArray(value) ? "array" : typeof value;
        const typeValid =
          expectedType === "date"
            ? !isNaN(new Date(String(value)).getTime())
            : actualType === expectedType;

        if (!typeValid) {
          errors.push({
            row: rowIdx,
            field,
            message: `Expected ${expectedType}, got ${actualType} for field "${field}"`,
          });
        }
      });
    });

    return { valid: errors.length === 0, errors, rowsChecked: data.length };
  }
}
