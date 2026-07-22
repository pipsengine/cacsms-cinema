'use client';

import Link from 'next/link';
import { LayoutTemplate, Video } from 'lucide-react';
import type { DataProvenance } from '../types';
import styles from '../video-assembly.module.css';

interface VideoHeaderProps {
  title: string;
  description: string;
  provenance: DataProvenance;
  onShowPresentation: () => void;
  onShowEmpty: () => void;
}

export function VideoHeader({
  title,
  description,
  provenance,
  onShowPresentation,
  onShowEmpty,
}: VideoHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <p className={styles.eyebrow}>
          <Video size={13} aria-hidden />
          CACSMS production capability
        </p>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">Control Room</Link>
          <span aria-hidden>/</span>
          <Link href="/storyboards">Storyboard Engine</Link>
          <span aria-hidden>/</span>
          <span>Video Assembly</span>
        </nav>
        <h1>{title}</h1>
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
