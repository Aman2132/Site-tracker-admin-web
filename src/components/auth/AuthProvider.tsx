"use client";

import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { clearSavedData, firebase, HAS_FIREBASE_CONFIG } from "@/lib/firebase";

import type { PersonDoc } from "@/types/domain";

/**
 * Who is signed in. Only an active owner gets in: the same rule the database
 * enforces, checked here so everyone else sees a clear message instead of a
 * dashboard full of permission errors.
 */
export type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "denied"; reason: string; email: string }
  | { status: "ready"; uid: string; email: string; profile: PersonDoc };

interface AuthContextValue {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const NOT_OWNER = "This account isn't an admin. Only owners can use the dashboard.";
const DEACTIVATED = "This account has been deactivated.";
const NO_PROFILE = "This account isn't set up on the crew yet.";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: HAS_FIREBASE_CONFIG ? "loading" : "signedOut" });

  useEffect(() => {
    if (!HAS_FIREBASE_CONFIG) return;
    const { auth, db } = firebase();
    return onAuthStateChanged(auth, async user => {
      if (!user) {
        setState({ status: "signedOut" });
        return;
      }
      const email = user.email ?? "";
      try {
        const snap = await getDoc(doc(db, "people", user.uid));
        const profile = snap.exists() ? ({ id: snap.id, ...snap.data() } as PersonDoc) : null;
        if (!profile) setState({ status: "denied", reason: NO_PROFILE, email });
        else if (profile.active === false) setState({ status: "denied", reason: DEACTIVATED, email });
        else if (profile.appRole !== "owner") setState({ status: "denied", reason: NOT_OWNER, email });
        else setState({ status: "ready", uid: user.uid, email, profile });
      } catch (e) {
        setState({ status: "denied", reason: e instanceof Error ? e.message : "Couldn't load your profile.", email });
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(firebase().auth, email, password);
      },
      signOutUser: async () => {
        await signOut(firebase().auth);
        // Leave nothing behind in this browser, then start clean (the cleared Firestore can't be reused).
        await clearSavedData();
        window.location.reload();
      },
    }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** The signed-in owner. Only call below AuthGate, which renders children only once someone is ready. */
export function useAdmin() {
  const { state } = useAuth();
  if (state.status !== "ready") throw new Error("useAdmin used before sign-in finished");
  return state;
}
