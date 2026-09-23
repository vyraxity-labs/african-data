import { parseCsv } from './import/csv-parser'

async function run() {
  const sampleCSV = `S/N,Source Name,Data Link,Source Website,Country / Coverage,Link Description,Source Type,Industry,Institution Name,Available Formats,Access Type,Update Frequency,Last Updated (latest data seen),Notes,Category,Data Granularity,Language,API Available,Link Status,Priority for Platform
1,AfCFTA Secretariat,https://au-afcfta.org/,https://au-afcfta.org/,Africa (AfCFTA state parties),"Official AfCFTA portal with the agreement texts, tariff offers, ratification status, rules of origin and Guided Trade Initiative reporting.",International / Continental body,Trade,AfCFTA Secretariat (African Union),"PDF, Online, Excel",Free access,Continuous,2024,The authoritative record of AfCFTA ratification and implementation status.,Pan-African Source,Country-level,English and French,No,Live,High
2,Africa CDC - Resource Centre,https://africacdc.org/resources/,https://africacdc.org/,Africa (AU member states),"Outbreak situation reports, epidemic intelligence briefs, guidelines and health security data for African Union member states.",International / Continental body,Health / Epidemiology,Africa Centres for Disease Control and Prevention (African Union),"PDF, Online",Free access,Weekly (outbreak briefs),2026,The continental authority on African outbreak data. Weekly Event-Based Surveillance reports are the key series.,Pan-African Source,Country-level,English and French,No,Live,High
3,Africa Data Hub,https://www.africadatahub.org/,https://www.africadatahub.org/,Africa,"Data infrastructure and curated African datasets built for journalists and researchers, including inflation, food prices, debt and elections trackers.",NGO / Civic tech,Multiple,Africa Data Hub,"CSV, Online, API",Free access,Continuous,2025,The African Inflation and Food Price trackers are unusually well maintained.,Pan-African Source,Country-level,English and French,Yes,Live,High`

  const result = parseCsv(sampleCSV)

  console.log(result)
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('CSV Parser testing failed:', err)
    process.exit(1)
  })
