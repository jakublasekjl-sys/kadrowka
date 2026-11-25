# Przekazanie Kadrówki React do GitHub i CI

**Stan:** prywatne repozytorium GitHub: `https://github.com/jakublasekjl-sys/kadrowka`. Workflow `.github/workflows/azure-deploy.yml` jest przygotowany, ale nie opublikowano aplikacji na Azure. Do uruchomienia brakuje zasobów, uprawnień i prywatnej paczki ZIP (dostarcza ją właściciel). Zmienna repozytorium `KADROWKA_DEPLOY_ENABLED` pozostaje wyłączona do czasu odbioru konfiguracji.

## Co trafia do repozytorium

Kod `src/`, `scripts/`, `public/` (w tym aktualne JSON-y treści i małe grafiki), dokumentacja, `pnpm-lock.yaml`, `.node-version` i testowe wzorce wizualne. `public/content/czuwaj-categories.json` jest wersjonowanym źródłem kategorii artykułów dla React; nową kategorię trzeba zmienić tam i w źródłach merytorycznych, a potem sprawdzić synchronizację.

Nie dodawać `node_modules`, `dist`, `release`, plików `.env`, kopii danych użytkowników, raportów lokalnych, haseł ani `source/content-package.zip`. Pliki wynikowe Androida są ignorowane przez `android/.gitignore`. Przed pierwszym commitem sprawdzić `git status --short`, `git diff --cached --stat` i pełną listę `git diff --cached --name-only`; wykonać skan sekretów oraz ręczny przegląd treści. Prywatne repozytorium nie zastępuje decyzji właściciela o prawach do upublicznienia JSON-ów, obrazów i dokumentów.

## Duża paczka treści

Build nie jest samowystarczalny bez `content-package.zip` (669 MB). Zawiera także 61 technicznych snapshotów SharePoint, które **nie** są publikowane w PWA. Archiwum należy przekazać CI jako osobny, kontrolowany artefakt, np. pobrać z prywatnego Azure Blob przy użyciu federacji OIDC. Nie umieszczać długotrwałego SAS ani klucza Storage w repozytorium. Alternatywę Git LFS ocenić z administratorem pod kątem limitów i kosztów, zanim zostanie wybrana.

CI może zapisać archiwum pod `source/content-package.zip` albo ustawić `KADROWKA_CONTENT_ZIP` na jego lokalną ścieżkę. `pnpm source:check` odrzuca paczkę, której SHA-256 nie wynosi:

```text
b30eddb545b9d2904890d1787337cae5ce0ff68123dfd5153abd7057726c0f9d
```

Zmiana źródłowej paczki wymaga przeglądu treści, aktualizacji oczekiwanego skrótu w `scripts/source-package.mjs`, kontroli obrazów i testów całego wydania. Jeden plik źródłowy PNG ma błędne rozszerzenie `.jpeg`; skrypt naprawia nazwę po kontroli własnego SHA-256. Nowego błędu typu nie wolno dopisywać do listy wyjątków bez naprawy danych.

## Podział wydania Azure

`pnpm deploy:prepare` nadal tworzy pełną paczkę kontrolną `release/kadrowka-web`. Następnie `pnpm azure:stage` dzieli ją na:

- `release/kadrowka-azure-app` - aplikacja i JSON-y treści, bez `/content/files`; to jedyny katalog przekazywany do Static Web Apps;
- `release/kadrowka-azure-content` - 560 unikalnych plików w `releases/{releaseId}/files/` i katalog `catalog/{releaseId}.json`; trafia do publicznego kontenera Blob;
- `release/kadrowka-azure-manifest.json` - podsumowanie i identyfikator wydania.

Adres katalogu jest przypięty w `runtime-config.json` aplikacji. Nie ma globalnego `current.json` dla tego trybu, więc wdrożenie testowe nie może przypadkowo przełączyć produkcji na inny zestaw materiałów. Cofnięcie wersji aplikacji przywraca także jej katalog; stare pliki Blob trzeba zachować przez ustalony okres retencji. `pnpm test:azure:runtime` sprawdza odczyt bez logowania Entra, cache offline i brak cichego przejścia na lokalne pliki.

Pełna paczka ma ponad 800 MB i nie mieści się w limitach Static Web Apps. Dlatego nie wolno wskazać `release/kadrowka-web` jako `app_location`.

## Konfiguracja administratora

1. Utworzyć prywatny kontener źródłowy i przesłać do niego dokładnie sprawdzony `content-package.zip`. Konto może być wspólne z publicznym, ale kontenery i uprawnienia muszą być rozdzielone.
2. Utworzyć kontener materiałów z odczytem pojedynczych blobów, bez listowania kontenera, **tylko po potwierdzeniu jawności wszystkich plików i nazw w katalogu**. Włączyć HTTPS-only, wersjonowanie, soft delete i regułę CORS `GET, HEAD, OPTIONS` dla dokładnej domeny testowej i produkcyjnej.
3. Utworzyć zasób Static Web Apps dla produkcji. Jeżeli `kadrowka-dev.zhp.pl` ma być osobną domeną, utworzyć drugi zasób dla testów; środowisko podglądowe jednego zasobu używa adresu Azure, nie osobnej domeny niestandardowej.
4. Najpierw sprawdzić plan GitHub. Dla prywatnego repozytorium środowiska i ich sekrety wymagają odpowiedniego płatnego planu, a `Required reviewers` może wymagać GitHub Enterprise. Bez obsługiwanych środowisk **nie włączać** tego workflow; nie przenosić sekretu wdrożeniowego produkcji do zwykłych sekretów repozytorium. Jeśli plan na to pozwala, utworzyć środowiska `development` i `production` oraz produkcyjne zabezpieczyć wymaganym recenzentem. Dla każdej tożsamości wdrożeniowej skonfigurować federację OIDC z podmiotem `repo:jakublasekjl-sys/kadrowka:environment:development` albo `...:production`. Nadać `Storage Blob Data Reader` na źródle i `Storage Blob Data Contributor` na docelowym kontenerze. Ograniczyć uprawnienia do zasobów danego środowiska.
5. W każdym środowisku GitHub ustawić sekrety `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `SWA_DEPLOYMENT_TOKEN` oraz zmienne `AZURE_SOURCE_STORAGE_ACCOUNT`, `AZURE_SOURCE_CONTAINER`, `AZURE_SOURCE_BLOB`, `AZURE_CONTENT_STORAGE_ACCOUNT`, `AZURE_CONTENT_CONTAINER`, `KADROWKA_APP_ORIGIN`, `SWA_PRODUCTION_BRANCH`. Przy dwóch SWA ustawić gałąź produkcyjną zasobu testowego na `dev`, produkcyjnego na `main`, a `SWA_PREVIEW_ENVIRONMENT` pozostawić pustą. Jeśli testy korzystają z podglądu w tym samym SWA, ustawić `SWA_PRODUCTION_BRANCH=main`, tylko w `development` ustawić `SWA_PREVIEW_ENVIRONMENT` i adres podglądu jako `KADROWKA_APP_ORIGIN`.
6. Dopiero po ręcznym sprawdzeniu powyższego ustawić repozytoryjną zmienną `KADROWKA_DEPLOY_ENABLED=true`. Push do `dev` publikuje testy. Produkcja jest wyłącznie ręczna z gałęzi `main`, z potwierdzeniem jawności materiałów; workflow musi więc najpierw trafić także do gałęzi domyślnej `main`. Jeśli plan oferuje ochronę środowiska, włączyć wymagany przegląd. Bez tej ochrony nie polegać wyłącznie na przycisku/checkboxie jako na niezależnej aprobacie produkcji. Samo połączenie repozytorium z Azure może utworzyć drugi automatyczny workflow; usunąć go, aby nie publikował pełnej paczki ani nie omijał bramek.

## Przebieg CI

1. Checkout kodu, Node 24, pnpm 11.25.0, `pnpm install --frozen-lockfile`.
2. Pobranie archiwum do lokalnego, ignorowanego katalogu; `pnpm source:check`.
3. `pnpm deploy:prepare`, `pnpm test:deployment:local`, `pnpm audit --prod`; na produkcji także `production-release-check.mjs`.
4. `pnpm azure:stage` i `pnpm test:azure:stage`; upload niezmiennych plików do Blob, pełna weryfikacja SHA-256 przez publiczny URL, upload i weryfikacja katalogu.
5. Dopiero wtedy publikacja samego `release/kadrowka-azure-app` do SWA (`skip_app_build: true`) i testy HTTP aplikacji oraz wszystkich materiałów.

`pnpm release:production` pozostaje lokalną kontrolą pełnej paczki. Workflow wykonuje tę samą kontrolę produkcyjną po podaniu adresu HTTPS i potwierdzeniu publiczności **wszystkich** materiałów. Nie ustawiać `KADROWKA_PUBLIC_MATERIALS_APPROVED=1` na stałe. Obecny panel bezpośredniego zapisu Blob pozostaje wyłączony, zgodnie z [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md).

## Odbiór po publikacji

Uruchomić `pnpm test:deployment https://DOMENA` i `pnpm test:materials:deployment https://DOMENA`, sprawdzić dostęp bez konta, TLS/HSTS/CSP, próbę dostępu do `/admin`, odmowę zapisu Blob bez RBAC, aktualizację Service Workera oraz realny eksport/import na telefonie. Lokalny build i test w CI nie potwierdzają konfiguracji Azure.
