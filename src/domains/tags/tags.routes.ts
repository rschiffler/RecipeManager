// Routes for the tags domain. Mounted at /api/tags (see index.ts).
import { Router } from 'express';
import { createTagHandler, listTagsHandler } from './tags.controller';

const tagsRouter = Router();

// GET /api/tags -> [{ id, name, tagTypeId, tagType }]
tagsRouter.get('/', listTagsHandler);
// POST /api/tags { name, tagTypeId } (or { name, tagType })
tagsRouter.post('/', createTagHandler);

export default tagsRouter;
