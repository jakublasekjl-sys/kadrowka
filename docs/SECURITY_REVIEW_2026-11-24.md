# Przegląd bezpieczeństwa Kadrówki React/PWA

**Aktualizacja tego samego dnia:** przygotowano dodatkową bramkę wydania i standard implementacji. Aktualny stan oraz nierozwiązane warunki produkcyjne opisuje [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md); zalecenia dla innych projektów: [SECURE_DEVELOPMENT_STANDARD.md](SECURE_DEVELOPMENT_STANDARD.md). Audyt zależności powtórzono po przywróceniu dostępu do rejestru: produkcyjne 0, pełne 3 umiarkowane ostrzeżenia narzędziowe.

**Kolejna poprawka:** plik źródłowy PNG z mylącym rozszerzeniem `.jpeg` jest naprawiany po weryfikacji SHA-256. Obecna paczka zawiera 674 materiały i nie pomija plików z błędną sygnaturą. Wynik 673 poniżej opisuje wcześniejszy przebieg testów.

**Data:** 24.11.2026  
**Zakres:** kod frontendu, import i publikacja materiałów, konfiguracja Apache i Azure Static Web Apps, Service Worker, zależności oraz testy lokalnej paczki. **Nie obejmuje** testu penetracyjnego, kontroli działającego zasobu Azure ani kont użytkowników, bo dostępy i docelowa konfiguracja nie są jeszcze dostępne.

## Ocena

Nie ma podstaw do stwierdzenia, że aplikacja jest zabezpieczona przed wszystkimi współczesnymi atakami. Po poprawkach nie ma znanych podatności w zależnościach produkcyjnych (`pnpm audit --prod`), lecz pełny audyt repozytorium nadal zgłasza **3 umiarkowane** ostrzeżenia w zależnościach narzędziowych: `uuid` (ścieżka Capacitor CLI), `glob` i `minimatch` (Capacitor CLI/Workbox). Nie trafiają one do paczki przeglądarkowej, ale wymagają aktualizacji, kiedy wersje nadrzędnych narzędzi staną się zgodne; CI powinno używać odizolowanego środowiska i nie przetwarzać obcych plików z podwyższonymi uprawnieniami.

**Najważniejsza granica:** publiczna PWA i publiczny kontener Blob nie chronią poufnych dokumentów. Katalog materiałów ujawnia ścieżki wszystkich pozycji. Zalogowanie do panelu nie ogranicza odczytu materiałów przez użytkowników. Jeśli choć jeden materiał ma być tylko dla kadry, trzeba przed publikacją zmienić architekturę dostarczania tych plików (autoryzowany odczyt, nie publiczny Blob).

## Ustalenia i zmiany

| Obszar | Stan po zmianie | Pozostałe ryzyko |
|---|---|---|
| Zależności runtime | Capacitor Android 8.4.1 -> 8.5.1, Zod 4.4.3 -> 4.6.6, DOMPurify 3.4.13 -> 3.4.17, parser XML poprawiony przez override. Audyt produkcyjny: 0 znanych podatności. | Wersję natywnego Androida trzeba przebudować i rozdystrybuować osobno; sama aktualizacja React nie naprawia już zainstalowanych APK. |
| Zależności build | Vite 8.1.4 -> 8.1.6, poprawione wersje transitywne w lockfile. Pełny audyt: 3 umiarkowane, 0 wysokich/krytycznych. | Łańcuch dostaw i środowisko CI wymagają dalszego monitoringu. |
| Dostęp do panelu | Domyślnie wyłączony. W SWA `/admin*` wymaga roli `administrator`; link wykonuje pełną nawigację HTTP. Logowanie MSAL jest dodatkowo ograniczone do dzierżawy Entra, a token pozostaje w pamięci karty. | Rola SWA i Azure RBAC muszą być nadane oddzielnie. Reguła SWA nie zabezpiecza nawigacji client-side ani API Blob; RBAC pozostaje właściwą granicą zapisu. |
| Konfiguracja Azure | Identyfikatory Entra i adres kontenera są walidowane. `publicBaseUrl` musi odpowiadać nazwie konta Storage i kontenera. Konfiguracja nie jest precache'owana i ma `Cache-Control: no-store`. | Osoba z prawem modyfikowania plików aplikacji nadal może podmienić kod; potrzebna ochrona procesu wdrożeniowego. |
| Import materiałów | Rozszerzenia, sygnatury, rozmiary, ścieżki i skróty SHA-256 są sprawdzane w panelu. Katalog odrzuca niezgodne typy MIME i ścieżki spoza `files/` lub `releases/.../files/`. | To walidacja po stronie klienta. Użytkownik z `Storage Blob Data Contributor` może ominąć panel i zapisać dowolny obiekt przez API/portal. Nie ma serwerowej kwarantanny ani blokady publikacji do wyniku skanowania antywirusowego. |
| Publikacja | Pliki i katalog wydania są zapisywane tylko, jeśli jeszcze nie istnieją. Wskaźnik `current.json` używa ETag; dokumenty Office są podawane jako załączniki. | Kontrolka po uploadzie sprawdza rozmiar, MIME i metadane, ale nie pobiera ponownie pliku do niezależnego przeliczenia SHA-256. Uprawniony autor nadal może zmienić Blob poza panelem. |
| Treść/XSS | Tekst jest renderowany przez React, brak bezpośredniego wstawiania HTML z SharePointa. CSP blokuje skrypty inline i `eval`, linki wymagają HTTPS, ścieżki blokują traversal i mylące kodowanie. | CSP ma `style-src 'unsafe-inline'` ze względu na aktualny frontend. Materiały Office/PDF mogą zawierać złośliwą zawartość mimo poprawnej sygnatury. |
| Duże/uszkodzone JSON | Treści, katalog Azure i konfiguracja są czytane strumieniowo z limitem bajtów przed parsowaniem; sprawdzany jest typ MIME. | Aplikacja nadal zależy od dostępności hostingu i poprawności publikowanych danych. |
| Dane użytkownika | Plany, notatki i protokoły pozostają w lokalnym IndexedDB; import kopii ma limity i schemat. | Dane oraz eksportowane pliki nie są szyfrowane przez Kadrówkę; osoba z dostępem do odblokowanego profilu/urządzenia może je odczytać. |

## Wymagania przed uruchomieniem produkcyjnym

1. Właściciel treści potwierdza, że **każdy** materiał w publicznym katalogu może być anonimowo dostępny. Jeśli nie, nie włączać publicznego kontenera; zaprojektować autoryzowany odczyt.
2. Administrator Azure tworzy jednodzierżawową aplikację Entra SPA, nadaje zaproszeniem rolę SWA `administrator` tylko upoważnionym osobom, a rolę `Storage Blob Data Contributor` ogranicza do kontenera. Dla konta publikującego wymaga MFA/Conditional Access; nie używa kluczy Storage ani SAS w frontendzie.
3. Storage: HTTPS-only, brak Shared Key, poziom dostępu publicznego najwyżej `Blob` (bez listowania kontenera), CORS wyłącznie z dokładnych domen aplikacji, wersjonowanie/soft delete oraz logi operacji. CORS sam nie jest autoryzacją.
4. Materiały są skanowane i zatwierdzane **przed** aktywacją. Opcjonalny Defender for Storage skanuje asynchronicznie; obecny panel nie czeka na jego wynik. Dla treści od osób trzecich wymagana jest serwerowa kwarantanna i publikacja po wyniku skanowania.
5. Na wdrożonym Azure/Apache sprawdzić TLS, nagłówki CSP/HSTS, 404/MIME, brak listingu, brak plików źródłowych, regułę `/admin` bez sesji i z kontem bez roli, CORS Blob, odmowę PUT bez RBAC, rollback oraz brak sekretów w artefakcie. Test lokalny nie dowodzi poprawnej konfiguracji hostingu.
6. Uruchamiać przed każdą publikacją `pnpm install --frozen-lockfile`, `pnpm deploy:prepare`, `pnpm audit --prod` i `pnpm test:deployment https://ADRES`. Na SWA dodatkowo `KADROWKA_EXPECT_AZURE_ADMIN_ROUTE=1` dla testu niezalogowanego `/admin`. Pełny `pnpm audit` raportować osobno, także dla devDependencies.
7. Gdy nadal będzie rozpowszechniana APK z Capacitor, wykonać `pnpm cap:sync`, zbudować nową APK i zweryfikować wersję biblioteki natywnej. Poprzednia APK nie jest naprawiona przez aktualizację tej PWA.

## Testy tego przeglądu

Wykonano lokalnie build React/TypeScript, walidację treści, testy panelu, testy ścieżek/katalogu/konfiguracji (w tym strumieniowego JSON bez `Content-Length`), test HTTP paczki oraz kontrolę HEAD wszystkich 673 materiałów. `pnpm audit --prod`: 0; pełny `pnpm audit`: 3 umiarkowane ostrzeżenia narzędziowe. Bez docelowych dostępów nie wykonano rzeczywistego uploadu ani prób obejścia uprawnień w Azure. Wcześniejszy raport beta.9 nie może być traktowany jako aktualny wynik skanu zależności.

## Źródła

- [OWASP ASVS 5.0](https://asvs.owasp.org/)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [Microsoft: konfigurowanie Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration)
- [Microsoft: autoryzacja dostępu do Blob](https://learn.microsoft.com/en-us/azure/storage/common/storage-auth-aad-msi)
- [Microsoft: CORS w Azure Storage](https://learn.microsoft.com/en-us/rest/api/storageservices/Cross-Origin-Resource-Sharing--CORS--Support-for-the-Azure-Storage-Services)
- [Microsoft: skanowanie przy przesyłaniu do Storage](https://learn.microsoft.com/en-us/azure/defender-for-cloud/on-upload-malware-scanning)
