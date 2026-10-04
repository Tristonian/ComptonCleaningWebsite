import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin sign in', robots: { index: false, follow: false } };

const MESSAGES: Record<string, string> = {
  denied: "That Google account isn't set up as an admin for this site.",
  cancelled: 'Sign-in was cancelled.',
  expired: 'That sign-in took too long. Please try again.',
  failed: "Couldn't complete sign-in. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getAdmin()) redirect('/admin');
  const { error } = await searchParams;
  const message = error ? (MESSAGES[error] ?? MESSAGES.failed) : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-bold text-brand-deep">Admin sign in</h1>
      {message && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {message}
        </p>
      )}
      <a
        href="/api/auth/google"
        className="rounded-xl bg-brand px-4 py-3 text-center font-semibold text-white shadow active:bg-brand-deep"
      >
        Sign in with Google
      </a>
    </main>
  );
}
