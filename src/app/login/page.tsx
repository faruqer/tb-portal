import { LoginForm } from '@/components/LoginForm';

export default function AdminLoginPage() {
  return <LoginForm role="admin" title="Admin Sign In" subtitle="Manage games, agents, and payments" redirectTo="/games" />;
}
