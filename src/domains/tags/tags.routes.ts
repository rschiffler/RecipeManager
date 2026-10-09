// Routes for the tags domain. Mounted at /api/tags (see index.ts).
import { Router } from 'express';
import { createTagHandler, listTagsHandler, updateTagHandler } from './tags.controller';

const tagsRouter = Router();

// GET /api/tags -> [{ id, name, tagTypeId, tagType }]
tagsRouter.get('/', listTagsHandler);
// POST /api/tags { name, tagTypeId } (or { name, tagType })
tagsRouter.post('/', createTagHandler);
// PUT /api/tags/:id { name?, tagTypeId? } (or tagType)
tagsRouter.put('/:id', updateTagHandler);

export default tagsRouter;
