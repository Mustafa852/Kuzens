"use client";

import { deleteApp, getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  deleteUser,
  getAuth,
  setPersistence,
  signOut,
  type Auth,
} from "firebase/auth";

type PublicFirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

let authPromise: Promise<Auth> | null = null;

export function getKuzensFirebaseAuth() {
  authPromise ||= (async () => {
    const response = await fetch("/api/auth/config", {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    const data = (await response.json()) as {
      configured?: boolean;
      config?: PublicFirebaseConfig;
    };
    if (!response.ok || !data.configured || !data.config) {
      throw new Error("Kuzens giriş sistemi henüz etkinleştirilmedi.");
    }
    const app: FirebaseApp = getApps().length ? getApp() : initializeApp(data.config);
    const auth = getAuth(app);
    auth.languageCode = "tr";
    await setPersistence(auth, browserLocalPersistence);
    return auth;
  })();
  return authPromise;
}

export async function signOutKuzensFirebase() {
  const auth = await getKuzensFirebaseAuth();
  await signOut(auth);
}

export async function deleteKuzensFirebaseUser() {
  const auth = await getKuzensFirebaseAuth();
  if (auth.currentUser) await deleteUser(auth.currentUser);
}

export async function resetKuzensFirebaseForTests() {
  authPromise = null;
  for (const app of getApps()) await deleteApp(app);
}

