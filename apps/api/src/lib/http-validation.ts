import type { FastifyReply, FastifyRequest } from "fastify";

type FieldErrors = Record<string, string[] | undefined>;

export interface SafeParseSchema<T> {
  safeParse(value: unknown):
    | { data: T; success: true }
    | {
        error: {
          fieldErrors?: FieldErrors;
          issues?: Array<{ message: string; path?: Array<string | number> }>;
        };
        success: false;
      };
}

function fieldsFor(error: {
  fieldErrors?: FieldErrors;
  issues?: Array<{ message: string; path?: Array<string | number> }>;
}): Record<string, string[]> {
  if (error.fieldErrors) {
    return Object.fromEntries(
      Object.entries(error.fieldErrors).flatMap(([field, messages]) =>
        messages?.length ? [[field, messages]] : [],
      ),
    );
  }

  return (error.issues ?? []).reduce<Record<string, string[]>>(
    (fields, issue) => {
      const field = String(issue.path?.[0] ?? "body");
      fields[field] = [...(fields[field] ?? []), issue.message];
      return fields;
    },
    {},
  );
}

export function parseBody<T>(
  schema: SafeParseSchema<T>,
  request: Pick<FastifyRequest, "body">,
  reply: FastifyReply,
): T | undefined {
  const parsed = schema.safeParse(request.body);
  if (parsed.success) return parsed.data;

  reply.code(400).send({
    error: "INVALID_REQUEST",
    fields: fieldsFor(parsed.error),
  });
  return undefined;
}
