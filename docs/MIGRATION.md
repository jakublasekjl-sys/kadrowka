# Migracja Kadrówki do React

## Architektura przejściowa

- `kadra_zhp_offline` pozostaje wersją referencyjną do zamknięcia macierzy zgodności.
- `kadrowka_react` zawiera podstawową aplikację web/PWA oraz opcjonalne opakowanie Capacitor Android.
- `assets/starter_content/content-package.zip` jest źródłem treści i materiałów.
- `pnpm content:sync` wyciąga lekki rdzeń JSON do `public/content`.
- `pnpm content:tools` generuje `tools-catalog.json` z narzędzi aplikacyjnych, analiz, konkretnych plików roboczych i użytecznych odnośników osadzonych w stronach. Reguły wykluczają broszury, plakaty, ulotki, artykuły i materiały czysto opisowe.
- `pnpm content:validate` generuje `assets-index.json` i `diagnostics.json`, a przy błędzie spójności blokuje build.
- `pnpm content:files` aktualizuje lokalny katalog plików używany przez serwer Vite.
- Dane użytkownika pozostają lokalne w IndexedDB i używają kluczy zgodnych z SharedPreferences we Flutterze.
- Format `kadrowka-user-backup`, wersja 1, jest wspólną bramką migracji w obie strony.

## Materiały offline

Paczka źródłowa zawiera 736 wpisów. Publikacja wyklucza 61 technicznych snapshotów SharePoint `.aspx`; jedna nazwa zdublowana po normalizacji Unicode jest scalana. Obraz PNG nazwany w źródle `.jpeg` otrzymuje poprawne rozszerzenie po weryfikacji SHA-256. Do PWA trafiają 674 materiały o rozmiarze około 805 MB. Wszystkie ścieżki są normalizowane do NFC, aby działały tak samo na Windows i Linux.

W PWA użytkownik może pobrać wszystkie materiały albo wybrane moduły. Pliki trafiają do Cache Storage, a Ustawienia pokazują liczbę plików, zajęte miejsce, postęp, błędy i przycisk czyszczenia. Produkcyjny serwer web musi udostępniać katalog `content/files` z tego samego originu co aplikacja, aby Service Worker mógł obsłużyć go offline.

Kanałem podstawowym jest PWA publikowana pod HTTPS. Google Play nie jest wymagany. Materiały pozostają na serwerze i są pobierane do Cache Storage jako całość albo paczki modułów.

Dla opcjonalnego Androida dostępne są dwa warianty:

1. `pnpm cap:sync` - lekka aplikacja; wymaga docelowego mechanizmu dostarczania materiałów.
2. `pnpm cap:sync:full` - po synchronizacji kopiuje zweryfikowane materiały do zasobów Androida; wariant do testów i instalacji bezpośredniej.

Wariant Android można wdrożyć później. Jeżeli kiedykolwiek będzie publikowany w Google Play, dopiero wtedy trzeba wybrać zdalny magazyn lub Play Asset Delivery. Nie jest to warunek uruchomienia Kadrówki jako PWA.

## Polecenia

```powershell
cd C:\KadraZHP\kadrowka_react
pnpm dev
pnpm content:tools
pnpm lint
pnpm content:validate
pnpm test:migration
pnpm test:exports
pnpm build
pnpm test:pwa
pnpm cap:sync
```

## Zasada wydania

Każda zmiana aktualizuje kod, `docs/PARITY_MATRIX.md` i główny `kadra_zhp_offline/docs/BACKLOG.md`. Status `ZGODNE` wymaga scenariusza akceptacyjnego na małym ekranie. Eksport plików wymaga dodatkowo sprawdzenia pobranego dokumentu na docelowym telefonie, niezależnie od tego, czy aplikacja działa jako PWA czy opcjonalny pakiet Android.
