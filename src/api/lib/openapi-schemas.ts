import { z } from '@hono/zod-openapi';

export const SuccessResponse = z.object({
  success: z.literal(true),
  data: z.any(),
});

export const SimpleSuccessResponse = z.object({
  success: z.literal(true),
});

export const MessageResponse = z.object({
  success: z.literal(true),
  message: z.string(),
});

export const ErrorResponse = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string().openapi({ example: 'UNAUTHORIZED' }),
    message: z.string().openapi({ example: 'Not authorized to view this resource' }),
  }),
});

export const SimpleError = z.object({
  error: z.string(),
});

export const IdParam = z.object({
  id: z.string().openapi({ example: 'abc123uuid' }),
});

export const TokenParam = z.object({
  token: z.string().openapi({ example: 'invite-token-xyz' }),
});
