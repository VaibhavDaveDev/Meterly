import type React from "react";
import { DiceBearPicker } from "./DiceBearPicker";

interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

const getInitials = (nameStr: string) => {
  const parts = nameStr.trim().split(" ");
  return parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : nameStr.slice(0, 2);
};

const buildDicebearUrl = (seed: string) =>
  `https://api.dicebear.com/8.x/lorelei/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f8fafc`;

interface ProfileSectionProps {
  user: User | null;
  name: string;
  setName: (name: string) => void;
  avatarType: "initials" | "gravatar" | "dicebear";
  setAvatarType: (type: "initials" | "gravatar" | "dicebear") => void;
  dicebearSeed: string;
  setDicebearSeed: (seed: string) => void;
  gravatarUrl: string;
  isSaving: boolean;
  onSave: (e: React.SubmitEvent<HTMLFormElement>) => void;
}

export function ProfileSection({
  user,
  name,
  setName,
  avatarType,
  setAvatarType,
  dicebearSeed,
  setDicebearSeed,
  gravatarUrl,
  isSaving,
  onSave,
}: ProfileSectionProps) {
  return (
    <form
      onSubmit={onSave}
      className="card"
      style={{
        padding: "24px",
        display: "flex",
        flexDirection: "row",
        gap: "40px",
        flexWrap: "wrap",
      }}
    >
      {/* Left: Avatar Preview */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          minWidth: "160px",
        }}
      >
        <div
          style={{
            width: "140px",
            height: "140px",
            borderRadius: "50%",
            overflow: "hidden",
            backgroundColor: "var(--color-surface-raised)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: "1px solid var(--color-border)",
          }}
        >
          {avatarType === "initials" ? (
            <span
              style={{
                fontSize: "3rem",
                fontWeight: 700,
                color: "#fff",
                backgroundColor: "var(--color-accent)",
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                userSelect: "none",
              }}
            >
              {getInitials(name || user?.name || "").toUpperCase()}
            </span>
          ) : (
            <img
              src={
                avatarType === "gravatar"
                  ? gravatarUrl
                  : buildDicebearUrl(dicebearSeed)
              }
              alt="Avatar preview"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
        </div>
        <div style={{ textAlign: "center" }}>
          <h4
            className="font-heading"
            style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}
          >
            Avatar Preview
          </h4>
          <p
            style={{
              margin: 0,
              fontSize: "0.75rem",
              color: "var(--color-text-muted)",
              maxWidth: "140px",
            }}
          >
            {avatarType === "initials" && "Using name initials fallback"}
            {avatarType === "gravatar" && "Using your Gravatar profile picture"}
            {avatarType === "dicebear" && "Using DiceBear avatar selection"}
          </p>
        </div>
      </div>

      {/* Right: Info and Settings */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label className="form-label" htmlFor="profile-name">
            Name
          </label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              padding: "8px 12px",
              backgroundColor: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              borderRadius: "6px",
              color: "var(--color-text)",
              fontSize: "0.9375rem",
            }}
            required
            disabled={isSaving}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label className="form-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={user?.email ?? ""}
            style={{
              padding: "8px 12px",
              backgroundColor: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              borderRadius: "6px",
              color: "var(--color-text)",
              fontSize: "0.9375rem",
              opacity: 0.6,
              cursor: "not-allowed",
            }}
            disabled
          />
          <span
            style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}
          >
            Email address cannot be changed.
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            marginTop: "8px",
          }}
        >
          <label className="form-label" style={{ marginBottom: "-4px" }}>
            Avatar Style
          </label>

          {/* Current Avatar Preview */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "4px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor:
                  avatarType === "initials"
                    ? "var(--color-primary)"
                    : "var(--color-surface)",
                border: "1px solid var(--color-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 600,
                fontSize: "1.125rem",
                overflow: "hidden",
              }}
            >
              {avatarType === "initials" &&
                (name
                  ? name.charAt(0).toUpperCase()
                  : (user?.email ?? "").charAt(0).toUpperCase())}
              {avatarType === "gravatar" && (
                <img
                  src={gravatarUrl}
                  alt="Gravatar"
                  style={{ width: "100%", height: "100%" }}
                />
              )}
              {avatarType === "dicebear" && (
                <img
                  src={buildDicebearUrl(dicebearSeed)}
                  alt="Dicebear"
                  style={{ width: "100%", height: "100%" }}
                />
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "8px",
            }}
          >
            {(["initials", "gravatar", "dicebear"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setAvatarType(type)}
                aria-pressed={avatarType === type}
                style={{
                  padding: "10px 6px",
                  borderRadius: "6px",
                  border: `1px solid ${
                    avatarType === type
                      ? "var(--color-accent)"
                      : "var(--color-border)"
                  }`,
                  backgroundColor:
                    avatarType === type
                      ? "rgba(99, 102, 241, 0.1)"
                      : "var(--color-surface-raised)",
                  color:
                    avatarType === type
                      ? "var(--color-text)"
                      : "var(--color-text-muted)",
                  fontSize: "0.8125rem",
                  fontWeight: 550,
                  cursor: "pointer",
                  textAlign: "center",
                  textTransform: "capitalize",
                }}
              >
                {type === "initials"
                  ? "Initials"
                  : type === "gravatar"
                    ? "Gravatar"
                    : "DiceBear"}
              </button>
            ))}
          </div>
        </div>

        {avatarType === "dicebear" && (
          <DiceBearPicker
            seed={dicebearSeed}
            isSaving={isSaving}
            onSeedChange={setDicebearSeed}
          />
        )}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ alignSelf: "flex-start", marginTop: "12px" }}
          disabled={isSaving}
        >
          {isSaving ? "Saving changes..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

interface PasswordSectionProps {
  hasPasswordAccount: boolean | null;
  currentPassword: string;
  setCurrentPassword: (p: string) => void;
  newPassword: string;
  setNewPassword: (p: string) => void;
  confirmPassword: string;
  setConfirmPassword: (p: string) => void;
  isChangingPassword: boolean;
  onSubmit: (e: React.SubmitEvent<HTMLFormElement>) => void;
}

export function PasswordSection({
  hasPasswordAccount,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  isChangingPassword,
  onSubmit,
}: PasswordSectionProps) {
  return (
    <div
      className="card"
      style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div>
        <h3
          style={{
            margin: "0 0 4px",
            fontSize: "0.9375rem",
            fontWeight: 600,
          }}
        >
          Password
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            color: "var(--color-text-muted)",
          }}
        >
          {hasPasswordAccount === false
            ? "You signed in with Google or Github. You do not have a password yet."
            : "Update the password for your account."}
        </p>
      </div>

      {hasPasswordAccount === false ? (
        <div>
          <p
            style={{
              margin: "0 0 12px",
              fontSize: "0.875rem",
              color: "var(--color-text-muted)",
            }}
          >
            To set a password, use the password reset flow. We will send a
            one-time code to your email.
          </p>
          <a
            href="/forgot-password"
            className="btn btn-primary"
            style={{ display: "inline-block", textDecoration: "none" }}
          >
            Set a Password
          </a>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            maxWidth: "360px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label className="form-label" htmlFor="current-password">
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={{
                padding: "8px 12px",
                backgroundColor: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
                borderRadius: "6px",
                color: "var(--color-text)",
                fontSize: "0.9375rem",
              }}
              required
              disabled={isChangingPassword}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label className="form-label" htmlFor="new-password">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                padding: "8px 12px",
                backgroundColor: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
                borderRadius: "6px",
                color: "var(--color-text)",
                fontSize: "0.9375rem",
              }}
              required
              disabled={isChangingPassword}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label className="form-label" htmlFor="confirm-password">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                padding: "8px 12px",
                backgroundColor: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
                borderRadius: "6px",
                color: "var(--color-text)",
                fontSize: "0.9375rem",
              }}
              required
              disabled={isChangingPassword}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ alignSelf: "flex-start", marginTop: "8px" }}
            disabled={isChangingPassword}
          >
            {isChangingPassword ? "Updating password..." : "Update Password"}
          </button>
        </form>
      )}
    </div>
  );
}

interface AppearanceSectionProps {
  theme: "light" | "dark" | "system";
  onThemeChange: (t: "light" | "dark" | "system") => void;
}

export function AppearanceSection({
  theme,
  onThemeChange,
}: AppearanceSectionProps) {
  return (
    <div
      className="card"
      style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div>
        <h3
          className="font-heading"
          style={{
            margin: "0 0 4px",
            fontSize: "0.9375rem",
            fontWeight: 600,
          }}
        >
          Appearance
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            color: "var(--color-text-muted)",
          }}
        >
          Choose your interface theme.
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "8px",
          maxWidth: "360px",
        }}
      >
        {(["light", "dark", "system"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onThemeChange(t)}
            aria-pressed={theme === t}
            style={{
              padding: "10px 6px",
              borderRadius: "6px",
              border: `1px solid ${theme === t ? "var(--color-accent)" : "var(--color-border)"}`,
              backgroundColor:
                theme === t
                  ? "rgba(99, 102, 241, 0.1)"
                  : "var(--color-surface-raised)",
              color:
                theme === t ? "var(--color-text)" : "var(--color-text-muted)",
              fontSize: "0.8125rem",
              fontWeight: 550,
              cursor: "pointer",
              textAlign: "center",
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
