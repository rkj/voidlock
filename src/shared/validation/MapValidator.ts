import { MapDefinition } from "../types/map";
import { MapDefinitionSchema } from "../schemas/map";
import { Logger } from "../Logger";

export interface MapValidationResult {
  success: boolean;
  error?: string;
  data?: MapDefinition;
}

export class MapValidator {
  /**
   * Validates map data against the MapDefinition schema.
   * @param data The raw map data to validate.
   * @returns A validation result containing success status and optional error message.
   */
  public static validate(data: unknown): MapValidationResult {
    const result = MapDefinitionSchema.safeParse(data);
    if (!result.success) {
      const errorMsg = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      Logger.warn("MapValidator: Invalid map data:", errorMsg);
      return { success: false, error: errorMsg };
    }
    return { success: true, data: result.data as MapDefinition };
  }

  /**
   * Legacy type guard for backward compatibility.
   * @deprecated Use validate() instead to get detailed error messages.
   */
  public static validateMapData(data: unknown): data is MapDefinition {
    return this.validate(data).success;
  }
}
