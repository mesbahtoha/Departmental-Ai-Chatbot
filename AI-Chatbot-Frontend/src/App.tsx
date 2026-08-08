import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { AppShell } from '@/components/layout/AppShell';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ProtectedRoute, AdminRoute, PublicOnlyRoute } from '@/routes/guards';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { LandingPage } from '@/pages/LandingPage';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';

// Route-level code splitting: heavy pages (markdown/katex/highlight.js,
// admin tables & charts) are loaded on demand so the initial bundle stays small.
const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/PasswordPages').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/auth/PasswordPages').then((m) => ({ default: m.ResetPasswordPage })));
const ChatPage = lazy(() => import('@/pages/chat/ChatPage').then((m) => ({ default: m.ChatPage })));
const ShareView = lazy(() => import('@/pages/chat/ShareView').then((m) => ({ default: m.ShareView })));
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminUsers = lazy(() => import('@/pages/admin/Users').then((m) => ({ default: m.AdminUsers })));
const AdminNotices = lazy(() => import('@/pages/admin/Notices').then((m) => ({ default: m.AdminNotices })));
const AdminChats = lazy(() => import('@/pages/admin/Chats').then((m) => ({ default: m.AdminChats })));
const AdminAnalytics = lazy(() => import('@/pages/admin/Analytics').then((m) => ({ default: m.AdminAnalytics })));
const AdminTokens = lazy(() => import('@/pages/admin/Tokens').then((m) => ({ default: m.AdminTokens })));
const AdminSettings = lazy(() => import('@/pages/admin/Settings').then((m) => ({ default: m.AdminSettings })));
const AdminPromptTemplates = lazy(() => import('@/pages/admin/PromptTemplates').then((m) => ({ default: m.AdminPromptTemplates })));
const AdminLogs = lazy(() => import('@/pages/admin/Logs').then((m) => ({ default: m.AdminLogs })));
const AdminSystem = lazy(() => import('@/pages/admin/System').then((m) => ({ default: m.AdminSystem })));

const PageLoader = () => <FullPageSpinner label="Loading…" />;

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);
  const logout = useAuthStore((s) => s.logout);
  const resetChat = useChatStore((s) => s.reset);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const onExpired = () => {
      void logout();
      window.location.assign('/login');
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [logout]);

  useEffect(() => {
    return () => resetChat();
  }, [resetChat]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>
          <Route path="/share/:token" element={<ShareView />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/:id" element={<ChatPage />} />
          </Route>
        </Route>

        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/notices" element={<AdminNotices />} />
            <Route path="/admin/chats" element={<AdminChats />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/tokens" element={<AdminTokens />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/prompt-templates" element={<AdminPromptTemplates />} />
            <Route path="/admin/logs" element={<AdminLogs />} />
            <Route path="/admin/system" element={<AdminSystem />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
