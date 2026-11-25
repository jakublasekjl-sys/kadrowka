# Kadrówka React

Podstawowa wersja Kadrówki działa jako aplikacja webowa/PWA. Użytkownik otwiera ją pod stałym adresem i może zainstalować z przeglądarki na ekranie telefonu. Opakowanie Capacitor Android pozostaje opcjonalne. Wersja Flutter w `C:\KadraZHP\kadra_zhp_offline` jest źródłem zachowania do czasu zamknięcia macierzy zgodności.

## Uruchomienie

```powershell
cd C:\KadraZHP\kadrowka_react
pnpm dev
```

Serwer lokalny korzysta z materiałów w `C:\KadraZHP\package\content-package\files`. Po zmianie paczki ZIP wykonaj jednorazowo:

```powershell
pnpm content:files
```

Budowa w CI wymaga osobnego dostarczenia `source/content-package.zip` (nie jest dodawany do Git). Skrypt `pnpm source:check` porównuje go z oczekiwanym SHA-256. Ścieżkę można ustawić przez `KADROWKA_CONTENT_ZIP`. Szczegóły: [docs/GITHUB_HANDOFF.md](docs/GITHUB_HANDOFF.md).

## Kontrole

```powershell
pnpm lint
pnpm content:enrich
pnpm content:validate
pnpm test:migration
pnpm test:exports
pnpm build
pnpm test:pwa
pnpm test:visual
pnpm deploy:prepare
pnpm test:deployment https://adres-testowej-kadrowki.pl
pnpm test:materials:deployment https://adres-testowej-kadrowki.pl
```

`content:enrich` odtwarza z zapisanych stron SharePoint formatowanie inline i akcje obrazów. `content:validate` porównuje manifest, strony, moduły, wyszukiwarkę, cele linków i fizyczne pliki w ZIP-ie. Błąd kończy build kodem różnym od zera. Ostrzeżenia są pokazywane także w Ustawieniach.

## Web/PWA

Build z katalogu `dist` wymaga kompletnego zestawu materiałów. Dla zwykłego hostingu pełny katalog `release/kadrowka-web` udostępnia `content/files` pod tym samym adresem. Dla Azure Static Web Apps użyj `pnpm azure:stage`: aplikacja trafia do SWA, a pliki do Azure Blob; katalog materiałów jest przypięty do konkretnej wersji aplikacji. Materiały otwierają się od razu online i są zapamiętywane przy pierwszym użyciu; przed wyjazdem użytkownik może opcjonalnie pobrać wybrany moduł.

Do testowego wdrożenia użyj `pnpm deploy:prepare`. Polecenie tworzy gotowy katalog `release/kadrowka-web` zawierający build i 674 zweryfikowane materiały (około 805 MB). Pomija 61 surowych kopii stron SharePoint `.aspx`. Jeden obraz źródłowy zapisany jako PNG pod nazwą `.jpeg` jest weryfikowany skrótem i publikowany pod poprawną nazwą `.png`. Na serwer należy wysłać **zawartość tego katalogu**, nie katalog `package/content-package/files`.

Po publikacji uruchom `pnpm test:deployment` z adresem wdrożenia. Test sprawdza HTTPS, Start, bezpośrednią trasę React, Service Workera, manifest i ikony PWA, grafikę Startu, przykładowy materiał oraz poprawne HTTP 404 dla brakującego pliku. `pnpm test:materials:deployment` wykonuje kontrolę wszystkich 674 materiałów bez pobierania ich pełnej zawartości.

Test `pnpm test:visual` uruchamia lokalnego Chrome lub Edge i porównuje 18 kontrolnych zrzutów: Start, Model przywództwa, jego zakładkę Materiały, Narzędzia, Planowanie, Pulpit, Ustawienia, Instalację na telefonie i Samouczek w widoku 390×844 oraz 1366×768. Sprawdza też przewijanie poziome i niedostępne obrazy. Po świadomej zmianie wyglądu zaktualizuj wzorce poleceniem `pnpm test:visual:update`, a następnie ponownie uruchom zwykły test.

Instrukcja instalacji dla Androida i iPhone'a znajduje się pod ikoną telefonu w górnym pasku. Aktualizacje nie przeładowują aplikacji bez wiedzy użytkownika: po wykryciu nowej wersji pojawia się komunikat `Zaktualizuj`.

## Android opcjonalny

Standardowa synchronizacja kodu:

```powershell
pnpm cap:sync
```

Pełna paczka do testów bez dostępu do serwera materiałów:

```powershell
pnpm cap:sync:full
```

Pełna paczka dodaje około 804 MB bezpiecznych materiałów do zasobów projektu Android. Jest przeznaczona wyłącznie do testów i instalacji bezpośredniej. Publikacja w Google Play nie jest wymagana dla wersji web/PWA.

## Dokumentacja

- `docs/MIGRATION.md` - architektura migracji i dystrybucji treści;
- `docs/DEPLOYMENT.md` - przygotowanie paczki i konfiguracja serwera testowego;
- `docs/GITHUB_HANDOFF.md` - źródła treści i wymagania CI przed przeniesieniem na GitHub;
- `docs/PARITY_MATRIX.md` - stan funkcji Flutter -> React;
- `C:\KadraZHP\kadra_zhp_offline\docs\BACKLOG.md` - główny backlog i reguły migracji SharePoint.
