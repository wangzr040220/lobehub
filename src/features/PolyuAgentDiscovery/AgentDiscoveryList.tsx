'use client';

import { Empty, Flexbox, Input, Pagination, Select, Spin } from '@lobehub/ui';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { polyuAgentService } from '@/services/polyuAgent';
import type { PolyuAgent, PolyuAgentListParams } from '@/services/polyuAgent';

import AgentCard from './AgentCard';

/**
 * PolyU Agent Discovery List
 *
 * Displays a grid of approved public agents from the PolyU BFF API.
 * Supports filtering by subject category, department, and keyword search.
 */
const AgentDiscoveryList = memo(() => {
  const { t } = useTranslation('common');

  const [agents, setAgents] = useState<PolyuAgent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [keyword, setKeyword] = useState('');
  const [subjectTag, setSubjectTag] = useState<string | undefined>(undefined);
  const [categories, setCategories] = useState<string[]>([]);

  // Load categories on mount
  useEffect(() => {
    polyuAgentService.getAgentCategories().then(setCategories).catch(() => {
      // Use default categories on error
      setCategories(['APSS', 'BRE', 'CBS', 'CC', 'CPCE', 'DES', 'EIE', 'FB', 'FH', 'FS', 'HTI']);
    });
  }, []);

  // Load agents
  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const params: PolyuAgentListParams = {
        page,
        pageSize,
        visibility: 'public',
      };
      if (keyword.trim()) params.keyword = keyword.trim();
      if (subjectTag) params.subjectTag = subjectTag;

      const result = await polyuAgentService.listAgents(params);
      setAgents(result.agents);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load agents:', error);
      setAgents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, subjectTag]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Handle search
  const handleSearch = useCallback((value: string) => {
    setKeyword(value);
    setPage(1); // Reset to first page on search
  }, []);

  // Handle category filter
  const handleCategoryChange = useCallback((value: string | undefined) => {
    setSubjectTag(value || undefined);
    setPage(1);
  }, []);

  // Handle agent click
  const handleAgentClick = useCallback((agent: PolyuAgent) => {
    // Navigate to chat with this agent
    // This will be connected to LobeChat's routing system
    window.dispatchEvent(
      new CustomEvent('polyu:start-agent-chat', { detail: { agentId: agent.id, agent } }),
    );
  }, []);

  return (
    <Flexbox gap={20} style={{ padding: '20px 0' }}>
      {/* Search and Filter Bar */}
      <Flexbox gap={12} horizontal>
        <Input
          allowClear
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={t('searchAgents') || '搜索智能体...'}
          style={{ flex: 1 }}
          value={keyword}
        />
        <Select
          allowClear
          onChange={handleCategoryChange}
          options={categories.map((cat) => ({ label: cat, value: cat }))}
          placeholder={t('filterBySubject') || '按学科筛选'}
          style={{ minWidth: 160 }}
          value={subjectTag}
        />
      </Flexbox>

      {/* Agent Grid */}
      <Spin spinning={loading}>
        {agents.length === 0 && !loading ? (
          <Empty description={t('noAgentsFound') || '暂无智能体'} />
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            }}
          >
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} onClick={handleAgentClick} />
            ))}
          </div>
        )}
      </Spin>

      {/* Pagination */}
      {total > pageSize && (
        <Flexbox horizontal justify={'center'}>
          <Pagination
            current={page}
            onChange={(p) => setPage(p)}
            pageSize={pageSize}
            total={total}
          />
        </Flexbox>
      )}
    </Flexbox>
  );
});

export default AgentDiscoveryList;
