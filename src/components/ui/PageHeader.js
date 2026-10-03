import styles from './PageHeader.module.css';

export function PageHeader({ title, description, action, children }) {
  return (
    <header className={styles.header}>
      <div className={styles.content}>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
      {children && <div className={styles.children}>{children}</div>}
    </header>
  );
}
