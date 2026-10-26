import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/useAuth';
import PublicLayout from '@/layouts/PublicLayout';
import Home from '@/pages/Home';
import { Login, Register, ForgotPassword, ResetPassword, VerifyEmail } from '@/pages/Auth';
import { HowItWorks, FAQ, Custom, Legal, NotFound } from '@/pages/Content';
import { RequireAuth } from '@/pages/Dashboard';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Skeleton } from '@/components/ui';
import './styles.css';

const Projects = lazy(() => import('@/pages/Projects'));
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail'));
const AdminLayout = lazy(() => import('@/layouts/AdminLayout'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminProjects = lazy(() => import('@/pages/admin/AdminProjects'));
const AdminProjectEditor = lazy(() => import('@/pages/admin/AdminProjectEditor'));
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders'));
const AdminOrderDetail = lazy(() => import('@/pages/admin/AdminOrderDetail'));
const AdminCustomList = lazy(() => import('@/pages/admin/AdminCustom').then((m) => ({ default: m.AdminCustomList })));
const AdminCustomDetail = lazy(() => import('@/pages/admin/AdminCustom').then((m) => ({ default: m.AdminCustomDetail })));
const AdminTickets = lazy(() => import('@/pages/admin/AdminTickets').then((m) => ({ default: m.AdminTickets })));
const AdminTicketDetail = lazy(() => import('@/pages/admin/AdminTickets').then((m) => ({ default: m.AdminTicketDetail })));
const AdminMessages = lazy(() => import('@/pages/admin/AdminMessages'));
const NotificationsPage2 = lazy(() => import('@/pages/dashboard/NotificationsPage'));
const AdminCategories = lazy(() => import('@/pages/admin/AdminCategories'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminAudit = lazy(() => import('@/pages/admin/AdminAudit'));
const Overview = lazy(() => import('@/pages/dashboard/Overview'));
const Saved = lazy(() => import('@/pages/dashboard/Saved'));
const Profile = lazy(() => import('@/pages/dashboard/Profile'));
const Settings = lazy(() => import('@/pages/dashboard/Settings'));
const Orders = lazy(() => import('@/pages/dashboard/Orders'));
const OrderDetail = lazy(() => import('@/pages/dashboard/OrderDetail'));
const CustomList = lazy(() => import('@/pages/dashboard/custom/CustomList'));
const CustomNew = lazy(() => import('@/pages/dashboard/custom/CustomNew'));
const CustomDetail = lazy(() => import('@/pages/dashboard/custom/CustomDetail'));
const TicketsList = lazy(() => import('@/pages/dashboard/Support').then((m) => ({ default: m.TicketsList })));
const NewTicket = lazy(() => import('@/pages/dashboard/Support').then((m) => ({ default: m.NewTicket })));
const TicketDetail = lazy(() => import('@/pages/dashboard/Support').then((m) => ({ default: m.TicketDetail })));
const Messages = lazy(() => import('@/pages/dashboard/Messages'));
const NotificationsPage = lazy(() => import('@/pages/dashboard/NotificationsPage'));
const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode><QueryClientProvider client={qc}><AuthProvider><BrowserRouter>
    <Suspense fallback={<div className="p-10"><Skeleton className="h-40" /></div>}>
      <Routes><Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:slug" element={<ProjectDetail />} />
        <Route path="login" element={<Login />} /><Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} /><Route path="reset-password" element={<ResetPassword />} /><Route path="verify-email" element={<VerifyEmail />} />
        <Route path="how-it-works" element={<HowItWorks />} /><Route path="faq" element={<FAQ />} /><Route path="custom" element={<Custom />} />
        <Route path="legal/:doc" element={<Legal />} />
        <Route path="*" element={<NotFound />} />
      </Route>
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} /><Route path="projects" element={<AdminProjects />} />
          <Route path="projects/:id" element={<AdminProjectEditor />} /><Route path="categories" element={<AdminCategories />} />
          <Route path="users" element={<AdminUsers />} /><Route path="audit" element={<AdminAudit />} />
          <Route path="orders" element={<AdminOrders />} /><Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="custom" element={<AdminCustomList />} /><Route path="custom/:id" element={<AdminCustomDetail />} />
          <Route path="tickets" element={<AdminTickets />} /><Route path="tickets/:id" element={<AdminTicketDetail />} />
          <Route path="messages" element={<AdminMessages />} /><Route path="messages/:id" element={<AdminMessages />} />
          <Route path="notifications" element={<NotificationsPage2 />} />
        </Route>
        <Route path="dashboard" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
          <Route index element={<Overview />} /><Route path="projects" element={<Projects />} /><Route path="projects/:slug" element={<ProjectDetail />} />
          <Route path="saved" element={<Saved />} /><Route path="profile" element={<Profile />} /><Route path="settings" element={<Settings />} />
          <Route path="orders" element={<Orders />} /><Route path="orders/:id" element={<OrderDetail />} />
          <Route path="custom" element={<CustomList />} /><Route path="custom/new" element={<CustomNew />} /><Route path="custom/:id" element={<CustomDetail />} />
          <Route path="support" element={<TicketsList />} /><Route path="support/new" element={<NewTicket />} /><Route path="support/:id" element={<TicketDetail />} />
          <Route path="messages" element={<Messages />} /><Route path="messages/:id" element={<Messages />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route></Routes>
    </Suspense>
  </BrowserRouter></AuthProvider></QueryClientProvider></StrictMode>,
);
