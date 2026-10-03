'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  DataBoundary,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SuccessBanner,
} from '../../../../components/ui';
import { useRequireAuth } from '../../../../contexts/AuthContext';
import { fetchTournamentForUser } from '../../../../lib/data/client';
import { updateTournament } from '../../../../lib/mutations/tournaments';
import { useRevalidate } from '../../../../lib/mutations/revalidate';
import { GAMES, TOURNAMENT_FORMATS, TOURNAMENT_STATUSES } from '../../../../lib/constants';
import styles from './tournament-edit.module.css';

function toFormValues(t) {
  return {
    name: t.name ?? '',
    description: t.description ?? '',
    image_url: t.image_url ?? '',
    game: t.game ?? GAMES[0].value,
    format: t.format ?? 'league',
    status: t.status ?? 'upcoming',
    rules: t.rules ?? '',
    entry_fee: t.entry_fee === null || t.entry_fee === undefined ? '' : String(t.entry_fee),
    prize_pool: t.prize_pool === null || t.prize_pool === undefined ? '' : String(t.prize_pool),
    max_participants:
      t.max_participants === null || t.max_participants === undefined
        ? ''
        : String(t.max_participants),
    start_date: toDateInput(t.start_date),
    end_date: toDateInput(t.end_date),
    registration_deadline: toDateInput(t.registration_deadline),
  };
}

function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function toNullableText(value) {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function toNullableNumber(value) {
  const trimmed = value.trim();
  return trimmed === '' ? null : Number(trimmed);
}

export default function EditTournamentPage() {
  const params = useParams();
  const id = params?.id;
  const { user, loading: authLoading, configError } = useRequireAuth();
  const revalidate = useRevalidate();

  const [payload, setPayload] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  const applyPayload = (payloadResult) => {
    const t = payloadResult.data?.tournament;
    if (t) setForm(toFormValues(t));
    setPayload(payloadResult.data);
    setLoading(false);
  };

  const reload = useCallback(async () => {
    if (!id || !user) return;
    const { data, error: fetchError } = await fetchTournamentForUser(id, user.id);
    if (fetchError) {
      setLoadError(fetchError);
      setLoading(false);
      return;
    }
    setLoadError(null);
    applyPayload({ data, error: null });
  }, [id, user]);

  useEffect(() => {
    if (authLoading || !user || !id) return undefined;
    let active = true;

    fetchTournamentForUser(id, user.id).then(({ data, error: fetchError }) => {
      if (!active) return;
      if (fetchError) {
        setLoadError(fetchError);
        setLoading(false);
        return;
      }
      setLoadError(null);
      applyPayload({ data, error: null });
    });

    return () => {
      active = false;
    };
  }, [authLoading, id, user]);

  const update = (field) => (event) => {
    const { value } = event.target;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || !form) return;

    setError(null);
    setSuccess('');
    setSubmitting(true);

    const { data: updated, error: updateError } = await updateTournament(id, {
      name: form.name,
      description: toNullableText(form.description),
      game: form.game,
      image_url: toNullableText(form.image_url),
      format: form.format,
      status: form.status,
      rules: toNullableText(form.rules),
      entry_fee: toNullableNumber(form.entry_fee) ?? 0,
      prize_pool: toNullableNumber(form.prize_pool) ?? 0,
      max_participants: toNullableNumber(form.max_participants),
      start_date: toNullableText(form.start_date),
      end_date: toNullableText(form.end_date),
      registration_deadline: toNullableText(form.registration_deadline),
    });

    if (updateError) {
      setError(updateError);
      setSubmitting(false);
      return;
    }

    if (!updated) {
      setError({ message: 'The tournament was not updated. Please try again.' });
      setSubmitting(false);
      return;
    }

    setSuccess('Changes saved.');
    setSubmitting(false);
    revalidate();
    await reload();
  };

  if (configError || (!authLoading && !user)) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <div className={styles.container}>
            <EmptyState
              icon='🔐'
              title='Sign in to edit this tournament'
              description='You need a Kings Arena account before you can change a competition.'
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

  const isOrganizer = Boolean(payload?.isOrganizer);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <Link href={'/tournaments/' + id} className={styles.backLink}>
            &larr; Back to tournament
          </Link>

          <DataBoundary
            loading={loading || authLoading}
            error={loadError}
            isEmpty={!loading && !loadError && !payload?.tournament}
            onRetry={reload}
            empty={
              <EmptyState
                icon='🏆'
                title='Tournament not found'
                description='This tournament does not exist or it has been removed.'
              />
            }
          >
            {!isOrganizer ? (
              <EmptyState
                icon='🚫'
                title='Only the organizer can edit this tournament'
                description='Your account is not the organizer of record for this competition, so the edit form is not available.'
              />
            ) : !form ? (
              <LoadingState label='Preparing the form...' />
            ) : (
              <>
                <PageHeader
                  title={'Edit ' + (form.name || 'tournament')}
                  description='Changes are written straight to the tournament record and are visible immediately.'
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
                  <div className={styles.actions}>
                    <button className={styles.submitBtn} type='submit' disabled={submitting}>
                      {submitting ? 'Saving...' : 'Save changes'}
                    </button>
                    <Link href={'/tournaments/' + id} className={styles.cancelBtn}>
                      Cancel
                    </Link>
                  </div>
                </form>
              </>
            )}
          </DataBoundary>
        </div>
      </main>
    </div>
  );
}
