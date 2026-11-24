# Przegląd bezpieczeństwa Kadrówki React/PWA

> Raport historyczny. Aktualny stan wydania, w tym naprawę obrazu i 674 materiałów, opisują [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) oraz [GITHUB_HANDOFF.md](GITHUB_HANDOFF.md).

> Raport historyczny dla beta.9. Aktualny przegląd z 24.11.2026 znajduje się w [SECURITY_REVIEW_2026-11-24.md](SECURITY_REVIEW_2026-11-24.md). W szczególności poniższe stwierdzenie o braku znanych podatności zależności nie jest już samodzielnym potwierdzeniem obecnego stanu.

**Data:** 12.08.2026  
**Wersja:** 0.1.0-beta.9  
**Zakres:** kod aplikacji React, generowanie treści ze snapshotów SharePoint, paczka materiałów, import i eksport danych użytkownika, Service Worker, paczka wdrożeniowa Apache oraz środowisko testowe `testowka.drogowskazykultury.org`.

## Wniosek

Po wdrożeniu zmian opisanych w tym raporcie nie znaleziono otwartej podatności krytycznej, wysokiej ani umiarkowanej w kodzie lub zależnościach produkcyjnych. Aplikacja jest statyczną PWA bez backendu: wyszukiwanie działa lokalnie, a plany, notatki, protokoły, ulubione i postęp SSI są przechowywane w IndexedDB urządzenia.

Nie można jednak uznać aplikacji za odpowiednią do publikowania materiałów zastrzeżonych, dopóki nie zapadnie decyzja o ich statusie i ewentualnym logowaniu Microsoft. Obecna architektura udostępnia pliki każdemu, kto zna ich adres. Dane pulpitu nie są szyfrowane przed osobą mającą dostęp do tego samego profilu przeglądarki lub odblokowanego urządzenia.

## Granice zaufania

1. **Pakiet treści i snapshoty SharePoint** są niezaufanym wejściem procesu budowania.
2. **Pliki JSON importowane przez użytkownika** są niezaufanym wejściem aplikacji.
3. **Linki i ścieżki w treściach** nie mogą bezpośrednio sterować `href`, `src` ani ścieżką systemową.
4. **Cache API, IndexedDB i localStorage** mogą być niedostępne, zapełnione albo zawierać stare/uszkodzone dane.
5. **Hosting Apache/LiteSpeed** odpowiada za TLS, nagłówki, MIME, 404 i zablokowanie listingu.

## Wyniki i wdrożone zabezpieczenia

| Obszar | Wynik | Zabezpieczenie |
|---|---|---|
| XSS w treściach | zaliczone | Brak `dangerouslySetInnerHTML`, `innerHTML=`, `eval` i `new Function`; tekst renderuje React. Linki są filtrowane. |
| Parser SharePoint | naprawione | Usunięto wykonywanie danych przez `node:vm`; sekwencje JS są dekodowane parserem bez ewaluacji kodu. |
| Linki | zaliczone | Treści dopuszczają wyłącznie HTTPS bez danych logowania w URL. `javascript:`, `data:`, HTTP i adresy względne z treści są odrzucane. |
| Ścieżki plików | zaliczone | Dozwolone są tylko ścieżki pod `files/`; odrzucane są `..`, ukośniki zakodowane, ścieżki absolutne, dyski Windows i znaki sterujące. |
| Import kopii pulpitu | naprawione | Limit 20 MB, ścisły nagłówek kopii, typy wartości, limity rekordów i tekstów, zakazane klucze prototypu, walidacja znanych obszarów, transakcja IndexedDB i automatyczna kopia przed importem. |
| Import planu | naprawione | Limit 8 MB i ścisły schemat profilu, odpowiedzi, indeksu etapu, pominięć i analiz. Nadmiarowe pola są odrzucane. |
| CSV HALiZ | naprawione | Wartości zaczynające się od `=`, `+`, `-`, `@`, tabulatora lub CR są neutralizowane przed otwarciem w arkuszu. |
| Materiały | naprawione | Allowlista formatów, sygnatury PDF/obrazów, struktura OOXML i brak makr VBA. Jeden błędnie nazwany PNG z rozszerzeniem JPEG jest w kwarantannie i nie trafia do wydania. |
| ZIP | naprawione | Limit 10 000 wpisów i 2 GB po rozpakowaniu, ochrona przed ZIP Slip, symlinkami, szyfrowanymi wpisami i podejrzanym stopniem kompresji. |
| Service Worker | zaliczone | `/content/files/` poza fallbackiem nawigacji; NetworkFirst; cache tylko HTTP 200; automatyczne czyszczenie starych cache i wpisów przy braku miejsca. Dane użytkownika nie są cache'owane przez SW. |
| Brak sieci / materiału | zaliczone | Rozróżnione komunikaty offline, 404, zły MIME/HTML i błąd sieci; ponowienie bez pustej strony. |
| Brak miejsca | naprawione | Sprawdzanie szacowanego miejsca, przerwanie pakietu offline przy quota error i komunikat dla zapisów IndexedDB. |
| Uszkodzone JSON-y | naprawione | Kontrola typu MIME i limitu plików treści, kontrolowany błąd JSON, walidacja kształtu danych lokalnych i granica błędów całego interfejsu. |
| Synchronizacja treści | naprawione | Budowanie w katalogu staging, pełna walidacja przed podmianą, atomowa publikacja, zachowanie poprzedniej paczki i `pnpm content:rollback`. Test wymuszonej awarii potwierdził brak częściowej aktualizacji. |
| Sekrety | zaliczone | Brak `.env`, kluczy prywatnych, tokenów i poświadczeń w kodzie oraz paczce. Wydanie nie zawiera sourcemap ani snapshotów `.aspx`. |
| Zależności | zaliczone | `react-router-dom` podniesiony do 7.18.2, `dompurify` do 3.4.13; `pnpm audit --prod`: brak znanych podatności. |
| Wyszukiwarka | zaliczone | Wyszukiwanie jest lokalnym porównaniem ciągów, bez zapytań do bazy, HTML i wyrażeń regularnych użytkownika; limit 200 znaków. |

## Konfiguracja HTTP

Paczka zawiera `.htaccess` z:

- przekierowaniem HTTP do HTTPS i HSTS na rok;
- restrykcyjnym CSP bez `unsafe-eval`; skrypty tylko z tego samego źródła;
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP i CORP;
- `Options -Indexes`;
- właściwymi MIME dla PDF, DOCX, XLSX, PPTX/PPSX i manifestu PWA;
- 404 dla brakujących plików statycznych, materiałów, plików projektu oraz konfiguracji;
- krótkim cache materiałów z rewalidacją, niezmiennym cache plików z hashem oraz `no-store` dla `index.html`, SW i manifestu.

CSP dopuszcza `unsafe-inline` wyłącznie dla stylów, ponieważ część bibliotek i React wykorzystują atrybuty `style`. `script-src` pozostaje bez `unsafe-inline` i `unsafe-eval`.

## Test środowiska testowego przed ponownym wdrożeniem

Stan sprawdzony 12.08.2026 przed wgraniem beta.9:

- HTTPS i przekierowanie HTTP: poprawne;
- listing `/content/files/`: zablokowany kodem 403;
- brakujący materiał: prawidłowe 404;
- `.env` i `.git/config`: zablokowane;
- brak niepotrzebnego CORS;
- brak CSP i HSTS, `X-Frame-Options` ustawione tylko na `SAMEORIGIN`;
- brakujące `/assets/*.js`, `/package.json` i `/src/main.tsx` były zastępowane aplikacją z kodem 200.

Te ostatnie problemy są naprawione w nowej `.htaccess`, ale wymagają wgrania nowej paczki i ponownego wykonania `pnpm test:deployment https://adres`.

## Testy wykonane

- build TypeScript/Vite i wygenerowanie Service Workera;
- kontrola 72 stron, 12 modułów, 67 narzędzi i 673 publikowanych materiałów;
- test linków, ścieżek, parsera SharePoint, niebezpiecznych API i wzorców sekretów;
- test poprawnej kopii Flutter, uszkodzonego JSON, limitu rozmiaru i niedozwolonych kluczy;
- test awarii synchronizacji i dwukierunkowego rollbacku;
- test DOCX, PDF i neutralizacji formuł CSV;
- test migracji kluczy Flutter -> React -> Flutter;
- `pnpm audit --prod` po aktualizacji zależności: brak znanych podatności.

## Warunki przed produkcją

1. Ustalić, czy wszystkie 673 materiały mogą być publiczne. Jeśli nie, wdrożyć autoryzację również dla plików, nie tylko dla interfejsu.
2. Wgrać pełny katalog `release/kadrowka-web`, łącznie z `.htaccess`, i wykonać test wdrożenia.
3. Przetestować import i eksport na Androidzie i iOS, w tym brak miejsca oraz tryb offline.
4. Uruchamiać w CI: build, `test:security`, `test:imports`, `test:content-sync`, `test:exports`, `test:migration`, `test:pwa` i `pnpm audit --prod`.
5. Przed każdą zmianą źródła SharePoint zachować zatwierdzoną paczkę i używać transakcyjnej synchronizacji; nie publikować stagingu bez raportu `diagnostics.json` ze statusem `ok`.

## Ryzyka resztkowe

- Brak logowania oznacza publiczny dostęp do aplikacji i materiałów.
- Dane pulpitu są chronione mechanizmami urządzenia i profilu przeglądarki, ale nie osobnym szyfrowaniem Kadrówki.
- Eksportowane JSON, DOCX, PDF i CSV są zwykłymi plikami; użytkownik odpowiada za miejsce ich zapisania i udostępnianie.
- HSTS nie ma `includeSubDomains`, aby nie wymusić HTTPS na niezinwentaryzowanych subdomenach organizacji.
- Test nie zastępuje zewnętrznego pentestu hostingu ani kontroli konfiguracji konta Zenbox.

## Źródła kontrolne

- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- OWASP CSP Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- OWASP Input Validation Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- OWASP HTML5 Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html
