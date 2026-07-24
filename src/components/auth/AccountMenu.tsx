import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronDown, Cloud, LogOut, Pencil, UserPlus } from "lucide-react";
import { isDesktopRuntime } from "../../lib/cloud/authBridge";
import { useAuthStore } from "../../store/useAuthStore";

export function AccountMenu() {
  const status = useAuthStore((state) => state.status);
  const currentUser = useAuthStore((state) => state.currentUser);
  const openDialog = useAuthStore((state) => state.openDialog);
  const logout = useAuthStore((state) => state.logout);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  if (status !== "authenticated" || !currentUser) {
    return (
      <div className="guest-actions">
        <button className="account-text-button" type="button" onClick={() => openDialog("login")}>
          <Cloud size={15} />
          登录
        </button>
        <button className="account-register-button" type="button" onClick={() => openDialog("register")}>
          <UserPlus size={15} />
          注册
        </button>
      </div>
    );
  }

  async function handleProfileSubmit(event: FormEvent) {
    event.preventDefault();
    if (!nickname.trim()) return;
    const saved = await updateProfile(nickname.trim(), currentUser?.avatarUrl ?? null);
    if (saved) setEditing(false);
  }

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        className="account-trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((visible) => !visible)}
      >
        <span className="account-avatar" aria-hidden="true">
          {currentUser.nickname.slice(0, 1).toUpperCase()}
        </span>
        <span>
          <strong>{currentUser.nickname}</strong>
          <small>云端已连接</small>
        </span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="account-popover" role="menu">
          <div className="account-summary">
            <strong>{currentUser.nickname}</strong>
            <span>{currentUser.email}</span>
          </div>
          {editing ? (
            <form className="account-edit-form" onSubmit={handleProfileSubmit}>
              <label>
                <span>昵称</span>
                <input
                  autoFocus
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  maxLength={32}
                />
              </label>
              <div>
                <button type="button" onClick={() => setEditing(false)}>取消</button>
                <button type="submit">保存</button>
              </div>
            </form>
          ) : (
            <button
              className="account-menu-item"
              role="menuitem"
              type="button"
              onClick={() => {
                setNickname(currentUser.nickname);
                setEditing(true);
              }}
            >
              <Pencil size={15} />
              修改昵称
            </button>
          )}
          <button
            className="account-menu-item danger"
            role="menuitem"
            type="button"
            onClick={() => void logout()}
          >
            <LogOut size={15} />
            退出登录
          </button>
          {!isDesktopRuntime() && (
            <small className="desktop-only-note">请在桌面程序中使用账号功能</small>
          )}
        </div>
      )}
    </div>
  );
}
