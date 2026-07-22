'use client';

import Link from 'next/link';
import { Clapperboard, LayoutTemplate } from 'lucide-react';
import styles from '../storyboard-engine.module.css';

interface StoryboardHeaderProps {
  description: string;
  onShowPresentation: () => void;
  onShowEmpty: () => void;
  provenance: 'presentation' | 'live' | 'empty';
}

export function StoryboardHeader({
  description,
  onShowPresentation,
  onShowEmpty,
  provenance,
}: StoryboardHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <p className={styles.eyebrow}>
          <Clapperboard size={13} aria-hidden />
          CACSMS production capability
        </p>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">Control Room</Link>
          <span aria-hidden>/</span>
          <span>Visual Production</span>
          <span aria-hidden>/</span>
          <span>Scene &amp; Cinematography</span>
          <span aria-hidden>/</span>
          <span>Storyboard Workspace</span>
        </nav>
        <h1>Storyboard Workspace</h1>
        <p>{description}</p>
      </div>
      <div className={styles.headerActions}>
        <button
          type="button"
          className={styles.ghostBtn}
          onClick={onShowEmpty}
          aria-pressed={provenance === 'empty'}
        >
          Empty state
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={onShowPresentation}
          aria-pressed={provenance === 'presentation'}
        >
          <LayoutTemplate size={15} aria-hidden />
          Presentation layout
        </button>
      </div>
    </header>
  );
}
