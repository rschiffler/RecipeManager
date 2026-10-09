import type { JSONSchema, RelationMappings } from 'objection';
import BaseModel from '../db/BaseModel';
import Ingredient from './Ingredient';
import Tag from './Tag';

export default class Recipe extends BaseModel {
  id!: number;
  title!: string;
  description?: string | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  servings?: number | null;
  instructions?: string[] | null;
  createdAt?: string;
  updatedAt?: string;

  ingredients?: Ingredient[];
  tags?: Tag[];

  static get tableName(): string {
    return 'recipes';
  }

  static get jsonAttributes(): string[] {
    return ['instructions'];
  }

  static get jsonSchema(): JSONSchema {
    return {
      type: 'object',
      required: ['title'],
      properties: {
        id: { type: 'integer' },
        title: { type: 'string', maxLength: 150 },
        description: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        prepTimeMinutes: { anyOf: [{ type: 'integer', minimum: 0 }, { type: 'null' }] },
        cookTimeMinutes: { anyOf: [{ type: 'integer', minimum: 0 }, { type: 'null' }] },
        servings: { anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }] },
        instructions: { anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }] },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    };
  }

  static get relationMappings(): RelationMappings {
    return {
      ingredients: {
        relation: BaseModel.ManyToManyRelation,
        modelClass: Ingredient,
        join: {
          from: 'recipes.id',
          through: {
            from: 'recipe_ingredients.recipe_id',
            to: 'recipe_ingredients.ingredient_id',
            extra: ['amount', 'notes', 'unit_id'],
          },
          to: 'ingredients.id',
        },
      },
      tags: {
        relation: BaseModel.ManyToManyRelation,
        modelClass: Tag,
        join: {
          from: 'recipes.id',
          through: {
            from: 'recipe_tags.recipe_id',
            to: 'recipe_tags.tag_id',
          },
          to: 'tags.id',
        },
      },
    };
  }
}
