import type { JSONSchema } from 'objection';
import BaseModel from '../db/BaseModel';

export default class Ingredient extends BaseModel {
  id!: number;
  name!: string;
  category?: string;
  createdAt?: string;

  // Join-table extras when fetched through Recipe.ingredients.
  amount?: string;
  notes?: string | null;
  unitId?: number | null;

  static get tableName(): string {
    return 'ingredients';
  }

  static get jsonSchema(): JSONSchema {
    return {
      type: 'object',
      required: ['name'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string', maxLength: 100 },
        category: { type: 'string', maxLength: 50 },
        createdAt: { type: 'string', format: 'date-time' },
      },
    };
  }
}
