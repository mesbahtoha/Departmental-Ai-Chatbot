import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { AppShell } from '@/components/layout/AppShell';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ProtectedRoute, AdminRoute, PublicOnlyRoute } from '@/routes/guards';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage, ResetPasswordPage } from '@/pages/auth/PasswordPages';
import { ChatPage } from '@/pages/chat/ChatPage';
import { ShareView } from '@/pages/chat/ShareView';
import { AdminDashboard } from '@/pages/admin/Dashboard';
import { AdminUsers } from '@/pages/admin/Users';
import { AdminNotices } from '@/pages/admin/Notices';
import { AdminChats } from '@/pages/admin/Chats';
import { AdminAnalytics } from '@/pages/admin/Analytics';
import { AdminTokens } from '@/pages/admin/Tokens';
import { AdminSettings } from '@/pages/admin/Settings';
import { AdminPromptTemplates } from '@/pages/admin/PromptTemplates';
import { AdminLogs } from '@/pages/admin/Logs';
import { AdminSystem } from '@/pages/admin/System';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';

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
  );
}
