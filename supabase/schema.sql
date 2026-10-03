-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
-- user_id and username are UNIQUE, which already create supporting btree indexes,
-- so no separate indexes are declared below.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,
  username VARCHAR(20) UNIQUE NOT NULL,
  display_name VARCHAR(30) NOT NULL,
  profile_picture TEXT,
  bio TEXT,
  game_dls BOOLEAN DEFAULT FALSE,
  game_efootball BOOLEAN DEFAULT FALSE,
  game_fcmobile BOOLEAN DEFAULT FALSE,
  game_cod BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles table
-- PostgreSQL unions permissive policies per command, so only one policy is needed
-- per operation. Note: profiles are intentionally world-readable.

-- Anyone can view profiles (for public profiles feature)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Users can update only their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Profiles are created only by the handle_new_user trigger below. There is
-- deliberately no INSERT policy, so clients cannot forge arbitrary profiles.

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INTEGER := 1;
BEGIN
  -- Prefer the username supplied by the signup form; fall back to the email local part.
  base_username := COALESCE(
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'username'), ''),
    SPLIT_PART(NEW.email, '@', 1)
  );
  base_username := LEFT(base_username, 20);

  -- profiles.username is UNIQUE; never let a collision abort the auth user insert.
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := LEFT(base_username, 20 - LENGTH(suffix::TEXT) - 1) || suffix::TEXT;
  END LOOP;

  INSERT INTO public.profiles (
    user_id,
    username,
    display_name,
    profile_picture,
    game_dls,
    game_efootball,
    game_fcmobile,
    game_cod
  )
  VALUES (
    NEW.id,
    final_username,
    LEFT(COALESCE(
      NULLIF(BTRIM(NEW.raw_user_meta_data->>'display_name'), ''),
      base_username
    ), 30),
    NULLIF(NEW.raw_user_meta_data->>'profile_picture', ''),
    COALESCE((NEW.raw_user_meta_data->>'game_dls')::BOOLEAN, FALSE),
    COALESCE((NEW.raw_user_meta_data->>'game_efootball')::BOOLEAN, FALSE),
    COALESCE((NEW.raw_user_meta_data->>'game_fcmobile')::BOOLEAN, FALSE),
    COALESCE((NEW.raw_user_meta_data->>'game_cod')::BOOLEAN, FALSE)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Trigger to call the function on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on profile changes
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
