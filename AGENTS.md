# Project architecture

- Keep application flow separated as repositories → services/models → hooks → views so data access and UI remain independently maintainable.
- Keep deployment-specific branding in `admin_settings.site_settings`; component defaults are neutral white-label fallbacks.
- Keep signup intent as profile product metadata, never as an authorization role; authorization remains in `user_roles`.