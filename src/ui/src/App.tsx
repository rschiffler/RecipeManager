import { useEffect, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { AppShell } from '@astryxdesign/core/AppShell';
import { TopNav, TopNavHeading, TopNavItem } from '@astryxdesign/core/TopNav';
import { Text } from '@astryxdesign/core/Text';
import { Banner } from '@astryxdesign/core/Banner';
import { api, type Lookups } from './api';
import RecipesPage from './pages/RecipesPage';
import MealPlanPage from './pages/MealPlanPage';
import TagsPage from './pages/TagsPage';

const styles = stylex.create({
  page: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '2rem 1rem 4rem',
  },
});

type Page = 'recipes' | 'meal-plan' | 'tags';

const RECIPES_HASH = '#/';
const MEAL_PLAN_HASH = '#/meal-plan';
const TAGS_HASH = '#/tags';

function pageFromHash(): Page {
  if (window.location.hash.startsWith(MEAL_PLAN_HASH)) return 'meal-plan';
  if (window.location.hash.startsWith(TAGS_HASH)) return 'tags';
  return 'recipes';
}

const EMPTY_LOOKUPS: Lookups = { ingredients: [], tags: [], units: [], tagTypes: [] };

export default function App() {
  const [page, setPage] = useState<Page>(() => pageFromHash());
  const [lookups, setLookups] = useState<Lookups>(EMPTY_LOOKUPS);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [lookupsError, setLookupsError] = useState<string | null>(null);

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLookups(await api.getLookups());
      } catch (err) {
        setLookupsError(err instanceof Error ? err.message : String(err));
      } finally {
        setLookupsLoading(false);
      }
    })();
  }, []);

  const refreshLookups = async () => {
    try {
      setLookups(await api.getLookups());
    } catch {
      // Tags page shows its own errors; keep existing lookups on failure.
    }
  };

  const goTo = (hash: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    } else {
      setPage(pageFromHash());
    }
  };

  return (
    <Theme theme={neutralTheme}>
      <AppShell
        height="auto"
        topNav={
          <TopNav label="Primary" heading={<TopNavHeading heading="Recipe Manager" />}>
            <TopNavItem
              label="Recipes"
              href={RECIPES_HASH}
              isSelected={page === 'recipes'}
              onClick={goTo(RECIPES_HASH)}
            />
            <TopNavItem
              label="Weekly meal plan"
              href={MEAL_PLAN_HASH}
              isSelected={page === 'meal-plan'}
              onClick={goTo(MEAL_PLAN_HASH)}
            />
            <TopNavItem
              label="Tags"
              href={TAGS_HASH}
              isSelected={page === 'tags'}
              onClick={goTo(TAGS_HASH)}
            />
          </TopNav>
        }
      >
        <div {...stylex.props(styles.page)}>
          {lookupsLoading ? (
            <Text type="body" color="secondary">
              Loading…
            </Text>
          ) : lookupsError != null ? (
            <Banner status="error" title={lookupsError} />
          ) : page === 'meal-plan' ? (
            <MealPlanPage lookups={lookups} />
          ) : page === 'tags' ? (
            <TagsPage lookups={lookups} onChanged={() => void refreshLookups()} />
          ) : (
            <RecipesPage lookups={lookups} />
          )}
        </div>
      </AppShell>
    </Theme>
  );
}
