export interface Ingredient {
  id: number | string;
  name: string;
  category?: string;
  amount?: string | number | null;
  notes?: string | null;
  unitId?: number | string | null;
}

export interface Tag {
  id: number | string;
  name: string;
  tagTypeId?: number;
  tagType?: string;
}

export interface TagType {
  id: number | string;
  name: string;
}

export interface Unit {
  id: number | string;
  name: string;
  abbreviation?: string | null;
}

export interface Recipe {
  id: number | string;
  title: string;
  description?: string | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  servings?: number | null;
  instructions?: string[] | null;
  ingredients?: Ingredient[];
  tags?: Tag[];
}

export interface Lookups {
  ingredients: Ingredient[];
  tags: Tag[];
  units: Unit[];
  tagTypes: TagType[];
}

export interface IngredientPayload {
  id?: number;
  name?: string;
  amount?: string | number | null;
  unitId?: number | null;
  notes?: string | null;
}

export interface RecipePayload {
  title: string;
  description?: string | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  servings?: number | null;
  instructions?: string[];
  tagIds?: number[];
  ingredients?: IngredientPayload[];
}

export interface MealPlan {
  tags: string[];
  count: number;
  recipes: Recipe[];
  ingredients: Ingredient[];
}

export interface SavedMealPlanRow {
  id: number | string;
  recipeId: number | string;
  year: number;
  weekNumber: number;
  dayOfWeek?: string | null;
  servingsPlanned?: number | null;
  createdAt?: string;
}

export interface SaveMealPlanResult {
  year: number;
  weekNumber: number;
  count: number;
  plans: SavedMealPlanRow[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(
      typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Request failed: ${res.status}`,
    );
  }
  return body as T;
}

export const api = {
  listRecipes: (search = '') =>
    request<Recipe[]>(
      search ? `/api/recipes?search=${encodeURIComponent(search)}&limit=200` : '/api/recipes?limit=200',
    ),
  getRecipe: (id: number | string) => request<Recipe>(`/api/recipes/${id}`),
  createRecipe: (payload: RecipePayload) =>
    request<Recipe>('/api/recipes', { method: 'POST', body: JSON.stringify(payload) }),
  updateRecipe: (id: number | string, payload: RecipePayload) =>
    request<Recipe>(`/api/recipes/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteRecipe: (id: number | string) =>
    fetch(`/api/recipes/${id}`, { method: 'DELETE' }).then((res) => {
      if (!res.ok && res.status !== 204) throw new Error(`Delete failed: ${res.status}`);
    }),
  getLookups: () => request<Lookups>('/api/lookups'),
  listTags: () => request<Tag[]>('/api/tags'),
  createTag: (name: string, tagTypeId: number | string) =>
    request<Tag>('/api/tags', { method: 'POST', body: JSON.stringify({ name, tagTypeId }) }),
  updateTag: (id: number | string, name: string, tagTypeId: number | string) =>
    request<Tag>(`/api/tags/${id}`, { method: 'PUT', body: JSON.stringify({ name, tagTypeId }) }),
  getMealPlan: (tags: string) =>
    request<MealPlan>(`/api/meal-plan/weekly?tags=${encodeURIComponent(tags)}`),
  saveMealPlan: (recipeIds: (number | string)[], year?: number, weekNumber?: number) =>
    request<SaveMealPlanResult>('/api/meal-plan/weekly', {
      method: 'POST',
      body: JSON.stringify({ recipeIds, year, weekNumber }),
    }),
};
