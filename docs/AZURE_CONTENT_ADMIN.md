# Panel materiałów i Azure Blob Storage

## Zakres przygotowanej integracji

Kadrówka może nadal działać z lokalną paczką `/content/files`, ale potrafi również pobrać aktywny katalog materiałów z Azure Blob Storage. Przełączenie odbywa się wyłącznie przez `runtime-config.json`; kod aplikacji i treści modułów nie wymagają ręcznego przepinania ścieżek.

Panel pod `/admin` zapewnia:

- wybór całego folderu albo wielu plików;
- walidację ścieżek, rozmiaru, rozszerzenia i podstawowej sygnatury pliku;
- obliczanie SHA-256 i wykrywanie plików nowych, podmienianych, niezmienionych oraz duplikatów;
- zachowanie stabilnych identyfikatorów materiałów i dotychczasowych miejsc użycia;
- zbiorcze przypisanie paczki do jednego lub wielu modułów;
- eksport raportu wydania przed publikacją;
- przesyłanie do niezmiennego katalogu `releases/{releaseId}`;
- publikację wersjonowanego katalogu `catalog/{releaseId}.json`;
- atomową aktywację przez zmianę `catalog/current.json` dopiero po wysłaniu plików i katalogu;
- przywrócenie poprzedniego wydania bez kasowania plików.

Panel nie przechowuje klucza konta Storage, connection stringa ani sekretu aplikacji. Logowanie SPA używa Microsoft Entra Authorization Code Flow z PKCE, a token MSAL pozostaje tylko w pamięci karty. Po odświeżeniu strony administrator może musieć zalogować się ponownie. Domyślnie panel jest wyłączony w `runtime-config.json`.

**Status produkcyjny:** bezpośredni zapis do Blob pozostaje trybem testowym. `pnpm release:production` blokuje włączony panel, bo walidację przeglądarkową może ominąć konto z uprawnieniem Storage. Warunki bezpiecznej publikacji opisuje [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md). Po włączeniu Azure skrypt budujący paczkę przypina CSP do dokładnego konta Blob; nie należy dodawać `*.blob.core.windows.net`.

## Zasoby do utworzenia przez administratora Azure

1. Azure Static Web Apps dla aplikacji React/PWA, z domeną produkcyjną `kadrowka.zhp.pl`. Środowisko testowe może być osobnym zasobem albo środowiskiem podglądowym z brancha/PR.
2. Konto StorageV2 i jeden kontener Blob o nazwie `content`.
3. Włączone wersjonowanie obiektów oraz soft delete, np. na 30 dni.
4. Publiczny odczyt **pojedynczych blobów** (poziom `Blob`, bez listowania kontenera) tylko po pisemnym potwierdzeniu, że wszystkie materiały i katalog mogą być jawne. Katalog ujawnia nazwy i adresy materiałów. Zapis nadal wymaga konta Entra i uprawnienia Azure RBAC.
5. Jednodzierżawowa rejestracja aplikacji Microsoft Entra typu Single-page application. Dla konta publikującego włączyć MFA lub silniejszą politykę Conditional Access.
6. Adresy przekierowania SPA:
   - `https://kadrowka.zhp.pl/admin`
   - adres testowy zakończony `/admin`
   - lokalnie, tylko na czas prac: `http://localhost:4173/admin` lub używany port Vite.
7. Delegowane uprawnienie Azure Storage `user_impersonation`.
8. Dla konta administratora materiałów rola `Storage Blob Data Contributor` ograniczona do kontenera `content`. Bez tego bezpośredni upload z przeglądarki nie zadziała. Na koncie Storage wyłączyć autoryzację Shared Key, włączyć HTTPS-only, wersjonowanie i soft delete oraz diagnostykę dostępu.
9. W Azure Static Web Apps nadać temu samemu użytkownikowi rolę `administrator` przez **Role Management > Invite** (dostawca Microsoft Entra ID). To dodatkowa bramka dla `/admin`; sama rola SWA nie daje zapisu do Blob, a sam RBAC nie daje dostępu do strony panelu.

## CORS konta Storage

Reguła CORS usługi Blob powinna wskazywać dokładne domeny aplikacji, bez `*` w produkcji. CORS nie jest mechanizmem autoryzacji:

- Allowed origins: domena produkcyjna i domena testowa;
- Allowed methods: `GET`, `HEAD`, `PUT`, `OPTIONS`;
- Allowed headers: `authorization`, `content-type`, `x-ms-*`;
- Exposed headers: `etag`, `x-ms-request-id`, `x-ms-version`;
- Max age: np. `3600`.

## Konfiguracja aplikacji

Plik `public/runtime-config.json` nie zawiera sekretów. Po otrzymaniu nazw zasobów należy ustawić:

```json
{
  "schemaVersion": 1,
  "environment": "development",
  "adminPanelEnabled": true,
  "azure": {
    "enabled": true,
    "tenantId": "TENANT-ID-ZHP",
    "clientId": "CLIENT-ID-REJESTRACJI-SPA",
    "storageAccountName": "NAZWA-KONTA-STORAGE",
    "containerName": "content",
    "publicBaseUrl": "https://NAZWA-KONTA-STORAGE.blob.core.windows.net/content"
  }
}
```

Tenant ID, client ID, nazwa konta Storage i publiczny adres kontenera są identyfikatorami konfiguracji, a nie sekretami. Adres `publicBaseUrl` musi dokładnie wskazywać ten sam kontener, który określają `storageAccountName` i `containerName`; błędna konfiguracja wyłącza integrację. W kodzie frontendowym nie wolno umieszczać client secret, klucza konta Storage ani długotrwałego SAS.

Do lokalnego sprawdzenia formularza bez Azure można tymczasowo ustawić `environment: "local"` oraz `adminPanelEnabled: true`. **Nie publikować** takiej konfiguracji. W paczce wdrożeniowej panel ma być wyłączony, dopóki nie zostaną skonfigurowane Entra, RBAC i rola SWA.

## Pierwsza migracja

1. Zbuduj i opublikuj aplikację z uzupełnionym `runtime-config.json`.
2. Otwórz `/admin` i zaloguj się kontem administratora.
3. Wybierz cały folder `C:\KadraZHP\package\content-package\files`.
4. Poczekaj na analizę wszystkich plików i popraw ewentualne wyjątki.
5. Przygotuj wydanie. Panel zablokuje pierwszą publikację, jeżeli paczka nie obejmie wszystkich 560 unikalnych zasobów obecnego katalogu.
6. Pobierz raport JSON i zachowaj go jako dokumentację migracji.
7. Opublikuj wydanie. `current.json` zostanie zmieniony dopiero po poprawnym wysłaniu plików i katalogu.
8. Uruchom aplikację ponownie i wykonaj kontrolę materiałów w Ustawieniach.

## Aktualizacja i wycofanie

Przy kolejnej aktualizacji można wybrać tylko zmieniane lub nowe pliki. Niezmienione rekordy zachowają dotychczasową ścieżkę wersjonowanego blobu. Usuwanie materiałów nie jest wykonywane automatycznie przez pominięcie ich w paczce, co chroni przed przypadkową utratą odnośników.

Przycisk `Przywróć poprzednie` zmienia wyłącznie wskaźnik `current.json`. Nie kopiuje i nie usuwa plików. Warunek ETag chroni przed nadpisaniem wydania opublikowanego równolegle w innej karcie. Panel nie nadpisuje plików już istniejącego wydania; identyfikator nowej publikacji musi być unikalny.

## Granice bezpieczeństwa

Jest to świadomie uproszczony wariant bez Azure Functions. Przyjęto, że zapis wykonuje jedna zaufana osoba, pliki są publiczne i pochodzą ze znanego źródła. Panel ogranicza typy plików i sprawdza ich podstawowe sygnatury, ale walidację przeglądarkową można ominąć, wykonując zapis bezpośrednio z uprawnionego konta Storage. Nie zastępuje ona skanera antywirusowego ani pełnej inspekcji dokumentów Office. Defender for Storage może skanować po przesłaniu, ale wynik pojawia się asynchronicznie; obecny panel nie czeka na wynik przed aktywacją wydania. Przed publikacją pliki muszą zostać sprawdzone i zatwierdzone poza panelem. Przy plikach od osób trzecich lub większej liczbie administratorów należy wdrożyć serwerową kwarantannę, walidację i bramkę publikacji.
