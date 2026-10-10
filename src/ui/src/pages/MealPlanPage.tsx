import { useMemo, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Button } from '@astryxdesign/core/Button';
import { Text, Heading } from '@astryxdesign/core/Text';
import { ToggleButton, ToggleButtonGroup } from '@astryxdesign/core/ToggleButton';
import { Table, proportional } from '@astryxdesign/core/Table';
import { Card } from '@astryxdesign/core/Card';
import { List, ListItem } from '@astryxdesign/core/List';
import { Banner } from '@astryxdesign/core/Banner';
import {
  api,
  type Ingredient,
  type Lookups,
  type MealPlan,
} from '../api';
import { formatAmount } from '../formatAmount';
import { Badge } from '@astryxdesign/core';

const styles = stylex.create({
  pillWrap: {
    display: 'flex',
    flexWrap: 'wrap',
  },
});

interface ShoppingRow extends Record<string, unknown> {
  id: string;
  name: string;
  amount: string;
  notes: string;
}

function formatShoppingAmount(
  ingredient: Ingredient,
  unitNameById: Map<string, string>,
): string {
  const amount = formatAmount(ingredient.amount);
  const unitId = ingredient.unitId == null || ingredient.unitId === '' ? '' : String(ingredient.unitId);
  const unitName = unitId === '' ? '' : (unitNameById.get(unitId) ?? '');
  return [amount, unitName].filter(Boolean).join(' ');
}

function toShoppingRows(
  ingredients: Ingredient[],
  unitNameById: Map<string, string>,
): ShoppingRow[] {
  return ingredients.map((i) => ({
    id: String(i.id),
    name: i.name ?? '',
    amount: formatShoppingAmount(i, unitNameById),
    notes: (i.notes ?? '').trim(),
  }));
}

function toShoppingListText(rows: ShoppingRow[]): string {
  const lines = ['Ingredient\tAmount\tNotes'];
  for (const row of rows) {
    lines.push(`${row.name}\t${row.amount}\t${row.notes}`);
  }
  return lines.join('\n');
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText != null) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    const ok = document.execCommand('copy');
    if (!ok) throw new Error('Copy failed.');
  } finally {
    document.body.removeChild(textarea);
  }
}

export default function MealPlanPage({ lookups }: { lookups: Lookups }) {
  const [mpProteins, setMpProteins] = useState<string[]>([]);
  const [mpAdditional, setMpAdditional] = useState<string[]>([]);
  const [mpLoading, setMpLoading] = useState(false);
  const [mpSaving, setMpSaving] = useState(false);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [shoppingCopied, setShoppingCopied] = useState(false);
  const [notice, setNotice] = useState<{ status: 'success' | 'error'; title: string } | null>(null);

  const proteinTypeId = lookups.tagTypes.find((t) => t.name.toLowerCase() === 'protein')?.id;
  const proteinTags = proteinTypeId == null
    ? lookups.tags
    : lookups.tags.filter((t) => String(t.tagTypeId) === String(proteinTypeId));
  const additionalTags = proteinTypeId == null
    ? []
    : lookups.tags.filter((t) => String(t.tagTypeId) !== String(proteinTypeId));
  const proteinsCapped = mpProteins.length >= 3;

  const fetchMealPlan = async () => {
    if (mpProteins.length === 0) {
      setNotice({ status: 'error', title: 'Select at least one protein tag for the meal plan.' });
      return;
    }
    if (mpProteins.length > 3) {
      setNotice({ status: 'error', title: 'Pick at most 3 protein tags.' });
      return;
    }
    setMpLoading(true);
    try {
      setMealPlan(await api.getMealPlan([...mpProteins, ...mpAdditional].join(',')));
    } catch (err) {
      setNotice({ status: 'error', title: err instanceof Error ? err.message : String(err) });
    } finally {
      setMpLoading(false);
    }
  };

  const clearSelection = () => {
    setMpProteins([]);
    setMpAdditional([]);
  };

  const unitNameById = useMemo(
    () => new Map(lookups.units.map((u) => [String(u.id), u.name])),
    [lookups.units],
  );

  const shoppingRows = useMemo(
    () => toShoppingRows(mealPlan?.ingredients ?? [], unitNameById),
    [mealPlan, unitNameById],
  );

  const shoppingColumns = useMemo(
    () => [
      { key: 'name', header: 'Ingredient', width: proportional(2) },
      { key: 'amount', header: 'Amount', width: proportional(1) },
      { key: 'notes', header: 'Notes', width: proportional(2) },
    ],
    [],
  );

  const copyShoppingList = async () => {
    if (shoppingRows.length === 0) return;
    try {
      await copyTextToClipboard(toShoppingListText(shoppingRows));
      setShoppingCopied(true);
      setTimeout(() => setShoppingCopied(false), 2000);
    } catch (err) {
      setNotice({ status: 'error', title: err instanceof Error ? err.message : String(err) });
    }
  };

  const saveMealPlanForWeek = async () => {
    if (mealPlan == null || mealPlan.recipes.length === 0) return;
    setMpSaving(true);
    try {
      const saved = await api.saveMealPlan(mealPlan.recipes.map((r) => r.id));
      setNotice({
        status: 'success',
        title: `Saved ${saved.count} recipes for week ${saved.weekNumber}, ${saved.year}.`,
      });
    } catch (err) {
      setNotice({ status: 'error', title: err instanceof Error ? err.message : String(err) });
    } finally {
      setMpSaving(false);
    }
  };

  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Heading level={1}>Weekly meal plan</Heading>
        <Text type="body" color="secondary">
          Pick tags, then generate a plan.
        </Text>
      </VStack>

      {notice && (
        <Banner
          status={notice.status}
          title={notice.title}
          isDismissable
          onDismiss={() => setNotice(null)}
        />
      )}

      <Card>
        <VStack gap={3}>
          <VStack gap={2}>
            <HStack gap={2} vAlign="center">
              <Text type="body" weight="bold">
                Protein tags (select at least one and up to three)
              </Text>
              <Text type="supporting" color="secondary">
                {mpProteins.length === 0 ? 'None selected' : `${mpProteins.length} selected`}
              </Text>
            </HStack>
            {proteinTags.length === 0 ? (
              <Text type="body" color="secondary">
                No protein tags available. Add them on the Tags page.
              </Text>
            ) : (
              <ToggleButtonGroup
                label="Meal plan protein tags"
                type="multiple"
                value={mpProteins}
                onChange={setMpProteins}
                size="sm"
                xstyle={styles.pillWrap}
              >
                {proteinTags.map((t) => (
                  <ToggleButton
                    key={String(t.id)}
                    value={t.name}
                    label={t.name}
                    isDisabled={proteinsCapped && !mpProteins.includes(t.name)}
                  />
                ))}
              </ToggleButtonGroup>
            )}
          </VStack>
          <VStack gap={2}>
            <HStack gap={2} vAlign="center">
              <Text type="body" weight="bold">
                Additional tags (optional)
              </Text>
              <Text type="supporting" color="secondary">
                {mpAdditional.length === 0
                  ? 'No filter'
                  : `${mpAdditional.length} selected`}
              </Text>
            </HStack>
            {additionalTags.length === 0 ? (
              <Text type="body" color="secondary">
                No additional tags yet. Add them on the Tags page.
              </Text>
            ) : (
              <ToggleButtonGroup
                label="Meal plan additional tags"
                type="multiple"
                value={mpAdditional}
                onChange={setMpAdditional}
                size="sm"
                xstyle={styles.pillWrap}
              >
                {additionalTags.map((t) => (
                  <ToggleButton key={String(t.id)} value={t.name} label={t.name} />
                ))}
              </ToggleButtonGroup>
            )}
            <Text type="supporting" color="secondary">
              Each protein gets one recipe; additional tags filter those picks.
            </Text>
            <HStack gap={2} vAlign="center">
              <Button
                label="Get plan"
                isLoading={mpLoading}
                isDisabled={mpProteins.length === 0}
                clickAction={() => void fetchMealPlan()}
                variant='primary'
              />
              {(mpProteins.length > 0 || mpAdditional.length > 0) && (
                <Button
                  label="Clear"
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                />
              )}
            </HStack>
          </VStack>
          {mealPlan == null ? (
            <Text type="body" color="secondary">
              No plan loaded.
            </Text>
          ) : (
            <VStack gap={2}>
              <HStack gap={2} vAlign="center">
                <Text type="body" weight="bold">
                  Selected plan
                </Text>
                <Text type="supporting" color="secondary">
                  {mealPlan.recipes.length === 0
                    ? 'No recipes'
                    : `${mealPlan.recipes.length} recipes`}
                </Text>
                <div style={{ flex: 1 }} />
               
              </HStack>
              {(mealPlan.additionalTags.length > 0 || mealPlan.unfilteredProteins.length > 0) && (
                <Text type="supporting" color="secondary">
                  {mealPlan.additionalTags.length > 0 &&
                    `Filtered by ${mealPlan.additionalTags.join(', ')}.`}
                  {mealPlan.unfilteredProteins.length > 0 &&
                    ` No match for ${mealPlan.unfilteredProteins.join(',')} — showing unfiltered picks for those.`}
                </Text>
              )}

              <List hasDividers>
                {mealPlan.recipes.map((r) => (
                  
                    <ListItem key={String(r.id)} label={r.title} description={`#${r.id}`} startContent={r.tags?.map(t => <Badge key={t.id} label={t.name} variant='neutral' />)} />
                   
                
                ))}
              </List>
              <VStack maxWidth={200}>
                <Button
                  label="Select plan for week"
                  variant="primary"
                  size="sm"
                  isLoading={mpSaving}
                  isDisabled={mealPlan.recipes.length === 0}
                  clickAction={() => void saveMealPlanForWeek()}
                 
                />
              </VStack>
              <HStack gap={2} vAlign="center">
                <Text type="body" weight="bold">
                  Shopping list
                </Text>
                <Text type="supporting" color="secondary">
                  {shoppingRows.length === 0
                    ? 'No ingredients'
                    : `${shoppingRows.length} ingredients`}
                </Text>
                <div style={{ flex: 1 }} />
                <Button
                  label={shoppingCopied ? 'Copied!' : 'Copy list'}
                  variant="secondary"
                  size="sm"
                  isDisabled={shoppingRows.length === 0}
                  onClick={() => void copyShoppingList()}
                />
              </HStack>
              {shoppingRows.length === 0 ? (
                <Text type="body" color="secondary">
                  No ingredients in this plan.
                </Text>
              ) : (
                <Table
                  data={shoppingRows}
                  columns={shoppingColumns}
                  idKey="id"
                  density="compact"
                  dividers="rows"
                  textOverflow="wrap"
                />
              )}
            </VStack>
          )}
        </VStack>
      </Card>
    </VStack>
  );
}
