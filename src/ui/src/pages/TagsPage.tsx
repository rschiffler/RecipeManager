import { useEffect, useMemo, useState } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Button } from '@astryxdesign/core/Button';
import { Text, Heading } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Card } from '@astryxdesign/core/Card';
import { Badge } from '@astryxdesign/core/Badge';
import { Table, proportional } from '@astryxdesign/core/Table';
import { Banner } from '@astryxdesign/core/Banner';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { api, type Lookups, type Tag } from '../api';

interface TagRow extends Record<string, unknown> {
  id: string;
  name: string;
  tagType: string;
}

export default function TagsPage({
  lookups,
  onChanged,
}: {
  lookups: Lookups;
  onChanged: () => void;
}) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [tagTypeId, setTagTypeId] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ status: 'success' | 'error'; title: string } | null>(null);

  const refresh = async () => {
    setTags(await api.listTags());
  };

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (err) {
        setNotice({ status: 'error', title: err instanceof Error ? err.message : String(err) });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Default new tags to the non-protein ("additional") type when available.
  useEffect(() => {
    if (tagTypeId === '' && lookups.tagTypes.length > 0) {
      const additional = lookups.tagTypes.find((t) => t.name.toLowerCase() !== 'protein');
      setTagTypeId(String((additional ?? lookups.tagTypes[0]).id));
    }
  }, [lookups.tagTypes, tagTypeId]);

  const typeOptions = useMemo(
    () => lookups.tagTypes.map((t) => ({ value: String(t.id), label: t.name })),
    [lookups.tagTypes],
  );

  const rows: TagRow[] = useMemo(
    () =>
      tags.map((t) => ({
        id: String(t.id),
        name: t.name,
        tagType: t.tagType ?? '',
      })),
    [tags],
  );

  const columns = useMemo(
    () => [
      { key: 'name', header: 'Tag', width: proportional(2) },
      { key: 'tagType', header: 'Type', width: proportional(1) },
    ],
    [],
  );

  const addTag = async () => {
    if (name.trim().length === 0) {
      setNotice({ status: 'error', title: 'Tag name is required.' });
      return;
    }
    if (tagTypeId === '') {
      setNotice({ status: 'error', title: 'Pick a tag type.' });
      return;
    }
    setSaving(true);
    try {
      const created = await api.createTag(name.trim(), Number(tagTypeId));
      setNotice({ status: 'success', title: `Added tag "${created.name}".` });
      setName('');
      await refresh();
      onChanged();
    } catch (err) {
      setNotice({ status: 'error', title: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Heading level={1}>Tags</Heading>
        <Text type="body" color="secondary">
          Protein tags are the primary tag on a recipe; other types are additional tags. New
          tags become available in the recipe editor immediately.
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
          <HStack gap={2} vAlign="center">
            <Heading level={2}>Add tag</Heading>
            <div style={{ flex: 1 }} />
            <Text type="supporting" color="secondary">
              {tags.length} tags
            </Text>
          </HStack>
          <HStack gap={2} vAlign="end">
            <TextInput
              label="Tag name"
              placeholder="e.g. Freezable"
              value={name}
              onChange={setName}
            />
            <Selector
              label="Type"
              placeholder="Pick a type"
              options={typeOptions}
              value={tagTypeId}
              onChange={(v) => setTagTypeId(v ?? '')}
            />
            <Button
              label="Add tag"
              variant="primary"
              isLoading={saving}
              isDisabled={name.trim().length === 0 || tagTypeId === ''}
              clickAction={() => void addTag()}
            />
          </HStack>
        </VStack>
      </Card>

      <Card>
        <VStack gap={3}>
          <Heading level={2}>Existing tags</Heading>
          {loading ? (
            <Text type="body" color="secondary">
              Loading…
            </Text>
          ) : rows.length === 0 ? (
            <EmptyState title="No tags yet" />
          ) : (
            <Table
              data={rows}
              columns={columns}
              idKey="id"
              density="compact"
              dividers="rows"
              textOverflow="wrap"
            />
          )}
          <HStack gap={1}>
            {lookups.tagTypes.map((t) => (
              <Badge
                key={String(t.id)}
                variant="info"
                label={`${t.name}: ${tags.filter((tag) => String(tag.tagTypeId) === String(t.id)).length}`}
              />
            ))}
          </HStack>
        </VStack>
      </Card>
    </VStack>
  );
}
