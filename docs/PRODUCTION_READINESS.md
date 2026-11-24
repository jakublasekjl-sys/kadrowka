# Warunki uruchomienia produkcyjnej Kadrówki

**Stan na 24.11.2026:** przygotowana jest kontrolowana paczka publicznej PWA, ale nie ma dowodów na poprawną konfigurację docelowego Azure, uprawnienia ani decyzję właściciela o jawności wszystkich materiałów. Nie deklarować pełnego zabezpieczenia produkcyjnego przed wykonaniem poniższych kroków.

## Co wymusza kod

- `pnpm deploy:prepare` zatrzymuje wydanie, jeśli materiał nie przejdzie weryfikacji sygnatury, przekroczy 128 MB, koliduje nazwą po normalizacji lub źródło zawiera dowiązanie symboliczne. Nie usuwa poprzedniej paczki przed kontrolą źródła. Obraz PNG nazwany w źródle `.jpeg` jest naprawiany tylko po sprawdzeniu przypiętego SHA-256; nie ma już wyjątków pozwalających pominąć uszkodzony plik.
- CSP w paczce zezwala tylko na lokalne zasoby i, jeśli Azure jest włączony, **konkretne** konto Blob z `runtime-config.json`. Nie ma `*.blob.core.windows.net`.
- `pnpm release:production` uruchamia budowę, testy, audyt zależności produkcyjnych, kontrolę kompletności 674 plików i lokalny test HTTP. Wymaga `KADROWKA_PRODUCTION_ORIGIN` oraz ręcznego potwierdzenia `KADROWKA_PUBLIC_MATERIALS_APPROVED=1`. Wartość środowiskowa to zapis decyzji, nie techniczny dowód klasyfikacji.
- Obecny panel zapisuje bezpośrednio do Blob. Wydanie produkcyjne **blokuje jego włączenie**, bo walidacja w przeglądarce nie stanowi granicy bezpieczeństwa. Panel można nadal testować na odrębnym środowisku. Włączenie go produkcyjnie wymaga serwerowej kontroli uploadu/publikacji albo osobnej, udokumentowanej akceptacji zmienionego modelu ryzyka i nowego procesu odbioru.

## Zadania właściciela treści i administratora

1. Właściciel treści przegląda listę materiałów, potwierdza ich publiczny status i brak danych osobowych/poufnych. Jeżeli któryś materiał jest tylko dla kadry, **wstrzymać publikację publicznego katalogu**; potrzebny jest autoryzowany odczyt, nie sam ekran logowania.
2. Administrator sprawdza SWA, domenę, TLS/HSTS, rolę `/admin`, Entra, MFA, RBAC, CORS, publiczny poziom dostępu kontenera, wyłączenie Shared Key, soft delete, wersjonowanie i logi. Dla publicznego kontenera dopuszcza najwyżej poziom `Blob`, nie `Container`.
3. Dla produkcyjnego panelu publikacji zaprojektować API z autoryzacją każdej operacji, walidacją po stronie serwera, kwarantanną oraz aktywacją dopiero po wyniku skanowania. Obecny dostęp `Storage Blob Data Contributor` pozwala uprawnionej osobie ominąć UI. Defender skanuje asynchronicznie i sam nie blokuje aktywacji wskaźnika.
4. Ustalić retencję logów, właściciela operacyjnego, procedurę wycofania wydania, zarządzanie kluczami/uprawnieniami i komunikację przy incydencie. Dane Pulpitu pozostają lokalne i ich eksport wymaga ostrożnego przechowywania przez użytkownika.

## Komendy odbioru

Po podpisanym przeglądzie jawności materiałów, w PowerShell:

```powershell
cd C:\KadraZHP\kadrowka_react
$env:KADROWKA_PRODUCTION_ORIGIN = 'https://kadrowka.zhp.pl'
$env:KADROWKA_PUBLIC_MATERIALS_APPROVED = '1'
pnpm install --frozen-lockfile
pnpm release:production
Remove-Item Env:KADROWKA_PUBLIC_MATERIALS_APPROVED
```

Po wdrożeniu na **rzeczywistej** domenie:

```powershell
pnpm test:deployment https://kadrowka.zhp.pl
pnpm test:materials:deployment https://kadrowka.zhp.pl
```

Na Azure SWA ustawić `KADROWKA_EXPECT_AZURE_ADMIN_ROUTE=1` dla testu niezalogowanego `/admin` i wykonać osobno próbę z kontem bez roli. Dodatkowo sprawdzić odczyt/próbę zapisu Blob z kontami bez RBAC oraz ze zwykłym kontem. Żadna lokalna kontrola nie potwierdza tych uprawnień.

## Status

**Wynik lokalny 24.11.2026:** `pnpm deploy:prepare`, `pnpm test:security`, `pnpm test:deployment:local` i regresja 18 widoków przeszły; lokalny test HTTP sprawdził wszystkie 674 materiały. Negatywny test bez potwierdzenia jawności poprawnie zatrzymał wydanie. Pozytywny test bramki z *symulowanym* potwierdzeniem przeszedł, ale nie stanowi zgody właściciela treści. `pnpm audit --prod`: 0 znanych podatności. Pełny `pnpm audit`: 3 umiarkowane ostrzeżenia w zależnościach narzędziowych `uuid`, `glob` i `minimatch` (Capacitor CLI/Workbox), 0 wysokich/krytycznych. Nie podmieniono ich wymuszoną aktualizacją głównej wersji, bo wymagałoby to sprawdzenia zgodności narzędzi. Środowisko CI musi być izolowane i bez podwyższonych uprawnień. Całe `pnpm release:production` trzeba wykonać po rzeczywistej decyzji właściciela treści.

| Obszar | Status |
|---|---|
| Kod klienta i paczka | Kontrole lokalne do uruchomienia przy każdym wydaniu. |
| Jawność wszystkich materiałów | Wymaga decyzji właściciela treści. |
| Azure, role i domena produkcyjna | Wymaga konfiguracji i testu na docelowym zasobie. |
| Produkcyjny panel publikacji | Zablokowany w bramce wydania; potrzebna kontrola po stronie serwera. |
| Pentest / niezależny przegląd | Nie wykonano; zaplanować przed szerszym udostępnieniem. |

Zasady ogólne: [SECURE_DEVELOPMENT_STANDARD.md](SECURE_DEVELOPMENT_STANDARD.md). Wcześniejszy przegląd kodu: [SECURITY_REVIEW_2026-11-24.md](SECURITY_REVIEW_2026-11-24.md).
