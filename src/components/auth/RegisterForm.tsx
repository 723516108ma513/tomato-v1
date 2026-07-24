import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle, UserPlus } from "lucide-react";
import {
  hasAuthErrors,
  validateRegistration,
  type AuthFieldErrors
} from "../../lib/cloud/authValidation";

interface RegisterFormProps {
  busy: boolean;
  onSubmit: (
    email: string,
    password: string,
    nickname: string
  ) => Promise<boolean>;
}

export function RegisterForm({ busy, onSubmit }: RegisterFormProps) {
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<AuthFieldErrors>({});

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateRegistration(email, password, nickname);
    setErrors(nextErrors);
    if (hasAuthErrors(nextErrors)) return;
    await onSubmit(email, password, nickname);
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <label className="auth-field">
        <span>昵称</span>
        <input
          autoFocus
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          autoComplete="nickname"
          placeholder="别人会在学习房间看到这个名字"
          aria-invalid={Boolean(errors.nickname)}
        />
        {errors.nickname && <small>{errors.nickname}</small>}
      </label>

      <label className="auth-field">
        <span>邮箱</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          placeholder="learner@example.com"
          aria-invalid={Boolean(errors.email)}
        />
        {errors.email && <small>{errors.email}</small>}
      </label>

      <label className="auth-field">
        <span>密码</span>
        <span className="password-field">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="8–72 个字节"
            aria-invalid={Boolean(errors.password)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </span>
        {errors.password && <small>{errors.password}</small>}
      </label>

      <button className="button button-primary auth-submit" type="submit" disabled={busy}>
        {busy ? <LoaderCircle className="spin-icon" size={17} /> : <UserPlus size={17} />}
        {busy ? "正在创建账号…" : "创建账号"}
      </button>
    </form>
  );
}
