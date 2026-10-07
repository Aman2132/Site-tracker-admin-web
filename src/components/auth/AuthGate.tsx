"use client";

import { Loader2, LogIn } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { Field, TextInput } from "@/components/domain/FormBits";
import { BrandMark } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { HAS_FIREBASE_CONFIG } from "@/lib/firebase";

import { useAuth } from "./AuthProvider";

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="surface w-full max-w-[400px] space-y-6 rounded-3xl p-7 sm:p-8">{children}</div>
    </div>
  );
}

function LoginForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch {
      // Firebase's codes (wrong-password, user-not-found, ...) say too much about which emails exist.
      setError("Email or password is incorrect.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Centered>
      <BrandMark />
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Use your owner account from the Site Tracker app.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" htmlFor="login-email">
          <TextInput id="login-email" type="email" autoComplete="username" autoFocus required value={email} onChange={e => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="login-password" error={error ?? undefined}>
          <TextInput
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            invalid={!!error}
            onChange={e => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full rounded-xl shadow-glow" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <LogIn />} Sign in
        </Button>
      </form>
    </Centered>
  );
}

/** Renders the dashboard only for a signed-in, active owner; everyone else gets the right screen instead. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { state, signOutUser } = useAuth();

  if (!HAS_FIREBASE_CONFIG) {
    return (
      <Centered>
        <BrandMark />
        <p className="text-sm text-muted-foreground">
          Firebase isn&apos;t configured. Copy the <code className="font-mono">NEXT_PUBLIC_FIREBASE_*</code> values into{" "}
          <code className="font-mono">.env.local</code> (see the README) and restart.
        </p>
      </Centered>
    );
  }
  if (state.status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }
  if (state.status === "signedOut") return <LoginForm />;
  if (state.status === "denied") {
    return (
      <Centered>
        <BrandMark />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Can&apos;t open the dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">{state.reason}</p>
          <p className="mt-1 text-xs text-faint">Signed in as {state.email}</p>
        </div>
        <Button variant="outline" size="lg" className="w-full rounded-xl" onClick={signOutUser}>
          Sign out
        </Button>
      </Centered>
    );
  }
  return <>{children}</>;
}
