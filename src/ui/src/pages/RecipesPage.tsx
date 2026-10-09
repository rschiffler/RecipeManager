import { useCallback, useEffect, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Button } from '@astryxdesign/core/Button';
import { Text, Heading } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { CheckboxList } from '@astryxdesign/core/CheckboxList';
import { CheckboxListItem } from '@astryxdesign/core/CheckboxList';
import { Selector } from '@astryxdesign/core/Selector';
import { Card } from '@astryxdesign/core/Card';
import { Badge } from '@astryxdesign/core/Badge';
import { List, ListItem } from '@astryxdesign/core/List';
import { Banner } from '@astryxdesign/core/Banner';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import {
  api,
  type Ingredient,
  type Lookups,
  type Recipe,
  type RecipePayload,
} from '../api';
import { formatAmount } from '../formatAmount';

const styles = stylex.create({
  columns: {
    display: 'grid',
    gridTemplateColumns: '340px 1fr',
    gap: 16,
    alignItems: 'start',
    '@media (max-width: 900px)': {
      gridTemplateColumns: '1fr',
    },
  },
  listScroll: {
    maxHeight: '60vh',
    overflowY: 'auto',
  },
  ingredientRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 90px 150px 1fr auto',
    gap: 8,
    alignItems: 'end',
    '@media (max-width: 700px)': {
      gridTemplateColumns: '1fr 80px',
    },
  },
  numberRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 12,
    '@media (max-width: 600px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

interface IngredientRow {
  key: number;
  name: string;
  amount: string;
  unitId: string;
  notes: string;
}

let rowKey = 0;
const blankRow = (): IngredientRow => ({ key: ++rowKey, name: '', amount: '', unitId: '', notes: '' });

function toRow(i: Ingredient): IngredientRow {
  return {
    key: ++rowKey,
    name: i.name ?? '',
    amount: formatAmount(i.amount),
    unitId: i.unitId == null || i.unitId === '' ? '' : String(i.unitId),
    notes: i.notes ?? '',
  };
}

export default function RecipesPage({ lookups }: { lookups: Lookups }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ status: 'success' | 'error'; title: string } | null>(null);

  // Editor form state.
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prep, setPrep] = useState<number | null>(null);
  const [cook, setCook] = useState<number | null>(null);
  const [servings, setServings] = useState<number | null>(null);
  const [instructions, setInstructions] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [rows, setRows] = useState<IngredientRow[]>([blankRow()]);

  const proteinTypeId = lookups.tagTypes.find((t) => t.name.toLowerCase() === 'protein')?.id;
  const primaryTags = proteinTypeId == null
    ? []
    : lookups.tags.filter((t) => String(t.tagTypeId) === String(proteinTypeId));
  const additionalTags = proteinTypeId == null
    ? lookups.tags
    : lookups.tags.filter((t) => String(t.tagTypeId) !== String(proteinTypeId));
  const primaryOptions = [
    { value: '', label: 'No primary tag' },
    ...primaryTags.map((t) => ({ value: String(t.id), label: t.name })),
  ];

  // Partition into primary (first protein tag) + additional. Derived every
  // render so late-arriving lookups re-partition automatically, and every id
  // in tagIds is always preserved on save — nothing can be dropped.
  const isProteinTag = (id: string) => primaryTags.some((t) => String(t.id) === id);
  const primaryTagId = tagIds.find(isProteinTag) ?? '';
  const additionalTagIds = tagIds.filter((id) => !isProteinTag(id));
  const changePrimaryTag = (value: string) =>
    setTagIds((prev) => {
      const rest = prev.filter((id) => !primaryTags.some((t) => String(t.id) === id));
      return value === '' ? rest : [...rest, value];
    });
  const changeAdditionalTags = (values: string[]) =>
    setTagIds((prev) => [
      ...prev.filter((id) => primaryTags.some((t) => String(t.id) === id)),
      ...values,
    ]);

  const refresh = useCallback(async (q: string) => {
    setRecipes(await api.listRecipes(q));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setRecipes(await api.listRecipes(''));
      } catch (err) {
        setNotice({ status: 'error', title: err instanceof Error ? err.message : String(err) });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => refresh(search).catch(() => undefined), 250);
    return () => clearTimeout(t);
  }, [search, refresh]);

  const loadIntoForm = (recipe: Recipe) => {
    setSelectedId(String(recipe.id));
    setTitle(recipe.title ?? '');
    setDescription(recipe.description ?? '');
    setPrep(recipe.prepTimeMinutes ?? null);
    setCook(recipe.cookTimeMinutes ?? null);
    setServings(recipe.servings ?? null);
    setInstructions((recipe.instructions ?? []).join('\n'));
    setTagIds((recipe.tags ?? []).map((t) => String(t.id)));
    setRows((recipe.ingredients ?? []).map(toRow));
    if ((recipe.ingredients ?? []).length === 0) setRows([blankRow()]);
    setNotice(null);
  };

  const selectRecipe = async (id: number | string) => {
    try {
      loadIntoForm(await api.getRecipe(id));
    } catch (err) {
      setNotice({ status: 'error', title: err instanceof Error ? err.message : String(err) });
    }
  };

  const newRecipe = () => {
    setSelectedId(null);
    setTitle('');
    setDescription('');
    setPrep(null);
    setCook(null);
    setServings(null);
    setInstructions('');
    setTagIds([]);
    setRows([blankRow()]);
    setNotice(null);
  };

  const save = async () => {
    if (title.trim().length === 0) {
      setNotice({ status: 'error', title: 'Title is required.' });
      return;
    }
    const payload: RecipePayload = {
      title: title.trim(),
      description: description.trim() === '' ? null : description.trim(),
      prepTimeMinutes: prep,
      cookTimeMinutes: cook,
      servings,
      instructions: instructions.split('\n').map((s) => s.trim()).filter(Boolean),
      tagIds: tagIds.map(Number).filter(Number.isFinite),
      ingredients: rows
        .filter((r) => r.name.trim().length > 0)
        .map((r) => ({
          name: r.name.trim(),
          amount: r.amount.trim() === '' ? null : r.amount.trim(),
          unitId: r.unitId === '' ? null : Number(r.unitId),
          notes: r.notes.trim() === '' ? null : r.notes.trim(),
        })),
    };
    setSaving(true);
    try {
      const saved =
        selectedId == null ? await api.createRecipe(payload) : await api.updateRecipe(selectedId, payload);
      setNotice({ status: 'success', title: `Saved "${saved.title}" (#${saved.id}).` });
      await refresh(search);
      loadIntoForm(saved);
    } catch (err) {
      setNotice({ status: 'error', title: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (selectedId == null) return;
    if (!window.confirm(`Delete recipe #${selectedId}?`)) return;
    try {
      await api.deleteRecipe(selectedId);
      setNotice({ status: 'success', title: 'Recipe deleted.' });
      newRecipe();
      await refresh(search);
    } catch (err) {
      setNotice({ status: 'error', title: err instanceof Error ? err.message : String(err) });
    }
  };

  const unitOptions = [
    { value: '', label: 'No unit' },
    ...lookups.units.map((u) => ({ value: String(u.id), label: u.name })),
  ];

  return (
    <VStack gap={4}>
      <HStack gap={3} vAlign="center">
        <VStack gap={1}>
          <Heading level={1}>Recipes</Heading>
          <Text type="body" color="secondary">
            Edit an existing recipe or add a new one
          </Text>
        </VStack>
        <div style={{ flex: 1 }} />
        <TextInput
          label="Search recipes"
          isLabelHidden
          placeholder="Search recipes…"
          hasClear
          value={search}
          onChange={setSearch}
        />
        <Button label="New recipe" variant="primary" onClick={newRecipe} />
      </HStack>

      {notice && (
        <Banner
          status={notice.status}
          title={notice.title}
          isDismissable
          onDismiss={() => setNotice(null)}
        />
      )}

      <div {...stylex.props(styles.columns)}>
        <Card>
          <VStack gap={3}>
            <HStack gap={2} vAlign="center">
              <Heading level={2}>Recipes</Heading>
              <div style={{ flex: 1 }} />
              <Text type="supporting" color="secondary">
                {recipes.length} recipes
              </Text>
            </HStack>
            {loading ? (
              <Text type="body" color="secondary">
                Loading…
              </Text>
            ) : recipes.length === 0 ? (
              <EmptyState title="No recipes found" />
            ) : (
              <div {...stylex.props(styles.listScroll)}>
                <List hasDividers>
                  {recipes.map((r) => (
                    <ListItem
                      key={String(r.id)}
                      label={r.title}
                      description={`#${r.id} · ${(r.ingredients ?? []).length} ingredients`}
                      isSelected={selectedId === String(r.id)}
                      onClick={() => void selectRecipe(r.id)}
                      endContent={
                        <HStack gap={1}>
                          {(r.tags ?? []).slice(0, 3).map((t) => (
                            <Badge key={String(t.id)} variant='neutral' label={t.name} />
                          ))}
                        </HStack>
                      }
                    />
                  ))}
                </List>
              </div>
            )}
          </VStack>
        </Card>

        <Card>
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>
                {selectedId == null ? 'New recipe' : `Editing #${selectedId}`}
              </Heading>
              <Text type="supporting" color="secondary">
                Edit every field, including ingredients and tags.
              </Text>
            </VStack>

            <TextInput label="Title" isRequired value={title} onChange={setTitle} />
            <TextArea label="Description" value={description} onChange={setDescription} rows={3} />

            <div {...stylex.props(styles.numberRow)}>
              <NumberInput label="Prep (min)" value={prep} onChange={setPrep} min={0} />
              <NumberInput label="Cook (min)" value={cook} onChange={setCook} min={0} />
              <NumberInput label="Servings" value={servings} onChange={setServings} min={1} />
            </div>

            <TextArea
              label="Instructions (one step per line)"
              value={instructions}
              onChange={setInstructions}
              rows={6}
            />

            <Selector
              label="Primary tag"
              description="The main protein for this recipe. Pick from existing tags."
              placeholder="No primary tag"
              options={primaryOptions}
              value={primaryTagId}
              onChange={(v) => changePrimaryTag(v ?? '')}
            />

            <CheckboxList label="Additional tags" value={additionalTagIds} onChange={changeAdditionalTags}>
              {additionalTags.map((t) => (
                <CheckboxListItem key={String(t.id)} value={String(t.id)} label={t.name} />
              ))}
            </CheckboxList>
            <Text type="supporting" color="secondary">
              New tags can be added on the Tags page.
            </Text>

            <VStack gap={2}>
              <Text type="body" weight="bold">
                Ingredients
              </Text>
              {rows.map((row) => (
                <div key={row.key} {...stylex.props(styles.ingredientRow)}>
                  <TextInput
                    label="Ingredient"
                    isLabelHidden
                    placeholder="Ingredient name"
                    value={row.name}
                    onChange={(v) =>
                      setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, name: v } : r)))
                    }
                  />
                  <TextInput
                    label="Amount"
                    isLabelHidden
                    placeholder="Amt"
                    value={row.amount}
                    onChange={(v) =>
                      setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, amount: v } : r)))
                    }
                  />
                  <Selector
                    label="Unit"
                    isLabelHidden
                    placeholder="No unit"
                    options={unitOptions}
                    value={row.unitId}
                    onChange={(v) =>
                      setRows((prev) =>
                        prev.map((r) => (r.key === row.key ? { ...r, unitId: v ?? '' } : r)),
                      )
                    }
                  />
                  <TextInput
                    label="Notes"
                    isLabelHidden
                    placeholder="Notes (e.g. chopped)"
                    value={row.notes}
                    onChange={(v) =>
                      setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, notes: v } : r)))
                    }
                  />
                  <Button
                    label="Remove ingredient"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button label="Add ingredient" variant="secondary" size="sm" onClick={() => setRows((p) => [...p, blankRow()])} />
            </VStack>

            <HStack gap={2}>
              <Button label="Save" variant="primary" isLoading={saving} clickAction={() => void save()} />
              {selectedId != null && (
                <Button label="Delete" variant="destructive" onClick={() => void remove()} />
              )}
            </HStack>
          </VStack>
        </Card>
      </div>
    </VStack>
  );
}
