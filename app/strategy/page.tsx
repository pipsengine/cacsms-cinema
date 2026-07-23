import type { Metadata } from 'next';
import { StrategyWorkspace } from '@/apps/web/components/strategy/StrategyWorkspace';

export const metadata: Metadata = {
  title: 'Strategy Overview',
};

export default function StrategyPage() {
  return <StrategyWorkspace />;
}
