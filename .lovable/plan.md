# Plan: GarageAI-brandning och intentbaserad onboarding

## Mål
Göra denna installation till GarageAI utan att ta bort white-label-stödet: allt varumärkes- och landningsinnehåll fortsätter hämtas från admininställningarna. Nya och befintliga användare får samtidigt en svensk, intentbaserad väg in som köpare, operatör eller båda.

## Genomförande

### 1. Uppdatera lagrat innehåll för denna installation
- Ersätt posten `site_settings` med GarageAI-namn, titel, beskrivning, hero, tre feature-kort, CTA-, footer-, SEO- och AEO-innehåll enligt briefen.
- Behåll tekniska värden som API- och NetBird-adresser samt befintliga synlighets- och avgiftsinställningar.
- Ta bort gamla PrivAI/Privat AI/Sverige-påståenden, gamla länkar och gamla OG-bildreferenser ur den lagrade posten.
- Behåll robotsregeln och sätt sitemap till GarageAI:s startsida.
- Använd befintlig favicon som neutral ikon och lämna `logo_url` tom så den dynamiska ikon+text-logotypen används.

### 2. Gör båda hero-knapparna white-label-konfigurerbara
- Lägg till lagrade fält för primär CTA-URL samt sekundär CTA-text och URL.
- Visa `Använd AI` till `/auth?intent=buyer` och `Erbjud din GPU` till `/auth?intent=operator`.
- Lägg till motsvarande redigerbara fält i adminens landningsinställningar.
- Behåll bakåtkompatibla standardvärden så andra white-label-installationer inte bryts.

### 3. Utöka profil och registrering säkert
Applicera en idempotent migration som:
- lägger till `profiles.signup_intent text` med kontrollen `buyer`, `operator` eller `NULL`;
- lägger till `profiles.onboarding_done boolean not null default false`;
- uppdaterar `handle_new_user()` så signup-metadata kopieras atomiskt till profilen, utan att ändra första-användaren-blir-admin-logiken;
- behåller RLS och utökar column-level UPDATE till `full_name`, `company`, `signup_intent` och `onboarding_done` för `authenticated`; `anon` får ingen UPDATE.

### 4. Separera intent- och onboardinglogik
- Lägg typer, lokal lagring och validering i en egen onboardingmodell/service.
- Utöka profile repository/service/hook med de två nya profilfälten och en avgränsad onboardinguppdatering.
- `/auth` läser endast `buyer|operator`, lagrar värdet före signup, skickar det som signup-metadata och använder en säker callback till samma origin.
- Efter session och profilladdning prioriteras lagrat URL-intent, därefter profilens metadata-intent. När det används markeras onboarding klar och lokal lagring rensas.

### 5. Bygg första inloggningens vägval
- Operator går direkt till `/dashboard/offer-gpu`.
- Buyer går till dashboarden, där en kompakt svensk **Kom igång**-sektion länkar till API-nycklar, chatten och API-sidan.
- Användare utan intent och med `onboarding_done = false` går till `/onboarding` och väljer:
  - **Använda AI** → sparar buyer och går till dashboarden.
  - **Erbjuda min GPU** → sparar operator och går till GPU-guiden.
  - **Båda – visa mig runt** → markerar onboarding klar och går till dashboarden.
- Intentbaserade rubriker visas på registreringssidan. Befintliga användare får valet exakt en gång.

### 6. Svenska navigationsetiketter och köparnamn
- Gör användarsidans meny och toppfält konsekvent svenska, inklusive Profil och Logga ut; admininnehållet lämnas oförändrat.
- Visa modellnivån `dedicated` som **Specifikt garage** och `pool` som **Pool** endast i köparvyer. Databasvärden och adminens tekniska namn ändras inte.
- Ta bort kvarvarande hårdkodad PrivAI-text från den dashboardyta som berörs.

### 7. Auth-domän
- Sätt auth Site URL till `https://app.garageai.eu`.
- Behåll befintliga Lovable-previewadresser och `https://app.garageai.eu/**` i redirect-listan.
- Bekräftelselänkar använder `/auth` på samma origin så intent från profilen fortfarande kan lösas efter e-postbekräftelse.

## Tekniska detaljer
- Nya filer skapas före importörer och följer projektets lager: repository → service/model → hook/view.
- White-label-innehåll seedas inte i komponenterna; installationsspecifika värden skrivs endast till `admin_settings.site_settings`.
- Den statiska sidhuvud-fallbacken får GarageAI:s korrekta domänmetadata och ingen gammal OG-bild, medan den dynamiska rendering som redan finns fortsatt använder lagrade SEO-värden.
- Ingen roll eller behörighet lagras i profilen; onboardingfälten är endast produktpreferenser.

## Verifiering
- Kontrollera databaskolumner, constraints, grants och att triggern bevarar admin-bootstrap.
- Testa buyer-, operator- och intentlös registrering/inloggning, inklusive omladdning och återkomst från bekräftelselänk om en testsession kan skapas.
- Kontrollera att intent rensas lokalt efter användning och att valet inte visas igen.
- Kontrollera hero-knappar, svenska menyer, Kom igång-länkar och tieretiketter i desktop och mobil.
- Kontrollera live auth-konfiguration, preview-redirects, byggstatus, runtime-fel och den renderade sidans metadata.

## Antaganden
- “Båda” sparar inget särskilt `signup_intent`; det markerar bara onboarding klar och öppnar dashboarden.
- **Kom igång** visas för profiler med buyer-intent; användare som väljer “Båda” landar på den vanliga dashboarden.
- Befintlig e-post/lösenordsinloggning behålls; inga nya inloggningsleverantörer läggs till i denna ändring.
