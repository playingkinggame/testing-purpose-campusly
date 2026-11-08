import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { isConfigured } from '@/lib/supabase';
import { useAuth } from '@/store/authStore';
import { AdminRoute, OnboardingRoute, ProtectedRoute, PublicOnlyRoute } from '@/components/layout/Guards';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { PageBoundary } from '@/components/layout/PageBoundary';
import { Toaster } from '@/components/ui/Toaster';
import { Spinner } from '@/components/ui/Feedback';
import LoginPage from '@/pages/auth/LoginPage';
import SignupPage from '@/pages/auth/SignupPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import OnboardingPage from '@/pages/auth/OnboardingPage';
import HomePage from '@/pages/HomePage';
import NotFoundPage from '@/pages/NotFoundPage';
import SetupMissingPage from '@/pages/SetupMissingPage';

const MyProfilePage = lazy(() => import('@/pages/profile/MyProfilePage'));
const EditProfilePage = lazy(() => import('@/pages/profile/EditProfilePage'));
const PublicProfilePage = lazy(() => import('@/pages/profile/PublicProfilePage'));
const DiscoverPage = lazy(() => import('@/pages/discover/DiscoverPage'));
const RequestsPage = lazy(() => import('@/pages/requests/RequestsPage'));
const NotificationsPage = lazy(() => import('@/pages/notifications/NotificationsPage'));
const ChatListPage = lazy(() => import('@/pages/chat/ChatListPage'));
const ChatRoomPage = lazy(() => import('@/pages/chat/ChatRoomPage'));
const GroupsPage = lazy(() => import('@/pages/groups/GroupsPage'));
const NewGroupPage = lazy(() => import('@/pages/groups/NewGroupPage'));
const GroupDetailPage = lazy(() => import('@/pages/groups/GroupDetailPage'));
const EventsPage = lazy(() => import('@/pages/campus/EventsPage'));
const TeammatesPage = lazy(() => import('@/pages/campus/TeammatesPage'));
const StudyPage = lazy(() => import('@/pages/campus/StudyPage'));
const LostFoundPage = lazy(() => import('@/pages/campus/LostFoundPage'));
const RidesPage = lazy(() => import('@/pages/campus/RidesPage'));
const ConfessionsPage = lazy(() => import('@/pages/campus/ConfessionsPage'));
const SeniorsPage = lazy(() => import('@/pages/campus/SeniorsPage'));
const NoticesPage = lazy(() => import('@/pages/campus/NoticesPage'));
const AdminPage = lazy(() => import('@/pages/admin/AdminPage'));

function Loading() {
  return <div className="flex justify-center py-20"><Spinner label="Loading page" /></div>;
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Loading />}><PageBoundary>{children}</PageBoundary></Suspense>;
}

export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => { init(); }, [init]);

  if (!isConfigured) return <SetupMissingPage />;

  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>
          {/* Opened from the reset-link email, which signs the user in; so no PublicOnly guard here. */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<OnboardingRoute />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="/profile" element={<Lazy><MyProfilePage /></Lazy>} />
              <Route path="/profile/edit" element={<Lazy><EditProfilePage /></Lazy>} />
              <Route path="/u/:username" element={<Lazy><PublicProfilePage /></Lazy>} />
              <Route path="/discover" element={<Lazy><DiscoverPage /></Lazy>} />
              <Route path="/requests" element={<Lazy><RequestsPage /></Lazy>} />
              <Route path="/notifications" element={<Lazy><NotificationsPage /></Lazy>} />
              <Route path="/chat" element={<Lazy><ChatListPage /></Lazy>} />
              <Route path="/chat/:id" element={<Lazy><ChatRoomPage /></Lazy>} />
              <Route path="/groups" element={<Lazy><GroupsPage /></Lazy>} />
              <Route path="/groups/new" element={<Lazy><NewGroupPage /></Lazy>} />
              <Route path="/groups/:id" element={<Lazy><GroupDetailPage /></Lazy>} />
              <Route path="/events" element={<Lazy><EventsPage /></Lazy>} />
              <Route path="/teammates" element={<Lazy><TeammatesPage /></Lazy>} />
              <Route path="/study" element={<Lazy><StudyPage /></Lazy>} />
              <Route path="/lost-found" element={<Lazy><LostFoundPage /></Lazy>} />
              <Route path="/rides" element={<Lazy><RidesPage /></Lazy>} />
              <Route path="/confessions" element={<Lazy><ConfessionsPage /></Lazy>} />
              <Route path="/seniors" element={<Lazy><SeniorsPage /></Lazy>} />
              <Route path="/notices" element={<Lazy><NoticesPage /></Lazy>} />
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<Lazy><AdminPage /></Lazy>} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
        <Toaster />
      </HashRouter>
    </ErrorBoundary>
  );
}
