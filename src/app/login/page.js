'use client';

import { useState } from 'react';
import { useAuth, getAuthErrorMessage } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Enter both your email and password.');
      return;
    }

    setLoading(true);

    const { data, error } = await signIn(trimmedEmail, password);

    if (error) {
      setError(getAuthErrorMessage(error));
      setLoading(false);
      return;
    }

    if (!data?.session) {
      setError('Sign-in did not return a session. Please try again.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.loginCard}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>👑</span>
            <span className={styles.logoText}>KINGS ARENA</span>
          </div>
          <h1 className={styles.title}>Welcome Back</h1>
          <p className={styles.subtitle}>Sign in to your account to continue</p>
          
          {error && <div className={styles.error}>{error}</div>}
          
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="your@email.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          
          <p className={styles.signupText}>
            Don&apos;t have an account? <a href="/signup" className={styles.signupLink}>Sign up</a>
          </p>
        </div>
      </div>
    </div>
  );
}
