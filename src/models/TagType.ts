import type { JSONSchema, RelationMappings } from 'objection';
import BaseModel from '../db/BaseModel';
import Tag from './Tag';

export default class TagType extends BaseModel {
  id!: number;
  name!: string;

  tags?: Tag[];

  static get tableName(): string {
    return 'tag_types';
  }

  static get jsonSchema(): JSONSchema {
    return {
      type: 'object',
      required: ['name'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string', maxLength: 50 },
      },
    };
  }

  static get relationMappings(): RelationMappings {
    return {
      tags: {
        relation: BaseModel.HasManyRelation,
        modelClass: Tag,
        join: {
          from: 'tag_types.id',
          to: 'tags.tag_type_id',
        },
      },
    };
  }
}
