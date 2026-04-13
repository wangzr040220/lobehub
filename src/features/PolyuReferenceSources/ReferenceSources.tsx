'use client';

import { Collapse, Flexbox, Icon, Text } from '@lobehub/ui';
import { BookOpen, ExternalLink, FileText } from 'lucide-react';
import { memo, useMemo } from 'react';

import type { PolyuReference } from '@/services/polyuAgent';

interface ReferenceSourcesProps {
  references: PolyuReference[];
  title?: string;
}

/**
 * PolyU Reference Sources Component
 *
 * Displays knowledge base reference sources in a collapsible panel.
 * Used in chat messages to show RAG retrieval sources.
 */
const ReferenceSources = memo<ReferenceSourcesProps>(({ references, title }) => {
  const displayTitle = title || '📚 参考来源';

  const items = useMemo(
    () =>
      references.map((ref, index) => ({
        children: (
          <Flexbox gap={8} key={ref.id}>
            <Flexbox gap={4} horizontal>
              <Icon icon={FileText} size={14} />
              <Text strong fontSize={13}>
                {ref.documentName}
              </Text>
              {ref.sourceUrl && (
                <a
                  href={ref.sourceUrl}
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8 }}
                  target="_blank"
                >
                  <Icon icon={ExternalLink} size={12} />
                  <Text fontSize={12}>来源</Text>
                </a>
              )}
            </Flexbox>
            <Text
              fontSize={12}
              style={{
                backgroundColor: 'var(--color-bg-secondary, rgba(0,0,0,0.04))',
                borderRadius: 6,
                padding: '8px 12px',
                whiteSpace: 'pre-wrap',
              }}
              type={'secondary'}
            >
              {ref.content}
            </Text>
            <Flexbox horizontal justify={'flex-end'}>
              <Text fontSize={11} type={'secondary'}>
                相关度: {(ref.score * 100).toFixed(1)}%
              </Text>
            </Flexbox>
          </Flexbox>
        ),
        key: `ref-${index}`,
        label: (
          <Flexbox gap={4} horizontal>
            <Icon icon={BookOpen} size={14} />
            <Text fontSize={13}>{ref.documentName}</Text>
            <Text fontSize={11} type={'secondary'}>
              ({(ref.score * 100).toFixed(0)}%)
            </Text>
          </Flexbox>
        ),
      })),
    [references],
  );

  if (!references.length) return null;

  return (
    <Collapse
      items={items}
      style={{ marginTop: 8 }}
      ghost
    />
  );
});

export default ReferenceSources;
