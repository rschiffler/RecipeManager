// HTTP handlers for tag management.
import type { Request, Response } from 'express';
import { createTag, listTags } from './tags.service';

function toStatus(err: unknown): number {
  if (typeof err === 'object' && err !== null && 'statusCode' in err) {
    const code = Number((err as { statusCode: unknown }).statusCode);
    if (Number.isInteger(code) && code >= 400 && code < 600) return code;
  }
  return 500;
}

export async function listTagsHandler(_req: Request, res: Response): Promise<void> {
  try {
    res.json(await listTags());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function createTagHandler(req: Request, res: Response): Promise<void> {
  const b = (req.body ?? {}) as Record<string, unknown>;
  try {
    const tag = await createTag({
      name: b.name,
      tagTypeId: b.tagTypeId ?? b.tag_type_id,
      tagType: b.tagType ?? b.tag_type,
    });
    res.status(201).json(tag);
  } catch (err) {
    res.status(toStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
