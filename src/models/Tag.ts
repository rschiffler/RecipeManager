import type { JSONSchema, RelationMappings } from 'objection';
import BaseModel from '../db/BaseModel';
import TagType from './TagType';

export default class Tag extends BaseModel {
  id!: number;
  name!: string;
  tagTypeId!: number;

  static get tableName(): string {
    return 'tags';
  }

  static get jsonSchema(): JSONSchema {
    return {
      type: 'object',
      required: ['name', 'tagTypeId'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string', maxLength: 50 },
        tagTypeId: { type: 'integer' },
      },
    };
  }

  static get relationMappings(): RelationMappings {
    return {
      tagType: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: TagType,
        join: {
          from: 'tags.tag_type_id',
          to: 'tag_types.id',
        },
      },
    };
  }
}
