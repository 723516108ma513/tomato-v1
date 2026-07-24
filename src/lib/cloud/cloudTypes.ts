export interface CloudUser {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CloudSession {
  user: CloudUser;
  accessTokenExpiresAt: string;
}

export type AuthStatus =
  | "idle"
  | "restoring"
  | "guest"
  | "authenticating"
  | "authenticated";

export type AuthDialogMode = "login" | "register";
