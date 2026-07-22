'use client';

import Link from 'next/link';
import { Image as ImageIcon } from 'lucide-react';
import styles from '../image-generator.module.css';

export function ImageGeneratorHeader() {
  return (
    <header className={styles.pageHeader}>
      <div>
        <p className={styles.eyebrow}>
          <ImageIcon size={13} aria-hidden />
          CACSMS production capability
        </p>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">Control Room</Link>
          <span aria-hidden>/</span>
          <span>Image Generator</span>
        </nav>
        <h1>Image Generator</h1>
        <p>
          Enqueue cinematic still jobs, inspect the selected job’s stage progress, and review validated
          candidates. Fleet metrics live on the Control Room.
        </p>
      </div>
    </header>
  );
}
