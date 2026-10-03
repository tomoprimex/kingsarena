'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  SuccessBanner,
} from '../../../components/ui';
import { useRequireAuth } from '../../../contexts/AuthContext';
import { fetchMyProfile } from '../../../lib/data/client';
import { createTeam } from '../../../lib/mutations/teams';
import { useRevalidate } from '../../../lib/mutations/revalidate';
import { GAMES } from '../../../lib/constants';
import styles from './team-form.module.css';

const EMPTY_FORM = {
  name: '',
  description: '',
  game: GAMES[0].value,
};

const NAME_MIN = 3;
const NAME_MAX = 40;

function nameError(name) {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Enter a team name.';
  if (trimmed.length < NAME_MIN) return `Team name must be at least ${NAME_MIN} characters.`;
  if (trimmed.length > NAME_MAX) return `Team name must be ${NAME_MAX} characters or fewer.`;
  return null;
}

export default function CreateTeamPage() {
  const { user, loading: authLoading, configError } = useRequireAuth();
  const router = useRouter();
  const revalidate = useRevalidate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  const update = (field) => (event) => {
    const { value } = event.target;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const nameIssue = nameError(form.name);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setTouched(true);
    setError(null);
    setSuccess('');

    if (nameIssue) {
      setError({ message: nameIssue });
      return;
    }

    setSubmitting(true);

    // teams.owner_id is a foreign key to public.profiles.id, NOT to
    // auth.users.id, so the caller profile row has to be resolved first.
    const { data: profile, error: profileError } = await fetchMyProfile(user.id);

    if (profileError) {
      setError(profileError);
      setSubmitting(false);
      return;
    }

    if (!profile) {
      setError({ message: 'No profile is linked to this account yet.' });
      setSubmitting(false);
      return;
    }

    const { data: created, error: createError } = await createTeam({
      name: form.name,
      description: form.description,
      game: form.game,
      ownerProfileId: profile.id,
    });

    if (createError) {
      setError(createError);
      setSubmitting(false);
      return;
    }

    if (!created?.team) {
      setError({ message: 'The team was not created. Please try again.' });
      setSubmitting(false);
      return;
    }

    setSuccess(`${created.team.name} was created. Opening the team list...`);
    setSubmitting(false);
    revalidate();
    router.push('/teams');
  };

  if (authLoading) {
    return (
      <div className={styles.page}>
        <main className={styles.main} />
      </div>
    );
  }

  if (configError || !user) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <div className={styles.container}>
            <EmptyState
              icon='🔐'
              title='Sign in to create a team'
              description='You need a Kings Arena account before you can start a team.'
              action={
                <Link href='/login' className={styles.backLink}>
                  Go to sign in
                </Link>
              }
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <Link href='/teams' className={styles.backLink}>
            &larr; Back to teams
          </Link>

          <PageHeader
            title='Create Team'
            description='Set up a roster for one of the supported games. The team is stored against your profile and appears in the public list immediately.'
          />

          {success && (
            <div className={styles.notice}>
              <SuccessBanner message={success} />
            </div>
          )}

          {error && (
            <div className={styles.notice}>
              <ErrorState error={error} />
            </div>
          )}

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor='name'>
                Team name
              </label>
              <input
                className={styles.input}
                id='name'
                name='name'
                type='text'
                required
                minLength={NAME_MIN}
                maxLength={NAME_MAX}
                value={form.name}
                onChange={update('name')}
                onBlur={() => setTouched(true)}
              />
              {touched && nameIssue ? (
                <span className={styles.fieldError}>{nameIssue}</span>
              ) : (
                <span className={styles.hint}>
                  Between {NAME_MIN} and {NAME_MAX} characters. Team names must be unique.
                </span>
              )}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor='game'>
                Game
              </label>
              <select
                className={styles.select}
                id='game'
                name='game'
                value={form.game}
                onChange={update('game')}
              >
                {GAMES.map((game) => (
                  <option key={game.value} value={game.value}>
                    {game.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor='description'>
                Description
              </label>
              <textarea
                className={styles.textarea}
                id='description'
                name='description'
                maxLength={280}
                value={form.description}
                onChange={update('description')}
              />
              <span className={styles.hint}>
                Optional. Tell other players what this team is about.
              </span>
            </div>
            <div className={styles.actions}>
              <button className={styles.submitBtn} type='submit' disabled={submitting}>
                {submitting ? 'Creating...' : 'Create team'}
              </button>
              <Link href='/teams' className={styles.cancelBtn}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
