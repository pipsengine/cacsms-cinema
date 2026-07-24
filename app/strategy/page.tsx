import type { Metadata } from 'next';
import { StrategyOverviewWorkspace } from '@/apps/web/components/strategy/StrategyOverviewWorkspace';

export const metadata: Metadata = {
  title: 'Strategy Overview',
};

export default function StrategyPage() {
  return <StrategyOverviewWorkspace />;
}
