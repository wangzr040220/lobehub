'use client';

import { Avatar, Card, Flexbox, Tag, Text } from '@lobehub/ui';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { DEFAULT_AVATAR } from '@/const/meta';

import type { SsoAgent } from '@/services/ssoAgent';

interface AgentCardProps {
  agent: SsoAgent;
  onClick?: (agent: SsoAgent) => void;
}

/**
 * SmartAA Agent Card Component
 *
 * Displays agent information in a card format for the discovery page.
 * Shows name, description, subject tags, call count, and review status.
 */
const AgentCard = memo<AgentCardProps>(({ agent, onClick }) => {
  const { t } = useTranslation('common');

  const subjectTags = useMemo(() => {
    if (!agent.subjectTags?.length) return [];
    return agent.subjectTags.slice(0, 3); // Show max 3 tags
  }, [agent.subjectTags]);

  const modeLabel = useMemo(() => {
    switch (agent.mode) {
      case 'chat': return '💬 Chat';
      case 'completion': return '✍️ Completion';
      case 'workflow': return '🔄 Workflow';
      default: return agent.mode;
    }
  }, [agent.mode]);

  return (
    <Card
      hoverable
      onClick={() => onClick?.(agent)}
      style={{ cursor: onClick ? 'pointer' : 'default', height: '100%' }}
    >
      <Flexbox gap={12}>
        <Flexbox align={'flex-start'} gap={8} horizontal>
          <Avatar
            avatar={agent.avatarUrl || DEFAULT_AVATAR}
            shape={'square'}
            size={48}
          />
          <Flexbox flex={1} gap={4}>
            <Text ellipsis strong fontSize={16}>
              {agent.name}
            </Text>
            <Text ellipsis type={'secondary'} fontSize={12}>
              {modeLabel} · {agent.creatorName || t('unknownAuthor')}
            </Text>
          </Flexbox>
        </Flexbox>

        <Text
          ellipsis={{ expandable: false, rows: 2, symbol: '...' }}
          style={{ minHeight: 40 }}
          type={'secondary'}
        >
          {agent.description || t('noDescription')}
        </Text>

        <Flexbox gap={4} horizontal wrap={'wrap'}>
          {subjectTags.map((tag) => (
            <Tag key={tag} style={{ margin: 0 }}>
              {tag}
            </Tag>
          ))}
          {agent.courseCode && (
            <Tag color={'blue'} style={{ margin: 0 }}>
              {agent.courseCode}
            </Tag>
          )}
        </Flexbox>

        <Flexbox horizontal justify={'space-between'}>
          <Text fontSize={12} type={'secondary'}>
            🔥 {agent.totalCalls} {t('calls')}
          </Text>
          <Text fontSize={12} type={'secondary'}>
            {agent.todayCalls} {t('todayCalls')}
          </Text>
        </Flexbox>
      </Flexbox>
    </Card>
  );
});

export default AgentCard;
