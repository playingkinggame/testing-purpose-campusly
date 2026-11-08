import { Link } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { PasswordForm } from './PasswordForm';

export default function LoginPage() {
  return (
    <AuthLayout title="Welcome back" subtitle="Log in with your VIT student email and password.">
      <PasswordForm mode="login" />
      <p className="text-center text-sm text-muted">
        New here? <Link to="/signup" className="font-semibold text-forest hover:underline">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
