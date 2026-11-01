import { z } from "zod";

// The source JSON is converted from XML: a one-item list arrives as a bare object, an empty one as null
export function oneOrMany<T extends z.ZodType>(schema: T) {
  return z.union([
    z.array(schema),
    schema,
  ])
    .nullish()
    .transform((value): z.output<T>[] => {
      if (value == null)
        return [];
      return Array.isArray(value)
        ? value
        : [value];
    });
}
