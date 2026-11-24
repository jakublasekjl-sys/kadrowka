import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Document, Packer, Paragraph } from 'docx'
import { jsPDF } from 'jspdf'
import { safeCsvCell } from '../src/security/csv.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, '.export-smoke')
if (output !== resolve(root, '.export-smoke')) throw new Error(`Nieoczekiwana ścieżka testu: ${output}`)
rmSync(output, { recursive: true, force: true })
mkdirSync(output)

try {
  const docxPath = resolve(output, 'notatki.docx')
  const pdfPath = resolve(output, 'protokoly.pdf')
  const docx = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('Kadrówka - notatki'), new Paragraph('Próba eksportu: ąęłńóśźż.')] }] }))
  writeFileSync(docxPath, docx)

  const pdf = new jsPDF()
  pdf.text('Kadrowka - protokoly', 20, 20)
  writeFileSync(pdfPath, Buffer.from(pdf.output('arraybuffer')))

  const docxBytes = readFileSync(docxPath)
  const pdfBytes = readFileSync(pdfPath)
  if (docxBytes.subarray(0, 2).toString('ascii') !== 'PK' || docxBytes.length < 1_000) throw new Error('Nieprawidłowy DOCX.')
  if (pdfBytes.subarray(0, 5).toString('ascii') !== '%PDF-' || !pdfBytes.subarray(-16).toString('ascii').includes('%%EOF')) throw new Error('Nieprawidłowy PDF.')
  for (const value of ['=HYPERLINK("https://attacker.example")', '+1+1', '-2+3', '@SUM(A1:A2)', '\t=1']) {
    if (!safeCsvCell(value).startsWith("'")) throw new Error(`Nie zabezpieczono formuły CSV: ${value}`)
  }
  console.log(`Eksporty poprawne: DOCX ${docxBytes.length} B, PDF ${pdfBytes.length} B.`)
} finally {
  rmSync(output, { recursive: true, force: true })
}
