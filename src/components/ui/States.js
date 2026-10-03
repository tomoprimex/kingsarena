import styles from './States.module.css';

export function LoadingState({ label = 'Loading...' }) {
  return (
    <div className={styles.loadingState} role='status' aria-live='polite'>
      <div className={styles.spinner} aria-hidden='true' />
      <span className={styles.label}>{label}</span>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className={styles.emptyState}>
      {icon && <div className={styles.icon} aria-hidden='true'>{icon}</div>}
      {title && <h3 className={styles.title}>{title}</h3>}
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className={styles.errorState} role='alert'>
      <p className={styles.message}>
        {error?.message ?? 'An unknown error occurred'}
      </p>
      {onRetry && (
        <button
          className={styles.retryButton}
          onClick={onRetry}
          type='button'
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function SuccessBanner({ message }) {
  return (
    <div className={styles.successBanner} role='status' aria-live='polite'>
      <span className={styles.checkIcon} aria-hidden='true'>✓</span>
      <p className={styles.message}>{message}</p>
    </div>
  );
}

export function SkeletonRows({ rows = 4 }) {
  return (
    <div className={styles.skeletonRows} aria-hidden='true'>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles.skeletonRow}>
          <div className={styles.skeletonCell} />
          <div className={styles.skeletonCell} />
          <div className={styles.skeletonCell} />
        </div>
      ))}
    </div>
  );
}
