import { normalizeFormats, normalizeLanguage } from './import/csv-normalizer'

async function run() {
  //   const result = normalizeFormats('CSV, Shapefile, Online, API', 2, [])
  const result = normalizeLanguage('Arabic (some English)', 1, [])

  console.log(result)
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Normalizing testing failed:', err)
    process.exit(1)
  })
