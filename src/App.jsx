import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './components/AuthProvider'
import { WorkspaceProvider } from './data/WorkspaceProvider'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/AppShell'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CustomersPage from './pages/CustomersPage'
import ContractsPage from './pages/ContractsPage'
import EstimatesPage from './pages/EstimatesPage'
import JobsPage from './pages/JobsPage'
import SchedulePage from './pages/SchedulePage'
import InvoicesPage from './pages/InvoicesPage'
import SettingsPage from './pages/SettingsPage'
import AiAssistantPage from './pages/AiAssistantPage'
import TeamPage from './pages/TeamPage'
import TabletPage from './pages/TabletPage'
import SignContractPage from './pages/SignContractPage'

export default function App(){return <AuthProvider><WorkspaceProvider><Routes>
<Route path="/login" element={<LoginPage/>}/><Route path="/sign/:token" element={<SignContractPage/>}/>
<Route element={<ProtectedRoute><AppShell/></ProtectedRoute>}><Route index element={<DashboardPage/>}/><Route path="/customers" element={<CustomersPage/>}/><Route path="/estimates" element={<EstimatesPage/>}/><Route path="/contracts" element={<ContractsPage/>}/><Route path="/jobs" element={<JobsPage/>}/><Route path="/schedule" element={<SchedulePage/>}/><Route path="/invoices" element={<InvoicesPage/>}/><Route path="/ai" element={<AiAssistantPage/>}/><Route path="/team" element={<TeamPage/>}/><Route path="/tablet" element={<TabletPage/>}/><Route path="/settings" element={<SettingsPage/>}/></Route>
<Route path="*" element={<Navigate to="/" replace/>}/></Routes></WorkspaceProvider></AuthProvider>}
