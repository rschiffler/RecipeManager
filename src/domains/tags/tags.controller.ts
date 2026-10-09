// HTTP handlers for tag management.
import type { Request, Response } from 'express';
import { createTag, listTags, updateTag } from './tags.service';

function parseId(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

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

export async function updateTagHandler(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  if (id == null) {
    res.status(400).json({ error: 'Invalid tag id' });
    return;
  }
  const b = (req.body ?? {}) as Record<string, unknown>;
  try {
    const tag = await updateTag(id, {
      name: b.name,
      tagTypeId: b.tagTypeId ?? b.tag_type_id,
      tagType: b.tagType ?? b.tag_type,
    });
    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }
    res.json(tag);
  } catch (err) {
    res.status(toStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
