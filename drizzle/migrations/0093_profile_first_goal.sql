ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_goal text CHECK (first_goal IN ('look','use','own_machine','share'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_goal_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_goal_asked boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.profiles.first_goal IS 'Onboarding answer to "What do you want to do first?"; null = skipped or never asked';
COMMENT ON COLUMN public.profiles.first_goal_asked IS 'True when the onboarding question was shown and answered or skipped (not for link-intent accounts)';
GRANT UPDATE (first_goal, first_goal_at, first_goal_asked) ON public.profiles TO authenticated;