export type JsonSchemaObject = Record<string, unknown>;

export function validateRequiredObjectProperties(schema: JsonSchemaObject, parameters: Record<string, unknown>): string[] {
  const requiredProperties = Array.isArray(schema.required) ? schema.required : [];
  return requiredProperties.filter((propertyName) => typeof propertyName === "string" && !(propertyName in parameters)) as string[];
}
