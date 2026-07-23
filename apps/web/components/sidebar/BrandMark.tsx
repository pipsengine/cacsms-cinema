import styles from './Sidebar.module.css';

export function BrandMark() {
  return (
    <div className={styles.brand} aria-label="CACSMS Autonomous">
      <span className={styles.brandMark} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className={styles.brandCopy}>
        <strong>CACSMS Autonomous</strong>
        <small>Content Production Platform</small>
      </span>
    </div>
  );
}
