# Przekazanie Kadrówki React do GitHub i CI

**Stan:** prywatne repozytorium GitHub: `https://github.com/jakublasekjl-sys/kadrowka`. Lokalny projekt jest repozytorium Git; wdrożenia Azure i konfiguracji CI jeszcze nie wykonano. Poniższe kroki opisują powtarzalny build, który trzeba uzgodnić z administratorem.

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

## Minimalny przebieg CI

1. Checkout kodu, Node 24, pnpm 11.25.0, `pnpm install --frozen-lockfile`.
2. Pobranie archiwum do lokalnego, ignorowanego katalogu; `pnpm source:check`.
3. `pnpm deploy:prepare`, `pnpm test:deployment:local`; w środowisku z Chrome/Edge także `pnpm test:visual`.
4. `pnpm audit --prod` i osobny przegląd wyniku pełnego `pnpm audit`.
5. Wersjonowany artefakt wdrożeniowy: cała zawartość `release/kadrowka-web`, nie `dist` ani źródłowy ZIP. Publikacja wyłącznie po kontroli uprawnień środowiska.

`pnpm release:production` dodatkowo wymaga adresu HTTPS i potwierdzenia publiczności **wszystkich** materiałów. Nie ustawiać `KADROWKA_PUBLIC_MATERIALS_APPROVED=1` na stałe w repozytorium ani w każdym automatycznym buildzie; powinien to być świadomy krok właściciela treści dla danego wydania. Obecny panel bezpośredniego zapisu Blob pozostaje wyłączony w tej bramce, zgodnie z [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md).

## Odbiór po publikacji

Uruchomić `pnpm test:deployment https://DOMENA` i `pnpm test:materials:deployment https://DOMENA`, sprawdzić dostęp bez konta, TLS/HSTS/CSP, próbę dostępu do `/admin`, odmowę zapisu Blob bez RBAC, aktualizację Service Workera oraz realny eksport/import na telefonie. Lokalny build i test w CI nie potwierdzają konfiguracji Azure.
