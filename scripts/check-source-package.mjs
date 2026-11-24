import { verifySourcePackage } from './source-package.mjs'

const result = await verifySourcePackage()
console.log(`Paczka źródłowa: OK (${result.path}; SHA-256 ${result.sha256}).`)
