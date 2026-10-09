import type { JSONSchema } from 'objection';
import BaseModel from '../db/BaseModel';

export default class MeasurementUnit extends BaseModel {
  id!: number;
  name!: string;
  abbreviation?: string | null;

  static get tableName(): string {
    return 'measurement_units';
  }

  static get jsonSchema(): JSONSchema {
    return {
      type: 'object',
      required: ['name'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string', maxLength: 30 },
        abbreviation: { anyOf: [{ type: 'string', maxLength: 10 }, { type: 'null' }] },
      },
    };
  }
}
