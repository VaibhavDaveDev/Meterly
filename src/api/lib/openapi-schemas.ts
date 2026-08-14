import { z } from "@hono/zod-openapi";

export const SuccessResponse = z
  .object({
    success: z.literal(true).openapi({ example: true }),
    data: z
      .any()
      .openapi({ example: { id: "abc123uuid", name: "Example Item" } }),
  })
  .openapi({
    example: {
      success: true,
      data: { id: "abc123uuid", name: "Example Item" },
    },
  });

export function createSuccessResponse<T extends z.ZodTypeAny>(
  dataSchema: T,
  exampleData?: z.infer<T>
) {
  const schema = z.object({
    success: z.literal(true).openapi({ example: true }),
    data: dataSchema,
  });

  if (exampleData !== undefined) {
    return schema.openapi({
      example: {
        success: true,
        data: exampleData,
      },
    });
  }

  return schema;
}

export const SimpleSuccessResponse = z
  .object({
    success: z.literal(true).openapi({ example: true }),
  })
  .openapi({ example: { success: true } });

export const MessageResponse = z
  .object({
    success: z.literal(true).openapi({ example: true }),
    message: z
      .string()
      .openapi({ example: "Operation completed successfully" }),
  })
  .openapi({
    example: { success: true, message: "Operation completed successfully" },
  });

export const ErrorResponse = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string().openapi({ example: "UNAUTHORIZED" }),
    message: z
      .string()
      .openapi({ example: "Not authorized to view this resource" }),
  }),
});
export const IdParam = z.object({
  id: z.string().openapi({ example: "abc123uuid" }),
});
