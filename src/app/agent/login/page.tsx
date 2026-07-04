import { LoginForm } from '@/components/LoginForm';

export default function AgentLoginPage() {
  return <LoginForm role="agent" title="Agent Sign In" subtitle="Use your username or name · default password: agent123" redirectTo="/agent/games" />;
}
