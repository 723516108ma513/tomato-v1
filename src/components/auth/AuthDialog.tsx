import { useEffect, useRef } from "react";
import { AlertCircle, ShieldCheck, X } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

export function AuthDialog() {
  const dialogOpen = useAuthStore((state) => state.dialogOpen);
  const dialogMode = useAuthStore((state) => state.dialogMode);
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const openDialog = useAuthStore((state) => state.openDialog);
  const closeDialog = useAuthStore((state) => state.closeDialog);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dialogOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
      if (event.key !== "Tab" || !panelRef.current) return;
      const controls = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeDialog, dialogOpen]);

  if (!dialogOpen) return null;
  const busy = status === "authenticating";

  return (
    <div
      className="auth-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) closeDialog();
      }}
    >
      <div
        ref={panelRef}
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-dialog-title"
      >
        <button
          className="auth-close"
          type="button"
          onClick={closeDialog}
          disabled={busy}
          aria-label="关闭账号窗口"
        >
          <X size={18} />
        </button>

        <div className="auth-heading">
          <span><ShieldCheck size={21} /></span>
          <div>
            <p className="eyebrow">CLOUD ACCOUNT</p>
            <h2 id="auth-dialog-title">
              {dialogMode === "login" ? "欢迎回来" : "创建学习账号"}
            </h2>
            <p>登录只用于组队学习；本地任务、AI 记忆和密钥不会上传。</p>
          </div>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="账号操作">
          <button
            role="tab"
            aria-selected={dialogMode === "login"}
            className={dialogMode === "login" ? "is-active" : ""}
            type="button"
            onClick={() => openDialog("login")}
          >
            登录
          </button>
          <button
            role="tab"
            aria-selected={dialogMode === "register"}
            className={dialogMode === "register" ? "is-active" : ""}
            type="button"
            onClick={() => openDialog("register")}
          >
            注册
          </button>
        </div>

        {error && (
          <div className="auth-error" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {dialogMode === "login" ? (
          <LoginForm busy={busy} onSubmit={login} />
        ) : (
          <RegisterForm busy={busy} onSubmit={register} />
        )}
      </div>
    </div>
  );
}
