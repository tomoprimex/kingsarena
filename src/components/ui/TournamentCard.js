'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './TournamentCard.module.css';

const moduleLoadTime = Date.now();

function derivePhase(t, now) {
  if (t.status === 'cancelled') return 'cancelled';
  const deadline = t.registration_deadline ? Date.parse(t.registration_deadline) : null;
  const start = t.start_date ? Date.parse(t.start_date) : null;
  const end = t.end_date ? Date.parse(t.end_date) : null;
  if (t.status === 'completed' || (end != null && now > end)) return 'completed';
  if (deadline != null && now > deadline) {
    if (start != null && now >= start) return 'live';
    return 'closed';
  }
  if (start != null && now >= start) return 'live';
  return 'open';
}

function formatCompact(ms) {
  if (ms <= 0) return 'Closed';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function TournamentCard({ tournament, formatLabel, gameLabel }) {
  const {
    id,
    name,
    description,
    image_url,
    game,
    format,
    status: storedStatus,
    entry_fee,
    prize_pool,
    max_participants,
    start_date,
    end_date,
    registration_deadline,
    participant_count,
    organizer,
  } = tournament;

  const phase = derivePhase(tournament, moduleLoadTime);
  const href = `/tournaments/${id}`;

  const [remainingMs, setRemainingMs] = useState(null);

  useEffect(() => {
    const tick = () => {
      const n = Date.now();
      let target = null;
      if (phase === 'open' || phase === 'live') {
        target = registration_deadline
          ? Date.parse(registration_deadline)
          : start_date
          ? Date.parse(start_date)
          : null;
      } else if (phase === 'closed') {
        target = start_date ? Date.parse(start_date) : null;
      }
      if (target != null) {
        setRemainingMs(target - n);
      } else {
        setRemainingMs(0);
      }
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [phase, registration_deadline, start_date]);

  const phaseLabels = {
    live: 'LIVE',
    open: 'REGISTERING',
    closed: 'CLOSED',
    completed: 'COMPLETED',
    cancelled: 'CANCELLED',
  };

  const phaseLabel = phaseLabels[phase] || 'UNKNOWN';

  let countdownText = '—';
  if (phase === 'completed' || phase === 'cancelled') {
    countdownText = end_date ? formatDate(end_date) : (start_date ? formatDate(start_date) : '—');
  } else if (remainingMs != null) {
    countdownText = formatCompact(remainingMs);
  }

  const isOpen = phase === 'open';
  const atCapacity = max_participants != null && participant_count != null && participant_count >= max_participants;
  const ctaLabel = isOpen && !atCapacity ? 'Join Tournament' : 'View Tournament';

  return (
    <article className={styles.card}>
      {image_url && (
        <img src={image_url} alt='' className={styles.cover} aria-hidden='true' />
      )}

      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.name}>{name}</h3>
          <div className={styles.badges}>
            <span className={styles.gameBadge}>{gameLabel}</span>
            <span className={`${styles.phaseBadge} ${styles[`phase${phase.charAt(0).toUpperCase() + phase.slice(1)}`]}`}>
              {phaseLabel}
            </span>
          </div>
        </div>

        {description && <p className={styles.description}>{description}</p>}

        <div className={styles.meta}>
          <div className={styles.organizer}>
            {organizer?.profile_picture && (
              <img
                src={organizer.profile_picture}
                alt=''
                className={styles.avatar}
                aria-hidden='true'
              />
            )}
            <span className={styles.organizerName}>
              {organizer?.display_name ?? organizer?.username}
            </span>
          </div>

          <div className={styles.participants}>
            <span aria-label='Participants'>
              {participant_count ?? 0} / {max_participants ?? '∞'}
            </span>
          </div>

          {formatLabel && (
            <span className={styles.format}>
              {formatLabel}
            </span>
          )}

          {prize_pool && prize_pool > 0 && (
            <span className={styles.prizePool}>
              Prize: {Number(prize_pool).toLocaleString()}
            </span>
          )}

          {entry_fee && entry_fee > 0 && (
            <span className={styles.entryFee}>
              Entry: {Number(entry_fee).toLocaleString()}
            </span>
          )}
        </div>

        <div className={styles.countdown} aria-live='polite'>
          {phase === 'open' || phase === 'live'
            ? `Registration closes in ${countdownText}`
            : phase === 'closed'
            ? `Starts in ${countdownText}`
            : `Ended ${countdownText}`}
        </div>
      </div>

      <footer className={styles.footer}>
        <Link
          href={href}
          className={styles.cta}
          aria-label={`${ctaLabel}: ${name}`}
        >
          {ctaLabel}
        </Link>
      </footer>
    </article>
  );
}