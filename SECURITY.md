# Bezpieczeństwo

Problemy bezpieczeństwa Kadrówki należy zgłaszać prywatnie na `jakub.lasek@zhp.pl`. W zgłoszeniu podaj wersję aplikacji, adres strony, kroki odtworzenia i wpływ problemu. Nie umieszczaj sekretów, danych osobowych ani aktywnych danych dostępowych w publicznym zgłoszeniu.

Przed wdrożeniem uruchom:

```powershell
pnpm deploy:prepare
pnpm audit --prod
pnpm test:deployment https://adres-wdrozenia.example
```

Aktualny zakres, wyniki i warunki przed produkcją opisuje `docs/SECURITY_REVIEW_2026-11-24.md`. Starszy `docs/SECURITY_AUDIT.md` dotyczy beta.9.
