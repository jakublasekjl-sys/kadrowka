import { Search, X } from 'lucide-react'

export function SearchField({
  value,
  onChange,
  placeholder = 'Szukaj',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="search-field">
      <Search aria-hidden="true" />
      <span className="sr-only">{placeholder}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
        maxLength={200}
        autoComplete="off"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} title="Wyczyść wyszukiwanie">
          <X aria-hidden="true" />
        </button>
      )}
    </label>
  )
}
