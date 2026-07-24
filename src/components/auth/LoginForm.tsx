import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle, LogIn } from "lucide-react";
import {
  hasAuthErrors,
  validateLogin,
  type AuthFieldErrors
} from "../../lib/cloud/authValidation";

interface LoginFormProps {
  busy: boolean;
  onSubmit: (email: string, password: string) => Promise<boolean>;
}

export function LoginForm({ busy, onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<AuthFieldErrors>({});

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateLogin(email, password);
    setErrors(nextErrors);
    if (hasAuthErrors(nextErrors)) return;
    await onSubmit(email, password);
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <label className="auth-field">
        <span>邮箱</span>
        <input
          autoFocus
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onBlur={() => setErrors((current) => ({ ...current, email: validateLogin(email, password).email }))}
          autoComplete="email"
          placeholder="learner@example.com"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "login-email-error" : undefined}
        />
        {errors.email && <small id="login-email-error">{errors.email}</small>}
      </label>

      <label className="auth-field">
        <span>密码</span>
        <span className="password-field">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={() =>
              setErrors((current) => ({
                ...current,
                password: validateLogin(email, password).password
              }))
            }
            autoComplete="current-password"
            placeholder="至少 8 个字符"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "login-password-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </span>
        {errors.password && (
          <small id="login-password-error">{errors.password}</small>
        )}
      </label>

      <button className="button button-primary auth-submit" type="submit" disabled={busy}>
        {busy ? <LoaderCircle className="spin-icon" size={17} /> : <LogIn size={17} />}
        {busy ? "正在登录…" : "登录"}
      </button>
    </form>
  );
}
