import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getAdminSessionCookieName,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<{ error?: string; next?: string }> | { error?: string; next?: string };
};

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminSessionCookieName())?.value;
  const session = await verifyAdminSessionToken(token);

  if (session.ok) {
    redirect("/admin");
  }

  const hasError = resolvedParams?.error === "1";
  const nextParam = resolvedParams?.next ?? "";

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md border border-gray-800 rounded-lg p-6 bg-gray-950">
        <h1 className="text-2xl font-bold mb-2">Admin Login</h1>
        <p className="text-sm text-gray-400 mb-6">
          Sign in to access the admin dashboard.
        </p>

        {hasError && (
          <div className="mb-4 text-sm text-red-400">
            Invalid credentials. Try again.
          </div>
        )}

        <form action="/api/admin/login" method="POST" className="space-y-3">
          <input type="hidden" name="next" value={nextParam} />
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
              Username
            </label>
            <input
              name="username"
              type="text"
              autoComplete="username"
              className="w-full rounded bg-black border border-gray-800 px-3 py-2 text-sm text-white"
              required
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
              Password
            </label>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded bg-black border border-gray-800 px-3 py-2 text-sm text-white"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-green-400 text-black font-semibold py-2 rounded hover:bg-green-300 transition"
          >
            Sign In
          </button>
        </form>

        <div className="mt-6 text-xs text-gray-500">
          <Link href="/" className="underline text-gray-400 hover:text-white">
            Back to site
          </Link>
        </div>
      </div>
    </main>
  );
}
