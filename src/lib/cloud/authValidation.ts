export interface AuthFieldErrors {
  email?: string;
  password?: string;
  nickname?: string;
}

export function validateEmail(email: string) {
  const normalized = email.trim();
  if (!normalized) return "请输入邮箱";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return "请输入有效的邮箱地址";
  }
  return undefined;
}

export function validatePassword(password: string) {
  if (!password) return "请输入密码";
  const length = new TextEncoder().encode(password).length;
  if (length < 8) return "密码至少需要 8 个字符";
  if (length > 72) return "密码不能超过 72 个字节";
  return undefined;
}

export function validateNickname(nickname: string) {
  const normalized = nickname.trim();
  if (!normalized) return "请输入昵称";
  if (Array.from(normalized).length > 32) return "昵称不能超过 32 个字符";
  return undefined;
}

export function validateLogin(email: string, password: string): AuthFieldErrors {
  return {
    email: validateEmail(email),
    password: validatePassword(password)
  };
}

export function validateRegistration(
  email: string,
  password: string,
  nickname: string
): AuthFieldErrors {
  return {
    ...validateLogin(email, password),
    nickname: validateNickname(nickname)
  };
}

export function hasAuthErrors(errors: AuthFieldErrors) {
  return Object.values(errors).some(Boolean);
}
