import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, MessageCircle, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/store/uiStore';
import { friendlyError } from '@/lib/errors';
import { startDm } from '@/lib/api/conversations';
import { sendRequest } from '@/lib/api/connections';

interface Props {
  userId: string;
  connected?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
  label?: string;
}

export function MessageButton({ userId, connected = true, size = 'sm', variant = 'secondary', className, label }: Props) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(false);

  const message = async () => {
    setBusy(true);
    try {
      const id = await startDm(userId);
      navigate(`/chat/${id}`);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setBusy(true);
    try {
      await sendRequest(userId);
      setRequested(true);
      toast.success('Connection request sent.');
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!connected) {
    return (
      <Button variant="secondary" size={size} className={className} onClick={() => void connect()} loading={busy} disabled={requested}>
        {requested ? <Clock className="h-4 w-4" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
        {requested ? 'Pending' : label ?? 'Connect'}
      </Button>
    );
  }

  return (
    <Button variant={variant} size={size} className={className} onClick={() => void message()} loading={busy}>
      <MessageCircle className="h-4 w-4" aria-hidden="true" /> {label ?? 'Message'}
    </Button>
  );
}
