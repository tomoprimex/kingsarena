'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  DataBoundary,
  EmptyState,
  ErrorState,
  SuccessBanner,
} from '../../../../../components/ui';
import { useAuth } from '../../../../../contexts/AuthContext';
import { fetchFixtureDetail, fetchMyProfile, participantLabel } from '../../../../../lib/data/client';
import { submitFixtureResult } from '../../../../../lib/mutations/tournaments';
import { useRevalidate } from '../../../../../lib/mutations/revalidate';
import { getFixtureStatusLabel } from '../../../../../lib/constants';
import styles from './fixture-detail.module.css';

function formatDateTime(value) {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseScore(value) {
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

export default function FixtureDetailPage() {
  const params = useParams();
  const fixtureId = params?.fixtureId;
  const tournamentId = params?.id;
  const { user, loading: authLoading } = useAuth();
  const revalidate = useRevalidate();

  const [payload, setPayload] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [profileId, setProfileId] = useState(null);

  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [notes, setNotes] = useState('');

  const [validationError, setValidationError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    if (!fixtureId || !user) return;
    const { data, error } = await fetchFixtureDetail(fixtureId, user.id);
    setPayload(data);
    setLoadError(error);
    setLoading(false);
  }, [fixtureId, user]);

  useEffect(() => {
    if (authLoading || !user || !fixtureId) return undefined;
    let active = true;

    fetchFixtureDetail(fixtureId, user.id).then(({ data, error }) => {
      if (!active) return;
      setPayload(data);
      setLoadError(error);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [authLoading, fixtureId, user]);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;

    fetchMyProfile(user.id).then(({ data }) => {
      if (active) setProfileId(data?.id ?? null);
    });

    return () => {
      active = false;
    };
  }, [user]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const home = parseScore(homeScore);
    const away = parseScore(awayScore);

    if (home === null) {
      setValidationError('Home score must be a whole number of 0 or more.');
      setSubmitError(null);
      setSuccess('');
      return;
    }

    if (away === null) {
      setValidationError('Away score must be a whole number of 0 or more.');
      setSubmitError(null);
      setSuccess('');
      return;
    }

    setValidationError(null);
    setSubmitError(null);
    setSuccess('');
    setSubmitting(true);

    // submitted_by is a profiles.id foreign key, not the Supabase auth uid.
    const { error } = await submitFixtureResult({
      fixtureId,
      homeScore: home,
      awayScore: away,
      submittedBy: profileId,
      notes,
    });

    if (error) {
      setSubmitError(error);
      setSubmitting(false);
      return;
    }

    setSuccess('Result saved.');
    setSubmitting(false);
    revalidate();
    await reload();
  };

  const fixture = payload?.fixture ?? null;
  const canSubmit = Boolean(payload?.canSubmit);
  const result = fixture?.result ?? null;
  const homeName = fixture ? participantLabel(fixture.home) : null;
  const awayName = fixture ? participantLabel(fixture.away) : null;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <Link href={'/tournaments/' + tournamentId} className={styles.backLink}>
            &larr; Back to tournament
          </Link>

          {!user && !authLoading ? (
            <EmptyState
              icon='🔐'
              title='Sign in to view this match'
              description='Match details are only available to signed-in accounts.'
              action={
                <Link href='/login' className={styles.backLink}>
                  Go to sign in
                </Link>
              }
            />
          ) : (
            <DataBoundary
              loading={loading || authLoading}
              error={loadError}
              isEmpty={!loading && !loadError && !fixture}
              onRetry={reload}
              empty={
                <EmptyState
                  icon='📅'
                  title='Fixture not found'
                  description='This fixture does not exist or it has been removed.'
                />
              }
            >
              {fixture && (
                <>
                  <article className={styles.card}>
                    {fixture.tournament && (
                      <Link
                        href={'/tournaments/' + tournamentId}
                        className={styles.tournamentLink}
                      >
                        {fixture.tournament.name}
                      </Link>
                    )}

                    <h1 className={styles.title}>
                      Round {fixture.round}
                      {fixture.match_number ? ' · Match ' + fixture.match_number : ''}
                    </h1>
                    <div className={styles.matchup}>
                      <div className={styles.side}>
                        <span className={styles.name}>{homeName}</span>
                        {result && (
                          <span className={styles.score}>
                            {result.home_score ?? 0}
                          </span>
                        )}
                      </div>

                      <span className={styles.separator} aria-hidden='true'>
                        {result ? '–' : 'vs'}
                      </span>
                      <div className={styles.side + ' ' + styles.sideAway}>
                        <span className={styles.name}>{awayName}</span>
                        {result && (
                          <span className={styles.score}>
                            {result.away_score ?? 0}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.facts}>
                      <div className={styles.fact}>
                        <span className={styles.factLabel}>Status</span>
                        <span className={styles.factValue}>
                          {getFixtureStatusLabel(fixture.status)}
                        </span>
                      </div>
                      <div className={styles.fact}>
                        <span className={styles.factLabel}>Scheduled</span>
                        <span className={styles.factValue}>
                          {formatDateTime(fixture.scheduled_at)}
                        </span>
                      </div>
                      <div className={styles.fact}>
                        <span className={styles.factLabel}>Result status</span>
                        <span className={styles.factValue}>
                          {result ? (result.status ?? 'unknown') : 'Not submitted'}
                        </span>
                      </div>
                      <div className={styles.fact}>
                        <span className={styles.factLabel}>Submitted at</span>
                        <span className={styles.factValue}>
                          {result ? formatDateTime(result.submitted_at) : '—'}
                        </span>
                      </div>
                    </div>

                    {result?.notes && <p className={styles.muted}>{result.notes}</p>}
                  </article>
                  <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                      {result ? 'Update result' : 'Submit result'}
                    </h2>

                    {canSubmit ? (
                      <>
                        {success && (
                          <div className={styles.notice}>
                            <SuccessBanner message={success} />
                          </div>
                        )}

                        {submitError && (
                          <div className={styles.notice}>
                            <ErrorState error={submitError} />
                          </div>
                        )}

                        {validationError && (
                          <div className={styles.notice}>
                            <ErrorState error={{ message: validationError }} />
                          </div>
                        )}

                        <form className={styles.form} onSubmit={handleSubmit} noValidate>
                          <div className={styles.grid}>
                            <div className={styles.field}>
                              <label className={styles.label} htmlFor='homeScore'>
                                {homeName} score
                              </label>
                              <input
                                className={styles.input}
                                id='homeScore'
                                name='homeScore'
                                type='number'
                                min='0'
                                step='1'
                                inputMode='numeric'
                                value={homeScore}
                                onChange={(event) => setHomeScore(event.target.value)}
                              />
                            </div>
                            <div className={styles.field}>
                              <label className={styles.label} htmlFor='awayScore'>
                                {awayName} score
                              </label>
                              <input
                                className={styles.input}
                                id='awayScore'
                                name='awayScore'
                                type='number'
                                min='0'
                                step='1'
                                inputMode='numeric'
                                value={awayScore}
                                onChange={(event) => setAwayScore(event.target.value)}
                              />
                            </div>
                          </div>
                          <div className={styles.field}>
                            <label className={styles.label} htmlFor='notes'>
                              Notes
                            </label>
                            <textarea
                              className={styles.textarea}
                              id='notes'
                              name='notes'
                              value={notes}
                              onChange={(event) => setNotes(event.target.value)}
                            />
                          </div>

                          <button className={styles.submitBtn} type='submit' disabled={submitting}>
                            {submitting ? 'Saving...' : 'Save result'}
                          </button>
                        </form>
                      </>
                    ) : (
                      <EmptyState
                        icon='🔒'
                        title='Only the organizer or the two participants may submit the score'
                        description='Your account is not the organizer of this tournament and is not listed as a participant in this fixture, so there is no score form here.'
                      />
                    )}
                  </section>
                </>
              )}
            </DataBoundary>
          )}
        </div>
      </main>
    </div>
  );
}
