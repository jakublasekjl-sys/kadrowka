# Macierz zgodności Flutter -> React

Ostatnia aktualizacja: 2026-07-17

## Zasada wydania

Flutter w `C:\KadraZHP\kadra_zhp_offline` pozostaje wersją referencyjną. React może zastąpić aplikację Flutter dopiero, gdy każdy wiersz ma status `ZGODNE`, przejdzie scenariusz na małym telefonie i nie utraci danych po eksporcie z Fluttera oraz imporcie do React.

Statusy:

- `ZGODNE` - funkcja działa i ma potwierdzony scenariusz akceptacyjny;
- `CZĘŚCIOWO` - istnieje działająca podstawa, ale brakuje elementów wersji Flutter;
- `DO ZROBIENIA` - funkcja nie została jeszcze przeniesiona;
- `NIE DOTYCZY WEB` - zachowanie zależne wyłącznie od Androida, wymaga odpowiednika w Capacitor.

## Funkcje

| Wymaganie | Stan React | Kryterium akceptacji |
|---|---|---|
| BASE-001 paczka treści offline | CZĘŚCIOWO | 674 zweryfikowane materiały otwierają się online bez przygotowania, pojedynczy plik jest zapamiętywany przy pierwszym użyciu, a wybrane moduły można pobrać przed wyjazdem; brak pliku i brak cache offline dają czytelny komunikat z ponowieniem; 61 snapshotów ASPX jest wykluczonych z publikacji, a obraz PNG o mylącym rozszerzeniu w źródle otrzymuje poprawną nazwę |
| BASE-002 model treści | CZĘŚCIOWO | Typy TypeScript oraz JSON Schema opisują wszystkie bloki, linki, pliki i konfiguracje |
| BASE-010 menu główne | ZGODNE | Te same 6 pozycji działa na desktopie i telefonie |
| BASE-011 pasek aplikacji | ZGODNE | Logo, instalacja na telefonie, uwagi i ustawienia są dostępne, ikony mają właściwy kontrast; wiadomość z uwagą otrzymuje edytowalny szablon i wersje aplikacji bez automatycznej transmisji danych |
| BASE-012 Start | ZGODNE | Nagłówek z odwróconym biało-fioletowym logo, wyszukiwarka, 8 wejść z ikonami oraz grafika i pełne wprowadzenie do pracy z kadrą odpowiadają wersji Flutter i są czytelne na telefonie |
| BASE-013 instalacja i aktualizacje PWA | ZGODNE | Manifest ma wersjonowane ikony 192/512, maskable i iOS oraz faviconę 64 px; instrukcja Android/iPhone jest dostępna z ikony telefonu w górnym pasku, a nowa wersja pokazuje komunikat z akcją aktualizacji |
| BASE-014 samouczek | ZGODNE | Start pokazuje jednorazowe zaproszenie, użytkownik może je wyłączyć, a 7-krokowy samouczek można zawsze uruchomić ponownie w Ustawieniach |
| BASE-020 katalog modułów | ZGODNE | Wszystkie moduły są dostępne, mają rozpoznawalne ikony zgodne znaczeniowo z Flutter, a elementy menu dolnego nie są zdublowane |
| BASE-021 bezpośrednie wejścia | ZGODNE | Każdy moduł otwiera stronę docelową lub właściwy adres zewnętrzny |
| BASE-022 strona modułu | ZGODNE | Indywidualne zakładki, ulubione, materiały i powrót zachowują układ wersji Flutter; na telefonie zakładki mają sterowane przewijanie bez widocznego technicznego paska |
| BASE-023 renderer | ZGODNE | Importer odtwarza formatowanie SharePoint; walidacja potwierdza 714 bloków rich text, a renderer obsługuje bold/italic/underline/link, listy, obrazy i kolumny |
| BASE-024 obrazy z akcją | ZGODNE | 22 akcje obrazów są zapisane w danych, walidowane i działają zarówno dla celów lokalnych, jak i zewnętrznych |
| BASE-030 Model przywództwa | ZGODNE | Czytaj zachowuje komplet treści i dzieli dłuższe partie na czytelne sekcje z właściwymi obrazami; 6 Postaw, Zastosuj, Materiały i Powiązane zachowują indywidualny UX |
| BASE-031 Proces pracy z kadrą | ZGODNE | Cztery etapy i ich wspólne listy rozwijane są zgodne z Flutter |
| BASE-032 Praca z kadrą w zespole | ZGODNE | Czytaj, 12 Obszarów i link Kultury Organizacyjnej działają jak w Flutter |
| BASE-033 Ewaluacja | ZGODNE | Pełna treść, grafika, materiały i powiązania działają bez pustych atrap; test mobilny nie wykazał przepełnienia |
| BASE-034 Wdrażanie SPzK | ZGODNE | Treść jest podzielona na siedem rozwijanych sekcji, podstrony są dostępne osobno, a materiały nie dublują części Czytaj |
| BASE-035 SSI | ZGODNE | Strony, Stopnie, checklisty, licznik, reset i migracja zaznaczeń działają |
| BASE-040 Narzędzia | ZGODNE | Generowany katalog zawiera 67 konkretnych pozycji: 17 narzędzi aplikacyjnych, 12 analiz, 36 unikalnych plików roboczych i 2 użyteczne odnośniki z podstron. Kopie załączników, broszury, plakaty, ulotki i materiały opisowe są wykluczone. Działają wyszukiwanie, ulubione, polskie etykiety typów oraz kompaktowe na telefonie filtry kategorii, odbiorcy, sposobu używania i poziomu organizacji |
| BASE-041 Artykuły z Czuwaj | ZGODNE | Osobna wyszukiwarka i kategorie bez duplikatów obejmują cały katalog |
| BASE-042 wyszukiwarka globalna | ZGODNE | Wyszukiwarka obejmuje czytanie, narzędzia, materiały, notatki, plany, wnioski i protokoły; usuwa techniczne pliki ASPX i prowadzi do właściwych ekranów |
| BASE-050 Pulpit | ZGODNE | Pulpit, Ulubione, Ostatnie, Notatki, Plany z wnioskami i Odprawy działają |
| BASE-051 notatki i wnioski | ZGODNE | Notatkę można zapisać przy stronie i oznaczyć jako wniosek do planu |
| BASE-052 ulubione i ostatnie | ZGODNE | Strony i narzędzia są zapisywane; Pulpit pokazuje czytelne nazwy oraz ostatnie strony |
| BASE-053 eksport notatek | CZĘŚCIOWO | Osobne eksporty DOCX i PDF są wdrożone, test sygnatur przechodzi; pozostaje test pobrania i wyglądu na Androidzie |
| BASE-054 protokoły odpraw | CZĘŚCIOWO | Tworzenie, edycja, tabela zadań i eksport DOCX/PDF działają; pozostaje test plików na Androidzie |
| BASE-055 prywatność i zapis | ZGODNE | Dane działają offline w IndexedDB; Pulpit i Ustawienia jasno informują, że dane pozostają tylko w bieżącej przeglądarce/urządzeniu, a przyjazna „Kopia Twojej pracy” pozwala je pobrać i wczytać bez wysyłania na serwer |
| BASE-060 profile planów | ZGODNE | Cztery profile mają własne pełne przepływy i zachowują stan po przeładowaniu |
| BASE-061 szkice planów | ZGODNE | Tworzenie, przełączanie, nazwa, duplikowanie, pobieranie i wczytywanie kopii planu oraz bezpieczne usuwanie działają; format techniczny nie jest eksponowany użytkownikowi |
| BASE-062 plan gromady/drużyny | ZGODNE | Wszystkie kroki, pytania, pomijanie, cele i harmonogram są zgodne |
| BASE-063 plan zespołu kadry | ZGODNE | 12 aspektów ma oficjalne nazwy i pełne opisy SPzK nad polami diagnozy; analizy, praktyki i pełny kreator są zgodne |
| BASE-064 HALiZ | ZGODNE | Plan oraz harmonogram rano/popołudnie/wieczór, odpowiedzialni i uwagi są zgodne |
| BASE-065 analizy | ZGODNE | Te same 12 metod, selektor, rekomendacje i formularze działają w kreatorze |
| BASE-066 wnioski z innych miejsc | ZGODNE | Wnioski z notatek synchronizują się z Planowaniem oraz można je kopiować i usuwać |
| BASE-067 eksport planu | CZĘŚCIOWO | TXT, DOCX, PDF i harmonogram HALiZ CSV są wdrożone; pozostaje wizualne porównanie plików na Androidzie |
| BASE-070 diagnostyka | CZĘŚCIOWO | Wersja aplikacji, data buildu, wersja treści, liczniki, raport jakości, dostępność plików i czyszczenie cache są widoczne; techniczne wyjątki eksportu są informacjami zamiast fałszywych ostrzeżeń, nadal brakuje importu paczki testowej |
| BASE-071 kontrola treści | ZGODNE | Walidator uruchamia się przed buildem, sprawdza liczniki, pliki i cele linków oraz blokuje błędy P0 |

## Bramka danych

1. W wersji Flutter utwórz plan każdego profilu, notatkę zwykłą, wniosek, ulubioną stronę, ulubione narzędzie, protokół z zadaniem i zaznaczenie SSI.
2. Wyeksportuj jedną kopię `kadrowka-user-backup`.
3. Zaimportuj ją w React na czystym profilu przeglądarki.
4. Porównaj liczbę i zawartość rekordów w każdej zakładce Pulpitu oraz w Planowaniu i SSI.
5. Wyeksportuj kopię z React, zaimportuj ponownie do Flutter i wykonaj to samo porównanie.

Nie wolno usuwać starszego magazynu ani zmieniać nazw kluczy przed przejściem tego testu w obie strony.
