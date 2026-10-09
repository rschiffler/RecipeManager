import type { JSONSchema, RelationMappings } from 'objection';
import BaseModel from '../db/BaseModel';
import Recipe from './Recipe';

export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export default class WeeklyMealPlan extends BaseModel {
  id!: number;
  recipeId!: number;
  year!: number;
  weekNumber!: number;
  dayOfWeek?: DayOfWeek | null;
  servingsPlanned?: number;
  createdAt?: string;

  recipe?: Recipe;

  static get tableName(): string {
    return 'weekly_meal_plans';
  }

  static get jsonSchema(): JSONSchema {
    return {
      type: 'object',
      required: ['recipeId', 'year', 'weekNumber'],
      properties: {
        id: { type: 'integer' },
        recipeId: { type: 'integer' },
        year: { type: 'integer', minimum: 2024 },
        weekNumber: { type: 'integer', minimum: 1, maximum: 53 },
        dayOfWeek: {
          anyOf: [
            { type: 'null' },
            {
              type: 'string',
              enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            },
          ],
        },
        servingsPlanned: { type: 'integer', minimum: 1 },
        createdAt: { type: 'string', format: 'date-time' },
      },
    };
  }

  static get relationMappings(): RelationMappings {
    return {
      recipe: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: Recipe,
        join: {
          from: 'weekly_meal_plans.recipe_id',
          to: 'recipes.id',
        },
      },
    };
  }
}
