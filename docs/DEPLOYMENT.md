# Wdrożenie testowej Kadrówki PWA

Wydanie produkcyjne ma odrębną bramkę `pnpm release:production` i wymaga potwierdzenia jawności materiałów oraz testów na docelowej domenie. Patrz [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md).

## Wymagania serwera

- HTTPS - wymagany do instalacji PWA i działania Service Workera;
- co najmniej 1 GB miejsca;
- możliwość przesłania 674 plików materiałowych;
- aplikacja opublikowana w katalogu głównym domeny lub subdomeny;
- przekierowanie nieistniejących ścieżek aplikacji do `index.html`.

Na etapie testowym aplikacja nie ma bramki Microsoft. Każda osoba znająca adres może ją otworzyć. Dane Pulpitu pozostają lokalnie w IndexedDB danej przeglądarki i nie są wysyłane na serwer.

## Przygotowanie

```powershell
cd C:\KadraZHP\kadrowka_react
pnpm deploy:prepare
```

Gotowy katalog:

`C:\KadraZHP\kadrowka_react\release\kadrowka-web`

Na serwer należy przesłać całą **zawartość** tego katalogu. Nie należy publikować źródłowego katalogu `C:\KadraZHP\package\content-package\files`, ponieważ zawiera prywatne snapshoty techniczne SharePoint.

## Struktura serwera

```text
/
  index.html
  sw.js
  manifest.webmanifest
  assets/
  content/
    manifest.json
    pages.json
    files/
      ...674 materiały...
```

Dołączony `.htaccess` zapewnia obsługę tras React na Apache. Dla Nginx odpowiednik w bloku `location /` to:

```nginx
location /content/files/ {
    try_files $uri =404;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

Oddzielna reguła `location /content/files/` jest obowiązkowa: brakujący materiał musi zwrócić HTTP 404 i nie może zostać zastąpiony przez `index.html`. Service Worker również wyklucza `/content/files/` z fallbacku nawigacji SPA, dzięki czemu wejście do PDF-a lub dokumentu trafia do pliku, a nie do routera React.

## Kontrola po publikacji

1. Otwórz stronę główną przez HTTPS.
2. Wejdź bezpośrednio na `/page/proces-pracy-z-kadra` i odśwież stronę.
3. Otwórz Ustawienia, rozwiń `Opcje techniczne` i wybierz `Sprawdź dostępność plików`.
4. Pobierz jeden wybrany moduł offline.
5. Włącz tryb samolotowy i sprawdź Start, moduł oraz pobrany materiał.
6. Utwórz notatkę i plan, odśwież stronę oraz sprawdź Pulpit.
7. Przetestuj eksport DOCX i PDF na telefonie.
8. Uruchom automatyczną kontrolę wdrożenia:

```powershell
pnpm test:deployment https://testowka.drogowskazykultury.org
pnpm test:materials:deployment https://testowka.drogowskazykultury.org
```

Pierwszy test kontroluje również manifest i ikony instalacyjne, Service Workera, fallback SPA, grafikę Startu, dokładną nazwę przykładowego materiału i odpowiedź dla nieistniejącego pliku. Drugi wykonuje kontrolę statusu, typu odpowiedzi i rozmiaru wszystkich materiałów.

Jeżeli punkt 2 zwraca 404, serwer nie ma ustawionego fallbacku SPA. Jeżeli strony działają, ale materiały zwracają 404, katalog `content/files` nie został przesłany w odpowiednie miejsce albo nazwy plików zostały zmienione przez program FTP.

## Instalacja na telefonie

- Android: otwórz stronę w Chrome, wybierz menu z trzema kropkami, następnie `Zainstaluj aplikację` lub `Dodaj do ekranu głównego`.
- iPhone/iPad: otwórz stronę w Safari, wybierz `Udostępnij`, potem `Do ekranu początkowego` i `Dodaj`.

Ta sama instrukcja jest dostępna pod ikoną telefonu w górnym pasku aplikacji. Manifest zawiera osobne ikony 192×192, 512×512, wariant maskowalny Androida i ikonę Apple Touch.

## Aktualizacje i cache

Dołączony `.htaccess` wyłącza cache dla `index.html`, manifestu i Service Workera, a wersjonowane JS/CSS przechowuje długoterminowo. Brakujące materiały zwracają prawdziwe HTTP 404. Aplikacja odrzuca odpowiedzi HTML zapisane wcześniej pod adresem materiału i przenosi poprawne pliki do nowej pamięci `kadrowka-materialy-v2`. Po wykryciu nowego Service Workera aplikacja pokazuje użytkownikowi komunikat o aktualizacji.
