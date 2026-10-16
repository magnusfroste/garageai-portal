-- Veckosvep 2026-10-17: ägarpolicyer för UPDATE saknade WITH CHECK, så en användare
-- kunde flytta sina rader (api_keys, chat_conversations, profiles) till en annan användare.
alter policy "Users can update own API keys" on public.api_keys with check (auth.uid() = user_id);
alter policy "Users can update own conversations" on public.chat_conversations with check (auth.uid() = user_id);
alter policy "Users can update own profile" on public.profiles with check (auth.uid() = id);

-- Användare kunde själva skriva trial_credits_usd/used_credits_usd/litellm_token/key_value
-- på sina nycklar. Klienten uppdaterar aldrig api_keys (edge-funktionerna använder
-- service_role), så vi gör som för profiles: bara ofarliga kolumner är skrivbara.
revoke update on public.api_keys from anon, authenticated;
grant update (name, is_active, revoked_at) on public.api_keys to authenticated;
