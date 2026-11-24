# Standard bezpieczeństwa aplikacji webowych ZHP

**Wersja:** 1.1, 24.11.2026. **Zakres:** React/PWA, API, importy plików, repozytorium, CI/CD i wdrożenia w Azure. Stosować do nowych funkcji od projektu po odbiór. Punktem odniesienia do weryfikacji jest [OWASP ASVS 5.0](https://asvs.owasp.org/); dla aplikacji przetwarzających dane kadry celować co najmniej w poziom 2, a wymagania dopasować do analizy ryzyka. Żaden automatyczny test nie gwarantuje pełnego bezpieczeństwa.

## 1. Decyzja o danych i granicach zaufania

- Przed kodowaniem sklasyfikować osobno treści redakcyjne, dokumenty do pobrania, dane wpisywane przez użytkownika, logi i kopie zapasowe: publiczne, wewnętrzne, poufne. Wskazać właściciela każdej kategorii i okres przechowywania.
- Rysunek przepływu danych musi pokazywać przeglądarkę, Service Workera, CDN/hosting, dostawcę tożsamości, API, Blob, lokalny IndexedDB, eksporty i importy. Zaznaczyć, gdzie jest rzeczywista autoryzacja. Ukryty przycisk ani trasa React nie są barierą.
- Przy zmianie architektury lub dodaniu nowego źródła plików zaktualizować model zagrożeń: anonimowy użytkownik, złośliwy autor treści, przejęte konto administratora, błędna konfiguracja, uszkodzony plik, niedostępna sieć i niepełne wdrożenie.
- Materiał prywatny nie może trafić do publicznego katalogu, paczki PWA ani kontenera Blob z anonimowym odczytem. CORS nie ogranicza odczytu dla osoby znającej URL. Dla danych prywatnych użyć autoryzowanego odczytu po stronie serwera.
- Widoczność repozytorium to osobna decyzja od widoczności wdrożonej aplikacji. Przed publikacją kodu ocenić również osadzone JSON-y, obrazy, teksty, linki i metadane; prywatne repozytorium jest domyślnym etapem przed zatwierdzeniem praw i zakresu publicznej dystrybucji treści.

**Dowód odbioru:** zatwierdzona klasyfikacja i diagram przepływu; spis publicznych zasobów dostępnych anonimowo.

## 2. Tożsamość i uprawnienia

- Dla administratora użyć organizacyjnego Entra ID, wymusić MFA/Conditional Access i zasadę najmniejszych uprawnień. Osobno nadać prawo wejścia do panelu i prawo zapisu do Storage/API.
- Sprawdzać tożsamość i uprawnienie na **każdej operacji serwerowej**. Nie opierać bezpieczeństwa na React Routerze, widoczności elementu UI, CORS, nazwie pliku ani samym tokenie zapisanym przez frontend.
- Frontend nie może zawierać client secret, klucza Storage, connection stringa ani długotrwałego SAS. Identyfikatory tenant/client i adresy zasobów nie są sekretami, ale konfiguracja musi być walidowana i ograniczona do właściwej dzierżawy.
- Rejestrować operacje administracyjne (kto, kiedy, jakie wydanie, wynik), bez wpisywania tokenów i treści prywatnych do logów. Zapewnić wycofanie uprawnień i sesji po odejściu administratora.

**Dowód odbioru:** test użytkownika anonimowego, zwykłego, administratora i administratora pozbawionego RBAC; próba zapisu poza UI kończy się odmową, jeżeli dany typ zapisu nie jest dozwolony.

## 3. Materiały i import plików

- Dopuszczać tylko potrzebne formaty, limity liczby/rozmiaru, bezpieczne ścieżki i nazwy. Weryfikować sygnaturę, typ MIME, strukturę dokumentu i skrót po stronie zaufanej. Same rozszerzenia i `Content-Type` z przeglądarki nie wystarczają.
- Paczki źródłowe otrzymane poza repozytorium identyfikować skrótem SHA-256 i kontrolować ich pochodzenie. Sprawdzać każdy wpis katalogu względem pliku, typu i skrótu. Rozbieżność wstrzymuje build lub publikację. Naprawa znanego błędu źródła może być automatyczna tylko wtedy, gdy ma jawny warunek, przypięty skrót wejścia, test i ślad w raporcie; nowych błędów nie obejmuje automatycznie.
- Przy treściach od osób trzecich: osobny obszar kwarantanny, skanowanie i walidacja po uploadzie, wynik `clean` jako warunek publikacji, ręczna obsługa `failed`/`timeout`. Skanowanie asynchroniczne nie może być traktowane jako zgoda natychmiast po PUT.
- Publikować niemutowalne pliki wydania, katalog ze skrótami i wskaźnik aktywnej wersji aktualizowany warunkowo (ETag). Błąd jednego pliku wstrzymuje publikację; nie pomijać go po cichu. Utrzymywać rollback, soft delete i test odtworzenia.
- Dla publicznych PDF i obrazów wymusić prawidłowy MIME i `nosniff`. Dokumenty Office podawać jako załączniki. Nie dopuszczać HTML/SVG z niezaufanych źródeł jako materiałów do bezpośredniego wyświetlania.

**Dowód odbioru:** próby złego typu, makra, traversal, duplikatu nazwy, przekroczenia limitu, uszkodzonego archiwum, zmienionego skrótu źródła, przerwanego uploadu i cofnięcia wersji; raport kompletności katalogu.

## 4. Kod aplikacji i PWA

- React ma renderować tekst jako tekst. Każde wstawienie HTML wymaga uzasadnienia, sanizacji po stronie zaufanej i testu XSS. Linki ograniczyć do potrzebnych protokołów, a ścieżki do własnego katalogu.
- CSP: `script-src 'self'` bez `unsafe-inline` i `unsafe-eval`; `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`. Zewnętrzne źródła przypinać do dokładnych originów, bez globalnych wildcardów. Dodatkowo HTTPS, HSTS, `nosniff`, bezpieczne cache i brak listingu katalogów.
- Service Worker nie może zamienić 404 materiału w `index.html`, precache'ować konfiguracji administratora ani zapisać prywatnych danych w publicznym cache. Testować aktualizację i czyszczenie starych cache.
- Import kopii danych: limit bajtów i liczby obiektów przed parsowaniem, schemat, kontrola spójności i transakcyjny zapis. Odrzucać uszkodzone pliki bez utraty istniejących danych.
- Dane w IndexedDB nie są szyfrowane przez samą przeglądarkową aplikację. Wprost informować użytkownika o urządzeniu, kopiach, eksporcie i ryzyku współdzielonego profilu. Nie deklarować synchronizacji ani ochrony, których nie ma.

**Dowód odbioru:** testy XSS, importu, 404/MIME, offline/online, małej pamięci, aktualizacji SW i eksportu na telefonie.

## 5. Proces dostarczania

- Przed pierwszym commitem i każdym wydaniem przejrzeć dokładną listę plików przygotowanych do wysłania. Nie commitować paczek źródłowych, eksportów użytkowników, lokalnych kopii, plików `.env`, sekretów, niezatwierdzonych snapshotów SharePoint ani wynikowych buildów. Skan sekretów i push protection włączyć, jeśli pozwalają na to ustawienia organizacji; nie zastępują przeglądu człowieka.
- Budować z przypiętego lockfile w czystym CI, z ograniczonymi uprawnieniami tokenu `GITHUB_TOKEN`. Przypinać używane akcje do pełnego SHA albo stosować obsługiwany lockfile zależności workflow. Uruchamiać testy, skan zależności produkcyjnych i pełny skan łańcucha build (z udokumentowanymi wyjątkami). Nie publikować map źródłowych ani artefaktów źródłowych bez świadomej decyzji.
- Zabezpieczyć gałęzie wydaniowe przed bezpośrednim nadpisaniem; wymagać przeglądu i przejścia kontroli CI. Oddzielić środowisko testowe od produkcyjnego, tożsamości i uprawnienia. Do Azure stosować federację OIDC zamiast długowiecznych sekretów wdrożeniowych; uprawnienia zawęzić do właściwego środowiska i zasobu.
- Duże paczki treści dostarczać do CI oddzielnym, kontrolowanym kanałem. Skrypt build nie może zależeć od niewersjonowanego pliku na dysku autora bez jawnej instrukcji pobrania, kontroli skrótu i obsługi braku pliku.
- Testy wizualne ustabilizować względem liczników, czasu, losowości i dostępności sieci. Zmian wzorców nie akceptować zbiorczo bez obejrzenia różnic; testy zachowania i dostępności pozostają oddzielnym wymogiem.
- Produkcyjne wdrożenie wymaga przeglądu zmian, podpisanej klasyfikacji treści i zapisanych wyników testów. Nie używać ręcznej edycji plików na serwerze jako trwałego procesu.
- Po wdrożeniu sprawdzić *rzeczywistą domenę*: TLS, nagłówki, uprawnienia, CORS, `404`, MIME, pobranie wszystkich materiałów, brak sekretów, działanie offline, publikację i rollback. Wynik lokalny nie zastępuje testu hostingu.
- Monitorować błędy, nieudane logowania i publikacje, dostępność materiałów oraz skany zależności. Określić właściciela dyżuru, kontakt do zgłoszeń, procedurę wycofania wydania i reakcji na incydent. Przegląd uprawnień wykonywać okresowo.

**Dowód odbioru:** lista plików commita, konfiguracja ochrony gałęzi i uprawnień CI, raport kontroli paczki treści, wynik testu po wdrożeniu, protokół przeglądu uprawnień i plan rollbacku. Wyjątki od standardu mają właściciela, termin i akceptację ryzyka.

## 6. Trzy odrębne decyzje wydaniowe

1. **Kod w prywatnym repozytorium:** można przekazać po kontroli plików, sekretów i klasyfikacji zawartości repozytorium. To nie jest zgoda na publiczny dostęp do treści ani na wdrożenie.
2. **Powtarzalny build w CI:** wymaga dostarczenia wszystkich wejściowych paczek poza repozytorium, kontroli ich skrótów, przypiętych zależności i zaliczonych testów. Build z lokalnego dysku autora nie jest dowodem odtwarzalności.
3. **Wdrożenie produkcyjne:** wymaga zatwierdzenia publiczności każdego materiału, kontroli dostępu administracyjnego, dowodów testów na rzeczywistej domenie, monitoringu i sprawdzonego rollbacku.

Wydanie można nazwać produkcyjnym dopiero, gdy wszystkie obowiązkowe kontrole wyżej mają dowód, ryzyka resztkowe są jawne i zaakceptowane przez właściciela systemu, a testy na docelowej infrastrukturze przeszły. „Brak znalezionych podatności” nie oznacza „brak podatności”.

**Źródła normatywne i techniczne:** [OWASP ASVS](https://asvs.owasp.org/), [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [Microsoft SWA routing/roles](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration), [Microsoft Azure Blob security](https://learn.microsoft.com/en-us/azure/storage/blobs/secure-blobs), [Microsoft Defender for Storage scanning](https://learn.microsoft.com/en-us/azure/defender-for-cloud/introduction-malware-scanning), [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use), [GitHub OIDC dla Azure](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-azure), [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches), [GitHub push protection](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/prevent-future-leaks/enable-push-protection).
