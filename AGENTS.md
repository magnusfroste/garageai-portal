# Project architecture

- Keep application flow separated as repositories → services/models → hooks → views so data access and UI remain independently maintainable.
- Keep deployment-specific branding in `admin_settings.site_settings`; component defaults are neutral white-label fallbacks.
- Keep signup intent as profile product metadata, never as an authorization role; authorization remains in `user_roles`.
- Route both initial node registration and changed heartbeats through the shared garage registration service so deployment cleanup and catalogue sync stay consistent.
- Keep runtime metadata in one frontend service and backend port allowlisting in one shared edge-function constant so setup commands and validation stay aligned.- Compute garage reliability grades only in the `garage_reliability` database function, fed by the five-minute cron (samples, usage ingest, hourly probes), so every view shows the same numbers.
