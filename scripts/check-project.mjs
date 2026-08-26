import { existsSync, readFileSync } from 'node:fs'
const required = ['src/App.jsx','src/data/WorkspaceProvider.jsx','src/lib/operations.js','src/lib/stripePayments.js','src/lib/contractTerms.js','src/lib/documentNumbers.js','src/pages/ContractsPage.jsx','src/pages/EstimatesPage.jsx','src/pages/JobCostingPage.jsx','src/pages/FieldReportsPage.jsx','src/pages/FleetPage.jsx','src/pages/EstimatorPage.jsx','src/pages/ReportsPage.jsx','src/pages/WorkerPaymentsPage.jsx','src/pages/InvoicesPage.jsx','src/pages/SignContractPage.jsx','src/pages/ReceiptPage.jsx','supabase/migrations/001_valid_tree_operations.sql','supabase/migrations/002_business_operations.sql','supabase/migrations/003_worker_payments.sql','supabase/migrations/005_stripe_payments.sql','supabase/migrations/006_invoice_receipts.sql','supabase/migrations/011_permanent_contract_deletion.sql','supabase/migrations/012_multiple_contract_types.sql','supabase/migrations/013_estimate_numbering_and_service_types.sql','supabase/functions/create-stripe-checkout/index.ts','supabase/functions/stripe-webhook/index.ts']
const missing = required.filter((file) => !existsSync(file))
if (missing.length) throw new Error(`Missing required files:\n${missing.join('\n')}`)
const app = readFileSync('src/App.jsx', 'utf8')
for (const route of ['/costing','/field-reports','/fleet','/estimator','/reports','/search','/workers']) if (!app.includes(route)) throw new Error(`Missing route ${route}`)
const migration = readFileSync('supabase/migrations/002_business_operations.sql', 'utf8')
for (const table of ['job_budgets','expenses','time_entries','daily_reports','production_logs','equipment','fuel_logs','maintenance_records','rentals','change_orders','payments']) if (!migration.includes(`public.${table}`)) throw new Error(`Migration does not include ${table}`)
const contractMigration = readFileSync('supabase/migrations/012_multiple_contract_types.sql', 'utf8')
for (const type of ['tree_service','junk_removal','demolition']) if (!contractMigration.includes(type)) throw new Error(`Contract migration does not include ${type}`)
const estimateMigration = readFileSync('supabase/migrations/013_estimate_numbering_and_service_types.sql', 'utf8')
for (const requirement of ['service_type','ensure_unique_estimate_number','accept_estimate']) if (!estimateMigration.includes(requirement)) throw new Error(`Estimate migration does not include ${requirement}`)
console.log(`Project structure check passed (${required.length} required files, 7 new routes, 3 contract and estimate types).`)
