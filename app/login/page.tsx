"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Lock,
  Shield,
  User,
} from "lucide-react";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [loadingInitialCheck, setLoadingInitialCheck] = useState(true);
  const [isFirstRun, setIsFirstRun] = useState(false);

  // Form states
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check if first-run setup is required (userCount === 0)
  useEffect(() => {
    let isMounted = true;
    async function checkUserCount() {
      try {
        const res = await fetch(`/api/users/count?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as { userCount: number };
          if (isMounted) {
            setIsFirstRun(data.userCount === 0);
          }
        }
      } catch (err) {
        console.error("Failed to check user status:", err);
      } finally {
        if (isMounted) {
          setLoadingInitialCheck(false);
        }
      }
    }
    checkUserCount();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleFirstRunSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setError("Username is required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create first user (admin)
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUsername,
          password,
          displayName: displayName.trim() || undefined,
          role: "admin",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create administrator account.");
      }

      setSuccess("Admin account created! Signing in...");

      // 2. Automatically sign in
      const signInRes = await signIn("credentials", {
        username: cleanUsername,
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        setError("Account created, but automatic sign in failed. Please sign in manually.");
        setIsFirstRun(false);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await signIn("credentials", {
        username: cleanUsername,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid username or password. Please try again.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingInitialCheck) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-text-secondary">
        <Loader2 size={32} className="animate-spin text-accent mb-3" />
        <p className="text-sm">Connecting to Private Gallery...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-border-subtle bg-bg-surface/90 p-8 shadow-2xl backdrop-blur-2xl">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-accent/20 to-accent/10 border border-accent/30 shadow-lg shadow-accent/10 mb-4">
          <ImageIcon size={28} className="text-accent" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          {isFirstRun ? "Setup Administrator" : "Welcome to Private Gallery"}
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary">
          {isFirstRun
            ? "Create your initial master administrator account to get started."
            : "Sign in with your credentials to access your media library."}
        </p>

        {isFirstRun && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <Shield size={12} />
            First-Run Setup • Admin Account
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300">
          <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
          <span>{success}</span>
        </div>
      )}

      {/* Form */}
      {isFirstRun ? (
        <form onSubmit={handleFirstRunSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
              Username
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                required
                autoFocus
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-2xl border border-border-strong bg-bg-hover py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
              Display Name (Optional)
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Primary Admin"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-2xl border border-border-strong bg-bg-hover py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
              Password (min. 6 characters)
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-border-strong bg-bg-hover py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-2xl border border-border-strong bg-bg-hover py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Initializing Admin...
              </>
            ) : (
              "Create Admin & Sign In"
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
              Username
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                required
                autoFocus
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-2xl border border-border-strong bg-bg-hover py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-border-strong bg-bg-hover py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Signing In...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg-app p-4 selection:bg-accent/25 selection:text-accent">
      {/* Soft ambient background glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[600px] rounded-full bg-accent/10 blur-[130px]" />

      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-text-secondary">
            <Loader2 size={24} className="animate-spin text-accent" />
            <span>Loading...</span>
          </div>
        }
      >
        <LoginFormContent />
      </Suspense>
    </div>
  );
}
