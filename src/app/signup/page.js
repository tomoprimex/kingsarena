'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth, getAuthErrorMessage } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import styles from './signup.module.css';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    displayName: '',
    profilePicture: '',
    games: {
      dls: false,
      efootball: false,
      fcmobile: false,
      cod: false,
    },
    terms: false,
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      if (name === 'terms') {
        setFormData({ ...formData, [name]: checked });
      } else if (name === 'games') {
        setFormData({
          ...formData,
          games: { ...formData.games, [value]: checked },
        });
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!formData.terms) {
      setError('You must agree to the terms and conditions');
      return;
    }

    setLoading(true);

    const metadata = {
      username: formData.username,
      display_name: formData.displayName,
      profile_picture: formData.profilePicture,
      game_dls: formData.games.dls,
      game_efootball: formData.games.efootball,
      game_fcmobile: formData.games.fcmobile,
      game_cod: formData.games.cod,
    };

    const { data, error } = await signUp(formData.email, formData.password, metadata);

    if (error) {
      setError(getAuthErrorMessage(error));
      setLoading(false);
      return;
    }

    // Email confirmation is enabled in Supabase, so signUp returns a user but no
    // session until the address is verified. Do not redirect to a protected route.
    if (!data?.session) {
      setNotice(
        'Account created. Check your email for a verification link, then sign in.'
      );
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.signupCard}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>👑</span>
            <span className={styles.logoText}>KINGS ARENA</span>
          </div>
          <h1 className={styles.title}>Create Account</h1>
          <p className={styles.subtitle}>Join the elite gaming community</p>
          
          {error && <div className={styles.error}>{error}</div>}

          {notice && <div className={styles.notice}>{notice}</div>}

          {!notice && (
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
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                placeholder="your_username"
                required
                minLength={3}
                maxLength={20}
                value={formData.username}
                onChange={handleChange}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="displayName">Display Name</label>
              <input
                type="text"
                id="displayName"
                name="displayName"
                placeholder="Your display name"
                required
                maxLength={30}
                value={formData.displayName}
                onChange={handleChange}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="profilePicture">Profile Picture URL (optional)</label>
              <input
                type="url"
                id="profilePicture"
                name="profilePicture"
                placeholder="https://example.com/avatar.jpg"
                value={formData.profilePicture}
                onChange={handleChange}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Game Preferences</label>
              <div className={styles.gamePreferences}>
                <label className={styles.gameCheckbox}>
                  <input
                    type="checkbox"
                    name="games"
                    value="dls"
                    checked={formData.games.dls}
                    onChange={handleChange}
                  />
                  <span>Dream League Soccer</span>
                </label>
                <label className={styles.gameCheckbox}>
                  <input
                    type="checkbox"
                    name="games"
                    value="efootball"
                    checked={formData.games.efootball}
                    onChange={handleChange}
                  />
                  <span>eFootball</span>
                </label>
                <label className={styles.gameCheckbox}>
                  <input
                    type="checkbox"
                    name="games"
                    value="fcmobile"
                    checked={formData.games.fcmobile}
                    onChange={handleChange}
                  />
                  <span>FC Mobile</span>
                </label>
                <label className={styles.gameCheckbox}>
                  <input
                    type="checkbox"
                    name="games"
                    value="cod"
                    checked={formData.games.cod}
                    onChange={handleChange}
                  />
                  <span>Call of Duty</span>
                </label>
              </div>
            </div>
            <div className={styles.terms}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  name="terms"
                  checked={formData.terms}
                  onChange={handleChange}
                  required
                />
                <span>I agree to the Terms of Service and Privacy Policy</span>
              </label>
            </div>
            
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
          )}
          
          <p className={styles.loginText}>
            Already have an account? <Link href="/login" className={styles.loginLink}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
