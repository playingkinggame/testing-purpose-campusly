import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-mint text-forest" aria-hidden="true"><Compass className="h-8 w-8" /></div>
      <h1 className="text-3xl font-bold text-forest">Page not found</h1>
      <p className="max-w-sm text-muted">That page does not exist, or it moved. Let's get you back.</p>
      <Link to="/"><Button>Go to Home</Button></Link>
    </div>
  );
}
