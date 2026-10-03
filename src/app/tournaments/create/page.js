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
import { createTournament } from '../../../lib/mutations/tournaments';
import { useRevalidate } from '../../../lib/mutations/revalidate';
import { GAMES, TOURNAMENT_FORMATS, TOURNAMENT_STATUSES } from '../../../lib/constants';
import styles from './tournament-form.module.css';

const EMPTY_FORM = {
  name: '',
  description: '',
  image_url: '',
  game: GAMES[0].value,
  format: 'league',
  status: 'upcoming',
  rules: '',
  entry_fee: '',
  prize_pool: '',
  max_participants: '',
  start_date: '',
  end_date: '',
  registration_deadline: '',
};

export default function CreateTournamentPage() {
  const { user, loading: authLoading, configError } = useRequireAuth();
  const router = useRouter();
  const revalidate = useRevalidate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  const update = (field) => (event) => {
    const { value } = event.target;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setError(null);
    setSuccess('');
    setSubmitting(true);

    // tournaments.organizer_id is a foreign key to public.profiles.id, NOT to
    // auth.users.id, so the caller's profile row has to be resolved first.
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

    const { data: created, error: createError } = await createTournament({
      ...form,
      profileId: profile.id,
    });

    if (createError) {
      setError(createError);
      setSubmitting(false);
      return;
    }

    if (!created) {
      setError({ message: 'The tournament was not created. Please try again.' });
      setSubmitting(false);
      return;
    }

    setSuccess(`${created.name} was created. Opening the tournament list...`);
    setSubmitting(false);
    revalidate();
    router.push('/tournaments');
  };

  if (authLoading) {
    return (
      <div className={styles.loading}></div>
    );
  }

  if (configError || !user) {
    return (
      <div className={styles.container}>
        <EmptyState
          icon='🔐'
          title='Sign in to create a tournament'
          description='You need a Kings Arena account before you can organize a competition.'
          action={
            <Link href='/login' className={styles.backLink}>
              Go to sign in
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link href='/tournaments' className={styles.backLink}>
          &larr; Back to tournaments
        </Link>

        <PageHeader
          title='Create Tournament'
          description='Set up a competition. The tournament is stored against your organizer profile and appears in the public list immediately.'
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
              Name
            </label>
            <input
              className={styles.input}
              id='name'
              name='name'
              type='text'
              required
              maxLength={80}
              value={form.name}
              onChange={update('name')}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor='description'>
              Description
            </label>
            <textarea
              className={styles.textarea}
              id='description'
              name='description'
              value={form.description}
              onChange={update('description')}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor='image_url'>
              Cover image URL
            </label>
            <input
              className={styles.input}
              id='image_url'
              name='image_url'
              type='url'
              placeholder='https://'
              value={form.image_url}
              onChange={update('image_url')}
            />
          </div>
          <div className={styles.grid}>
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
              <label className={styles.label} htmlFor='format'>
                Format
              </label>
              <select
                className={styles.select}
                id='format'
                name='format'
                value={form.format}
                onChange={update('format')}
              >
                {TOURNAMENT_FORMATS.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor='status'>
                Status
              </label>
              <select
                className={styles.select}
                id='status'
                name='status'
                value={form.status}
                onChange={update('status')}
              >
                {TOURNAMENT_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor='entry_fee'>
                Entry fee
              </label>
              <input
                className={styles.input}
                id='entry_fee'
                name='entry_fee'
                type='number'
                min='0'
                step='1'
                value={form.entry_fee}
                onChange={update('entry_fee')}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor='prize_pool'>
                Prize pool
              </label>
              <input
                className={styles.input}
                id='prize_pool'
                name='prize_pool'
                type='number'
                min='0'
                step='1'
                value={form.prize_pool}
                onChange={update('prize_pool')}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor='max_participants'>
                Max participants
              </label>
              <input
                className={styles.input}
                id='max_participants'
                name='max_participants'
                type='number'
                min='2'
                step='1'
                placeholder='Unlimited'
                value={form.max_participants}
                onChange={update('max_participants')}
              />
            </div>
          </div>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor='start_date'>
                Start date
              </label>
              <input
                className={styles.input}
                id='start_date'
                name='start_date'
                type='date'
                value={form.start_date}
                onChange={update('start_date')}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor='end_date'>
                End date
              </label>
              <input
                className={styles.input}
                id='end_date'
                name='end_date'
                type='date'
                value={form.end_date}
                onChange={update('end_date')}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor='registration_deadline'>
                Registration deadline
              </label>
              <input
                className={styles.input}
                id='registration_deadline'
                name='registration_deadline'
                type='date'
                value={form.registration_deadline}
                onChange={update('registration_deadline')}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor='rules'>
              Rules
            </label>
            <textarea
              className={styles.textarea}
              id='rules'
              name='rules'
              value={form.rules}
              onChange={update('rules')}
            />
          </div>

          <p className={styles.hint}>
            The cover image must be a public http or https link; leave it blank to show a plain
            card. Dates are optional. A tournament without a maximum participant count accepts
            unlimited registrations.
          </p>
          <div className={styles.actions}>
            <button className={styles.submitBtn} type='submit' disabled={submitting}>
              {submitting ? 'Creating...' : 'Create tournament'}
            </button>
            <Link href='/tournaments' className={styles.cancelBtn}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
