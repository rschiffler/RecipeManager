// Business logic for tag management (Tags page + recipe editor lookups).
// All code for this endpoint lives under src/domains/tags.
import { raw } from 'objection';
import Tag from '../../models/Tag';
import TagType from '../../models/TagType';

export interface TagWithType {
  id: number | string;
  name: string;
  tagTypeId: number;
  tagType: string;
}

export async function listTags(): Promise<TagWithType[]> {
  const rows = await Tag.query()
    .select('tags.id', 'tags.name', 'tags.tagTypeId')
    .joinRelated('tagType')
    .select('tagType.name as tagType')
    .orderBy('tags.name');
  return rows as unknown as TagWithType[];
}

export async function listTagTypes(): Promise<TagType[]> {
  return TagType.query().orderBy('name');
}

export interface CreateTagInput {
  name?: unknown;
  tagTypeId?: unknown;
  tagType?: unknown;
}

async function resolveTagTypeId(input: CreateTagInput): Promise<number> {
  if (input.tagTypeId !== undefined && input.tagTypeId !== null && input.tagTypeId !== '') {
    const id = Number(input.tagTypeId);
    if (!Number.isInteger(id) || id < 1) {
      throw Object.assign(new Error('tagTypeId must be a positive integer'), { statusCode: 400 });
    }
    const type = await TagType.query().findById(id);
    if (!type) {
      throw Object.assign(new Error(`Unknown tagTypeId: ${id}`), { statusCode: 400 });
    }
    return Number(type.id);
  }
  if (input.tagType !== undefined && input.tagType !== null && String(input.tagType).trim() !== '') {
    const name = String(input.tagType).trim();
    const type = await TagType.query().findOne(raw('lower(name) = lower(?)', [name]));
    if (!type) {
      throw Object.assign(new Error(`Unknown tagType: ${name}`), { statusCode: 400 });
    }
    return Number(type.id);
  }
  throw Object.assign(new Error('Provide tagTypeId (or tagType name) for the new tag'), {
    statusCode: 400,
  });
}

function validateTagName(input: unknown): string {
  const name = String(input ?? '').trim();
  if (name.length === 0) {
    throw Object.assign(new Error('Tag name is required'), { statusCode: 400 });
  }
  if (name.length > 50) {
    throw Object.assign(new Error('Tag name must be 50 characters or fewer'), { statusCode: 400 });
  }
  return name;
}

export async function createTag(input: CreateTagInput): Promise<TagWithType> {
  const name = validateTagName(input.name);
  const duplicate = await Tag.query().findOne(raw('lower(name) = lower(?)', [name]));
  if (duplicate) {
    throw Object.assign(new Error(`Tag "${duplicate.name}" already exists`), { statusCode: 409 });
  }
  const tagTypeId = await resolveTagTypeId(input);
  const created = await Tag.query().insert({ name, tagTypeId });
  const type = await TagType.query().findById(tagTypeId);
  return {
    id: Number(created.id),
    name: created.name,
    tagTypeId,
    tagType: type?.name ?? '',
  };
}

export interface UpdateTagInput extends CreateTagInput {}

export async function updateTag(id: number, input: UpdateTagInput): Promise<TagWithType | undefined> {
  const existing = await Tag.query().findById(id);
  if (!existing) return undefined;

  const patch: { name?: string; tagTypeId?: number } = {};
  if (input.name !== undefined) {
    const name = validateTagName(input.name);
    const duplicate = await Tag.query()
      .findOne(raw('lower(name) = lower(?)', [name]))
      .whereNot('id', id);
    if (duplicate) {
      throw Object.assign(new Error(`Tag "${duplicate.name}" already exists`), { statusCode: 409 });
    }
    patch.name = name;
  }
  if (
    (input.tagTypeId !== undefined && input.tagTypeId !== null && input.tagTypeId !== '') ||
    (input.tagType !== undefined && input.tagType !== null && String(input.tagType).trim() !== '')
  ) {
    patch.tagTypeId = await resolveTagTypeId(input);
  }
  const updated =
    Object.keys(patch).length > 0
      ? await Tag.query().patchAndFetchById(id, patch)
      : existing;
  const type = await TagType.query().findById(Number(updated.tagTypeId));
  return {
    id: updated.id,
    name: updated.name,
    tagTypeId: Number(updated.tagTypeId),
    tagType: type?.name ?? '',
  };
}
