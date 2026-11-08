import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, UserX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AsyncView, EmptyState } from '@/components/ui/Feedback';
import { ProfileView } from '@/components/profile/ProfileView';
import { RelationActions } from '@/components/social/RelationActions';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/authStore';
import { getPublicProfileByUsername } from '@/lib/api/profiles';

export default function PublicProfilePage() {
  const { username = '' } = useParams<{ username: string }>();
  const me = useAuth((s) => s.userId);
  const navigate = useNavigate();
  const state = useAsync(() => getPublicProfileByUsername(username), [username]);
  const person = state.data;

  if (person && person.id === me) return <Navigate to="/profile" replace />;

  return (
    <div className="space-y-4">
      <Link to="/discover" className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Discover
      </Link>

      <AsyncView
        loading={state.loading}
        error={state.error}
        onRetry={() => void state.reload()}
        hasData={!!person}
        isEmpty={!state.loading && !state.error && !person}
        empty={
          <EmptyState
            icon={<UserX className="h-6 w-6" />}
            title="Profile not available"
            text="This account may be private, blocked, or the username is wrong."
            action={<Link to="/discover"><Button size="sm">Find people</Button></Link>}
          />
        }
      >
        {person && (
          <ProfileView
            profile={person}
            isOwn={false}
            actions={
              <RelationActions
                person={person}
                onChanged={() => void state.reload()}
                onBlocked={() => navigate('/discover')}
              />
            }
          />
        )}
      </AsyncView>
    </div>
  );
}
