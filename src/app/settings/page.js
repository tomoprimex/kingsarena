'use client';

import { useCallback, useEffect, useState } from 'react';
import { DataBoundary, EmptyState, SuccessBanner } from '../../components/ui';
import { useRequireAuth } from '../../contexts/AuthContext';
import { fetchMyProfile } from '../../lib/data/client';
import { changePassword, updateProfile } from '../../lib/mutations/profile';
import { useRevalidate } from '../../lib/mutations/revalidate';
import { GAMES, GAME_PROFILE_FLAGS } from '../../lib/constants';
import styles from './settings.module.css';

const USERNAME_MIN = 3;
const USERNAME_MAX = 20;
const DISPLAY_NAME_MIN = 1;
const DISPLAY_NAME_MAX = 30;
const PASSWORD_MIN = 8;
const DELETE_PHRASE = 'DELETE';

const EMPTY_FORM = {
  username: '',
  display_name: '',
  bio: '',
  profile_picture: '',
  game_dls: false,
  game_efootball: false,
  game_fcmobile: false,
  game_cod: false,
};

const EMPTY_PASSWORDS = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

function toForm(profile) {
  return {
    username: profile.username ?? '',
    display_name: profile.display_name ?? '',
    bio: profile.bio ?? '',
    profile_picture: profile.profile_picture ?? '',
    game_dls: profile.game_dls === true,
    game_efootball: profile.game_efootball === true,
    game_fcmobile: profile.game_fcmobile === true,
    game_cod: profile.game_cod === true,
  };
}

export default function SettingsPage() {
  const { user, loading: authLoading, configError } = useRequireAuth();
  const revalidate = useRevalidate();

  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState(EMPTY_FORM);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState('');

  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const applyProfileResult = useCallback(({ data, error }) => {
    if (error) {
      setProfile(null);
      setLoadError(error);
    } else if (!data) {
      setProfile(null);
      setLoadError({ message: 'No profile is linked to this account yet.' });
    } else {
      setProfile(data);
      setForm(toForm(data));
      setLoadError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading || !user) return undefined;
    let active = true;

    fetchMyProfile(user.id).then((result) => {
      if (active) applyProfileResult(result);
    });

    return () => {
      active = false;
    };
  }, [authLoading, user, applyProfileResult]);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const result = await fetchMyProfile(user.id);
    applyProfileResult(result);
  }, [user, applyProfileResult]);

  const update = (field) => (event) => {
    const { value } = event.target;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleGame = (game) => () => {
    const flag = GAME_PROFILE_FLAGS[game];
    setForm((current) => ({ ...current, [flag]: !current[flag] }));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    if (savingProfile || !profile) return;

    const username = form.username.trim();
    const displayName = form.display_name.trim();

    if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
      setProfileError({ message: 'Username must be between 3 and 20 characters.' });
      return;
    }

    if (displayName.length < DISPLAY_NAME_MIN || displayName.length > DISPLAY_NAME_MAX) {
      setProfileError({ message: 'Display name must be between 1 and 30 characters.' });
      return;
    }

    setProfileError(null);
    setProfileSuccess('');
    setSavingProfile(true);

    const picture = form.profile_picture.trim();
    const { data: updated, error } = await updateProfile(profile.id, {
      username,
      display_name: displayName,
      bio: form.bio.trim(),
      profile_picture: picture === '' ? null : picture,
      game_dls: form.game_dls,
      game_efootball: form.game_efootball,
      game_fcmobile: form.game_fcmobile,
      game_cod: form.game_cod,
    });

    if (error) {
      setProfileError(error);
      setSavingProfile(false);
      return;
    }

    if (!updated) {
      setProfileError({ message: 'The profile was not saved. Please try again.' });
      setSavingProfile(false);
      return;
    }

    setProfile(updated);
    setForm(toForm(updated));
    setSavingProfile(false);
    setProfileSuccess('Your profile has been saved.');
    revalidate();
  };

  const updatePasswordField = (field) => (event) => {
    const { value } = event.target;
    setPasswords((current) => ({ ...current, [field]: value }));
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    if (savingPassword) return;

    const newPassword = passwords.newPassword;

    if (newPassword !== passwords.confirmPassword) {
      setPasswordError({ message: 'The new passwords do not match.' });
      return;
    }

    if (newPassword.length < PASSWORD_MIN) {
      setPasswordError({ message: 'Password must be at least 8 characters.' });
      return;
    }

    setPasswordError(null);
    setPasswordSuccess('');
    setSavingPassword(true);

    const { error } = await changePassword({
      currentPassword: passwords.currentPassword,
      newPassword,
    });

    if (error) {
      setPasswordError(error);
      setSavingPassword(false);
      return;
    }

    setPasswords(EMPTY_PASSWORDS);
    setSavingPassword(false);
    setPasswordSuccess('Your password has been updated.');
  };

  if (authLoading) {
    return <div className={styles.loading}></div>;
  }

  if (configError || !user) {
    return null;
  }

  const busy = savingProfile || savingPassword;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>Settings</h1>

        <DataBoundary
          loading={loading}
          error={loadError}
          isEmpty={!loading && !loadError && !profile}
          onRetry={reload}
          empty={
            <EmptyState
              icon='&#128100;'
              title='No profile'
              description='There is no player profile linked to this account yet, so these settings cannot be saved.'
            />
          }
        >
          {profile && (
            <div className={styles.settingsSection}>
              <h2 className={styles.sectionTitle}>Account Settings</h2>

              <form className={styles.settingsForm} onSubmit={handleSaveProfile}>
                <div className={styles.formGroup}>
                  <label htmlFor='settings-email'>Email</label>
                  <input type='email' id='settings-email' value={user.email ?? ''} disabled readOnly />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor='settings-username'>Username</label>
                  <input
                    type='text'
                    id='settings-username'
                    value={form.username}
                    onChange={update('username')}
                    maxLength={USERNAME_MAX}
                    disabled={busy}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor='settings-display-name'>Display Name</label>
                  <input
                    type='text'
                    id='settings-display-name'
                    value={form.display_name}
                    onChange={update('display_name')}
                    maxLength={DISPLAY_NAME_MAX}
                    disabled={busy}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor='settings-bio'>Bio</label>
                  <textarea
                    id='settings-bio'
                    className={styles.textarea}
                    value={form.bio}
                    onChange={update('bio')}
                    maxLength={300}
                    rows={4}
                    disabled={busy}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor='settings-picture'>Profile Picture URL</label>
                  <input
                    type='url'
                    id='settings-picture'
                    value={form.profile_picture}
                    onChange={update('profile_picture')}
                    placeholder='https://'
                    disabled={busy}
                  />
                </div>

                <fieldset className={styles.gameFieldset}>
                  <legend className={styles.fieldLegend}>Games</legend>
                  {GAMES.map((game) => {
                    const flag = GAME_PROFILE_FLAGS[game.value];
                    const inputId = 'settings-game-' + game.value;
                    return (
                      <label key={game.value} className={styles.checkRow} htmlFor={inputId}>
                        <input
                          type='checkbox'
                          id={inputId}
                          checked={form[flag]}
                          onChange={toggleGame(game)}
                          disabled={busy}
                        />
                        <span>{game.label}</span>
                      </label>
                    );
                  })}
                </fieldset>

                {profileError && <p className={styles.error}>{profileError.message}</p>}
                {profileSuccess && <SuccessBanner message={profileSuccess} />}

                <button className={styles.saveBtn} type='submit' disabled={busy}>
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>
          )}
        </DataBoundary>
        <div className={styles.settingsSection}>
          <h2 className={styles.sectionTitle}>Password</h2>

          <form className={styles.settingsForm} onSubmit={handleChangePassword}>
            <div className={styles.formGroup}>
              <label htmlFor='current-password'>Current Password</label>
              <input
                type='password'
                id='current-password'
                autoComplete='current-password'
                value={passwords.currentPassword}
                onChange={updatePasswordField('currentPassword')}
                disabled={busy}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor='new-password'>New Password</label>
              <input
                type='password'
                id='new-password'
                autoComplete='new-password'
                value={passwords.newPassword}
                onChange={updatePasswordField('newPassword')}
                disabled={busy}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor='confirm-new-password'>Confirm New Password</label>
              <input
                type='password'
                id='confirm-new-password'
                autoComplete='new-password'
                value={passwords.confirmPassword}
                onChange={updatePasswordField('confirmPassword')}
                disabled={busy}
                required
              />
            </div>

            {passwordError && <p className={styles.error}>{passwordError.message}</p>}
            {passwordSuccess && <SuccessBanner message={passwordSuccess} />}

            <button className={styles.saveBtn} type='submit' disabled={busy}>
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
        <div className={styles.settingsSection}>
          <h2 className={styles.sectionTitle}>Danger Zone</h2>

          {deleteOpen ? (
            <div className={styles.settingsForm}>
              <p className={styles.note}>
                Type {DELETE_PHRASE} to confirm you understand this cannot be undone.
              </p>
              <div className={styles.formGroup}>
                <label htmlFor='delete-confirm'>Confirmation</label>
                <input
                  type='text'
                  id='delete-confirm'
                  value={deleteConfirm}
                  onChange={(event) => setDeleteConfirm(event.target.value)}
                  placeholder={DELETE_PHRASE}
                  disabled={busy}
                />
              </div>

              <button className={styles.deleteBtn} type='button' disabled>
                Delete account
              </button>

              <p className={styles.note}>
                Self-service account deletion is not available: the platform has no server
                endpoint that removes an auth user. Contact support to request account deletion.
              </p>

              <button
                className={styles.secondaryBtn}
                type='button'
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirm('');
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className={styles.deleteBtn}
              type='button'
              onClick={() => setDeleteOpen(true)}
              disabled={busy}
            >
              Delete Account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
