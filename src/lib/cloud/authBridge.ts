import { invoke } from "@tauri-apps/api/core";
import type { CloudSession, CloudUser } from "./cloudTypes";

const DESKTOP_ONLY_MESSAGE = "账号和组队功能需要在 Tauri 桌面环境中测试";

function ensureDesktopRuntime() {
  if (!("__TAURI_INTERNALS__" in window)) {
    throw new Error(DESKTOP_ONLY_MESSAGE);
  }
}

export async function registerAccount(input: {
  email: string;
  password: string;
  nickname: string;
}) {
  ensureDesktopRuntime();
  return invoke<CloudSession>("cloud_register", input);
}

export async function loginAccount(input: {
  email: string;
  password: string;
}) {
  ensureDesktopRuntime();
  return invoke<CloudSession>("cloud_login", input);
}

export async function restoreCloudSession() {
  ensureDesktopRuntime();
  return invoke<CloudSession | null>("cloud_restore_session");
}

export async function refreshCloudSession() {
  ensureDesktopRuntime();
  return invoke<CloudSession>("cloud_refresh_session");
}

export async function logoutAccount() {
  ensureDesktopRuntime();
  return invoke<void>("cloud_logout");
}

export async function updateCloudProfile(input: {
  nickname: string;
  avatarUrl: string | null;
}) {
  ensureDesktopRuntime();
  return invoke<CloudUser>("cloud_update_current_user", input);
}

export function isDesktopRuntime() {
  return "__TAURI_INTERNALS__" in window;
}
