"use client";

import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { logAdminAction } from "@/lib/admin";
import { clearSavedData, firebase, HAS_FIREBASE_CONFIG } from "@/lib/firebase";
import { flushViews, setViewActor } from "@/lib/viewLog";

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
  /** Set while a person is signing in by hand, so "Signed in" is logged once — not on every page reload that restores the session. */
  const signingIn = useRef(false);

  useEffect(() => {
    if (!HAS_FIREBASE_CONFIG) return;
    const { auth, db } = firebase();
    return onAuthStateChanged(auth, async user => {
      if (!user) {
        signingIn.current = false;
        setViewActor("", "");
        setState({ status: "signedOut" });
        return;
      }
      const email = user.email ?? "";
      try {
        const snap = await getDoc(doc(db, "people", user.uid));
        const profile = snap.exists() ? ({ id: snap.id, ...snap.data() } as PersonDoc) : null;
        if (!profile) setState({ status: "denied", reason: NO_PROFILE, email });
        else if (profile.active === false) setState({ status: "denied", reason: DEACTIVATED, email });
        else if (profile.appRole !== "owner" && profile.appRole !== "superadmin") setState({ status: "denied", reason: NOT_OWNER, email });
        else {
          setViewActor(user.uid, profile.name);
          setState({ status: "ready", uid: user.uid, email, profile });
          if (signingIn.current) {
            signingIn.current = false;
            void logAdminAction("Signed in", { kind: "auth", targetType: "person", targetId: user.uid }, profile.name);
          }
        }
      } catch (e) {
        setState({ status: "denied", reason: e instanceof Error ? e.message : "Couldn't load your profile.", email });
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signIn: async (email, password) => {
        signingIn.current = true;
        try {
          await signInWithEmailAndPassword(firebase().auth, email, password);
        } catch (e) {
          signingIn.current = false;
          throw e;
        }
      },
      signOutUser: async () => {
        // Log while still signed in (the rules need it), and send any waiting page-view lines first. Never block signing out for long.
        if (state.status === "ready") {
          const name = state.profile.name;
          await Promise.race([
            Promise.all([
              flushViews(),
              logAdminAction("Signed out", { kind: "auth", targetType: "person", targetId: state.uid }, name),
            ]),
            new Promise(resolve => setTimeout(resolve, 3000)),
          ]);
        }
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

/** True for the superadmin: an owner who can also grant/revoke admin and read the audit log. */
export function useIsSuperadmin(): boolean {
  const { state } = useAuth();
  return state.status === "ready" && state.profile.appRole === "superadmin";
}

/** The signed-in owner. Only call below AuthGate, which renders children only once someone is ready. */
export function useAdmin() {
  const { state } = useAuth();
  if (state.status !== "ready") throw new Error("useAdmin used before sign-in finished");
  return state;
}
