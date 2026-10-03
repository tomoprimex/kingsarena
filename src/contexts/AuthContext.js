'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext(null);

const AUTH_ERROR_MESSAGES = {
  invalid_credentials: 'Incorrect email or password.',
  user_not_found: 'Incorrect email or password.',
  email_not_confirmed:
    'Your email address is not confirmed yet. Check your inbox for the verification link, then sign in.',
  user_already_exists: 'An account with this email already exists. Try signing in instead.',
  email_exists: 'An account with this email already exists. Try signing in instead.',
  invalid_email: 'Enter a valid email address.',
  weak_password: 'Password is too weak. Use at least 8 characters.',
  over_request_rate_limit: 'Too many attempts. Please wait a moment and try again.',
  over_email_send_rate_limit: 'Too many emails requested. Please wait a moment and try again.',
};

export function getAuthErrorMessage(error) {
  if (!error) return null;
  return AUTH_ERROR_MESSAGES[error.code] ?? error.message;
}

function normaliseEmail(email) {
  return typeof email === 'string' ? email.trim() : email;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [configError, setConfigError] = useState(
    () =>
      isSupabaseConfigured()
        ? null
        : 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'
  );

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    let active = true;

    // INITIAL_SESSION fires on subscribe, so this alone resolves the first session.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email, password, metadata) => {
    const supabase = getSupabase();
    if (!supabase) {
      return { data: null, error: { message: 'Supabase is not configured.' } };
    }
    const { data, error } = await supabase.auth.signUp({
      email: normaliseEmail(email),
      password,
      options: { data: metadata },
    });
    return { data, error };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const supabase = getSupabase();
    if (!supabase) {
      return { data: null, error: { message: 'Supabase is not configured.' } };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normaliseEmail(email),
      password,
    });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ user, loading, configError, signUp, signIn, signOut }),
    [user, loading, configError, signUp, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useRequireAuth() {
  const { user, loading, configError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && !configError) {
      router.replace('/login');
    }
  }, [loading, user, configError, router]);

  return { user, loading, configError };
}
