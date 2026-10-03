'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  DataBoundary,
  EmptyState,
  ErrorState,
  LoadingState,
  SuccessBanner,
} from '../../../components/ui';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchMyProfile, fetchTeamById } from '../../../lib/data/client';
import {
  deleteTeam,
  joinTeam,
  leaveTeam,
  updateTeam,
} from '../../../lib/mutations/teams';
import { useRevalidate } from '../../../lib/mutations/revalidate';
import {
  GAMES,
  TEAM_ROLE_MAP,
  getGameLabel,
  getParticipantStatusLabel,
  getTournamentStatusLabel,
} from '../../../lib/constants';
import styles from './team-detail.module.css';

const NAME_MIN = 3;
const NAME_MAX = 40;

function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function memberLabel(member) {
  return member?.profile?.display_name ?? member?.profile?.username ?? 'Unknown player';
}

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const { user, loading: authLoading } = useAuth();
  const revalidate = useRevalidate();

  const [team, setTeam] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [profileId, setProfileId] = useState(null);
  const [profileError, setProfileError] = useState(null);

  const [pendingAction, setPendingAction] = useState('');
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState('');

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', game: '' });
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!id) return undefined;
    let active = true;

    fetchTeamById(id).then(({ data, error }) => {
      if (!active) return;
      setTeam(data);
      setLoadError(error);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;

    fetchMyProfile(user.id).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setProfileId(null);
        setProfileError(error);
      } else if (!data) {
        setProfileId(null);
        setProfileError({ message: 'No profile is linked to this account yet.' });
      } else {
        setProfileId(data.id);
        setProfileError(null);
      }
    });

    return () => {
      active = false;
    };
  }, [user]);

  // After a mutation the screen is re-read from Supabase so counts, roster and
  // tournament entries all reflect committed rows.
  const refresh = useCallback(async () => {
    if (!id) return;
    const { data, error } = await fetchTeamById(id);
    setTeam(data);
    setLoadError(error);
    setLoading(false);
  }, [id]);

  const members = team?.members ?? [];
  const entries = team?.entries ?? [];
  const isOwner = Boolean(team) && Boolean(profileId) && team.owner_id === profileId;
  const myMembership = profileId
    ? members.find((member) => member.user_id === profileId) ?? null
    : null;
  const isMember = Boolean(myMembership);

  const startEditing = () => {
    setEditForm({
      name: team?.name ?? '',
      description: team?.description ?? '',
      game: team?.game ?? GAMES[0].value,
    });
    setEditing(true);
  };

  const runAction = async (key, action) => {
    setPendingAction(key);
    setActionError(null);
    setSuccess('');

    const { error } = await action();

    if (error) {
      setActionError(error);
      setPendingAction('');
      return false;
    }

    setPendingAction('');
    await refresh();
    revalidate();
    return true;
  };

  const handleJoin = async () => {
    const ok = await runAction('join', () => joinTeam(id, profileId));
    if (ok) setSuccess('You joined this team.');
  };

  const handleLeave = async () => {
    const ok = await runAction('leave', () => leaveTeam(id, profileId));
    if (ok) setSuccess('You left this team.');
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (pendingAction !== '') return;

    const trimmedName = editForm.name.trim();
    if (trimmedName.length < NAME_MIN || trimmedName.length > NAME_MAX) {
      setActionError({
        message: `Team name must be between ${NAME_MIN} and ${NAME_MAX} characters.`,
      });
      return;
    }

    const ok = await runAction('save', () =>
      updateTeam(id, {
        name: trimmedName,
        description: editForm.description.trim(),
        game: editForm.game,
      }),
    );

    if (ok) {
      setEditing(false);
      setSuccess('Team updated.');
    }
  };

  const handleDelete = async () => {
    setPendingAction('delete');
    setActionError(null);
    setSuccess('');

    const { error } = await deleteTeam(id);

    if (error) {
      setActionError(error);
      setPendingAction('');
      return;
    }

    setPendingAction('');
    setConfirmingDelete(false);
    revalidate();
    router.push('/teams');
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <Link href='/teams' className={styles.backLink}>
            &larr; All teams
          </Link>

          <DataBoundary
            loading={loading || authLoading}
            error={loadError}
            isEmpty={!loading && !loadError && !team}
            onRetry={refresh}
            empty={
              <EmptyState
                icon='👥'
                title='Team not found'
                description='This team does not exist or it has been removed.'
              />
            }
          >
            {team && (
              <>
                <header className={styles.card}>
                  <div className={styles.badges}>
                    <span className={styles.badge + ' ' + styles.badgeGame}>
                      {getGameLabel(team.game)}
                    </span>
                    <span className={styles.badge}>{members.length} members</span>
                  </div>

                  <h1 className={styles.title}>{team.name}</h1>

                  {team.description ? (
                    <p className={styles.description}>{team.description}</p>
                  ) : (
                    <p className={styles.muted}>This team has not added a description yet.</p>
                  )}

                  <div className={styles.facts}>
                    <div className={styles.fact}>
                      <span className={styles.factLabel}>Owner</span>
                      <span className={styles.factValue}>
                        {team.owner?.display_name ?? team.owner?.username ?? 'Unknown'}
                      </span>
                    </div>
                    <div className={styles.fact}>
                      <span className={styles.factLabel}>Members</span>
                      <span className={styles.factValue}>{members.length}</span>
                    </div>
                    <div className={styles.fact}>
                      <span className={styles.factLabel}>Tournament entries</span>
                      <span className={styles.factValue}>{entries.length}</span>
                    </div>
                    <div className={styles.fact}>
                      <span className={styles.factLabel}>Created</span>
                      <span className={styles.factValue}>{formatDate(team.created_at)}</span>
                    </div>
                  </div>
                </header>
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Roster</h2>

                  {members.length === 0 ? (
                    <EmptyState
                      icon='🙋'
                      title='No members yet'
                      description='Members appear here as soon as they join this team.'
                    />
                  ) : (
                    <ul className={styles.list}>
                      {members.map((member) => (
                        <li key={member.id} className={styles.row}>
                          {member.profile?.profile_picture ? (
                            <img
                              src={member.profile.profile_picture}
                              alt=''
                              className={styles.avatar}
                              aria-hidden='true'
                            />
                          ) : (
                            <span className={styles.avatarFallback} aria-hidden='true'>
                              {memberLabel(member).slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span className={styles.rowMain}>
                            <span className={styles.rowName}>{memberLabel(member)}</span>
                            {member.profile?.username && (
                              <span className={styles.muted}>@{member.profile.username}</span>
                            )}
                          </span>
                          <span className={styles.muted}>
                            {TEAM_ROLE_MAP[member.role]?.label ?? member.role} &middot; joined{' '}
                            {formatDate(member.joined_at)}
                          </span>
                          {member.user_id === profileId && (
                            <span className={styles.youBadge}>You</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className={styles.joinBar}>
                    {!user ? (
                      <span className={styles.muted}>
                        <Link href='/login' className={styles.backLink}>
                          Sign in
                        </Link>{' '}
                        to join this team.
                      </span>
                    ) : isOwner ? (
                      <span className={styles.muted}>You own this team.</span>
                    ) : isMember ? (
                      <button
                        className={styles.secondaryBtn}
                        type='button'
                        onClick={handleLeave}
                        disabled={pendingAction !== '' || !profileId}
                      >
                        {pendingAction === 'leave' ? 'Leaving...' : 'Leave team'}
                      </button>
                    ) : (
                      <>
                        <button
                          className={styles.primaryBtn}
                          type='button'
                          onClick={handleJoin}
                          disabled={pendingAction !== '' || !profileId}
                        >
                          {pendingAction === 'join' ? 'Joining...' : 'Join team'}
                        </button>
                        {profileError && (
                          <span className={styles.muted}>{profileError.message}</span>
                        )}
                      </>
                    )}
                  </div>

                  {success && (
                    <div className={styles.notice}>
                      <SuccessBanner message={success} />
                    </div>
                  )}

                  {actionError && (
                    <div className={styles.notice}>
                      <ErrorState error={actionError} />
                    </div>
                  )}
                </section>
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Tournament entries</h2>

                  {entries.length === 0 ? (
                    <EmptyState
                      icon='🏆'
                      title='Not entered in any tournament'
                      description='Tournaments this team has entered show up here with their real status and entry date.'
                    />
                  ) : (
                    <ul className={styles.list}>
                      {entries.map((entry) => (
                        <li key={entry.id} className={styles.row}>
                          <span className={styles.rowMain}>
                            <Link
                              href={'/tournaments/' + entry.tournament_id}
                              className={styles.rowLink}
                            >
                              {entry.tournament.name}
                            </Link>
                            <span className={styles.muted}>
                              {getGameLabel(entry.tournament.game)}
                            </span>
                          </span>
                          <span className={styles.muted}>
                            {getTournamentStatusLabel(entry.tournament.status)} &middot;{' '}
                            {getParticipantStatusLabel(entry.status)} &middot; entered{' '}
                            {formatDate(entry.joined_at)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {isOwner && (
                  <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Owner actions</h2>

                    {editing ? (
                      <form className={styles.editForm} onSubmit={handleSave} noValidate>
                        <div className={styles.field}>
                          <label className={styles.label} htmlFor='edit-name'>
                            Team name
                          </label>
                          <input
                            className={styles.input}
                            id='edit-name'
                            name='name'
                            type='text'
                            minLength={NAME_MIN}
                            maxLength={NAME_MAX}
                            value={editForm.name}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label} htmlFor='edit-game'>
                            Game
                          </label>
                          <select
                            className={styles.select}
                            id='edit-game'
                            name='game'
                            value={editForm.game}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                game: event.target.value,
                              }))
                            }
                          >
                            {GAMES.map((game) => (
                              <option key={game.value} value={game.value}>
                                {game.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label} htmlFor='edit-description'>
                            Description
                          </label>
                          <textarea
                            className={styles.textarea}
                            id='edit-description'
                            name='description'
                            value={editForm.description}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                description: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className={styles.controls}>
                          <button
                            className={styles.primaryBtn}
                            type='submit'
                            disabled={pendingAction !== ''}
                          >
                            {pendingAction === 'save' ? 'Saving...' : 'Save changes'}
                          </button>
                          <button
                            className={styles.secondaryBtn}
                            type='button'
                            onClick={() => setEditing(false)}
                            disabled={pendingAction !== ''}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className={styles.controls}>
                        <button
                          className={styles.primaryBtn}
                          type='button'
                          onClick={startEditing}
                          disabled={pendingAction !== ''}
                        >
                          Edit team
                        </button>

                        {confirmingDelete ? (
                          <>
                            <button
                              className={styles.dangerBtn}
                              type='button'
                              onClick={handleDelete}
                              disabled={pendingAction !== ''}
                            >
                              {pendingAction === 'delete'
                                ? 'Deleting...'
                                : 'Confirm delete'}
                            </button>
                            <button
                              className={styles.secondaryBtn}
                              type='button'
                              onClick={() => setConfirmingDelete(false)}
                              disabled={pendingAction !== ''}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            className={styles.dangerBtn}
                            type='button'
                            onClick={() => setConfirmingDelete(true)}
                            disabled={pendingAction !== ''}
                          >
                            Delete team
                          </button>
                        )}
                      </div>
                    )}

                    {pendingAction !== '' && editing && (
                      <div className={styles.notice}>
                        <LoadingState label='Saving team...' />
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </DataBoundary>
        </div>
      </main>
    </div>
  );
}
