import React, { useState, useEffect } from "react";
import { authClient } from "../../lib/auth-client";
import { useToast } from "../../hooks/use-toast";
import { getGravatarUrl } from "../../api/lib/avatar";
import {
  ProfileSection,
  PasswordSection,
  AppearanceSection,
} from "./SettingsPageSections";
import { withErrorBoundary } from "../common/withErrorBoundary";
type User = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

// ponytail: parse DiceBear seed from URL (lorelei only)
function parseDiceBearUrl(url: string | null | undefined): { seed: string } {
  const fallback = { seed: "" };
  if (!url) return fallback;
  try {
    const u = new URL(url);
    const seed = u.searchParams.get("seed") || "";
    return { seed };
  } catch {
    return fallback;
  }
}

const buildDicebearUrl = (seed: string) =>
  `https://api.dicebear.com/8.x/lorelei/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f8fafc`;

function SettingsPageInner() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Profile fields
  const [name, setName] = useState("");
  const [avatarType, setAvatarType] = useState<
    "initials" | "gravatar" | "dicebear"
  >("initials");
  const [dicebearSeed, setDicebearSeed] = useState("");
  const [gravatarUrl, setGravatarUrl] = useState("");
  const [theme, setTheme] = useState<"light" | "dark" | "system">("dark");
  const { toast } = useToast();

  // Password change fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  // null = loading, true = has email+password, false = OAuth only
  const [hasPasswordAccount, setHasPasswordAccount] = useState<boolean | null>(
    null
  );

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme =
      (localStorage.getItem("meterly-theme") as "light" | "dark" | "system") ||
      "dark";
    setTheme(savedTheme);

    authClient.getSession().then((result) => {
      if (result.data?.user) {
        const u = result.data.user;
        setUser(u as User);
        setName(u.name);

        const img = u.image;
        if (!img) {
          setAvatarType("initials");
          setDicebearSeed(u.name || u.id);
        } else if (img.includes("gravatar.com")) {
          setAvatarType("gravatar");
          setDicebearSeed(u.name || u.id);
        } else if (img.includes("dicebear.com")) {
          setAvatarType("dicebear");
          const parsed = parseDiceBearUrl(img);
          setDicebearSeed(parsed.seed || u.name || u.id);
        } else {
          setAvatarType("initials");
          setDicebearSeed(u.name || u.id);
        }
      }
      setIsLoading(false);
    });

    // Detect whether the user signed up with email+password or OAuth-only.
    // Better Auth's listAccounts returns each linked provider.
    // The email+password account uses provider = 'credential'.
    authClient
      .listAccounts()
      .then((result) => {
        if (result.data) {
          const hasEmail = (result.data as Array<{ providerId: string }>).some(
            (acc) => acc.providerId === "credential"
          );
          setHasPasswordAccount(hasEmail);
        } else {
          setHasPasswordAccount(true); // fallback: assume yes
        }
      })
      .catch(() => setHasPasswordAccount(true));
  }, []);

  // Update Gravatar preview when user email is loaded
  useEffect(() => {
    if (user?.email) {
      getGravatarUrl(user.email).then((url) => setGravatarUrl(url));
    }
  }, [user?.email]);

  const handleSave = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Validation error",
        description: "Name cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      let finalImage: string | null = null;
      if (avatarType === "gravatar") {
        finalImage = gravatarUrl || (await getGravatarUrl(user?.email || ""));
      } else if (avatarType === "dicebear") {
        finalImage = buildDicebearUrl(dicebearSeed);
      } // initials leaves finalImage as null

      const { error } = await authClient.updateUser({
        name: name.trim(),
        image: finalImage,
      });

      if (error) {
        toast({
          title: "Error updating profile",
          description: error.message || "Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Profile updated",
          description: "Your changes have been saved successfully.",
        });
        // Update local user state
        setUser((prev) =>
          prev ? { ...prev, name: name.trim(), image: finalImage } : null
        );
      }
    } catch {
      toast({
        title: "Error updating profile",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (
    e: React.SubmitEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    if (!currentPassword) {
      toast({
        title: "Validation error",
        description: "Current password is required.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        title: "Validation error",
        description: "New password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Validation error",
        description: "New passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });

      if (error) {
        toast({
          title: "Error changing password",
          description: error.message || "Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password updated",
          description:
            "Your password has been changed successfully. A confirmation email has been sent.",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      toast({
        title: "Error changing password",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await authClient.signOut();
    window.location.href = "/login";
  };

  // ponytail: client-side theme switcher matching astro layouts
  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    localStorage.setItem("meterly-theme", newTheme);
    const dark =
      newTheme === "dark" ||
      (newTheme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute(
      "data-theme",
      dark ? "dark" : "light"
    );
    toast({
      title: "Theme updated",
      description: `Interface style set to ${newTheme}.`,
    });
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          maxWidth: "560px",
        }}
      >
        {[1, 2].map((i) => (
          <div
            key={i}
            className="skeleton"
            style={{ height: "80px", borderRadius: "8px" }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: "560px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: "1.25rem", fontWeight: 700 }}>
          Settings
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: "0.9375rem",
            color: "var(--color-text-muted)",
          }}
        >
          Manage your account
        </p>
      </div>

      <ProfileSection
        user={user}
        name={name}
        setName={setName}
        avatarType={avatarType}
        setAvatarType={setAvatarType}
        dicebearSeed={dicebearSeed}
        setDicebearSeed={setDicebearSeed}
        gravatarUrl={gravatarUrl}
        isSaving={isSaving}
        onSave={handleSave}
      />

      <PasswordSection
        hasPasswordAccount={hasPasswordAccount}
        currentPassword={currentPassword}
        setCurrentPassword={setCurrentPassword}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        isChangingPassword={isChangingPassword}
        onSubmit={handleChangePassword}
      />

      <AppearanceSection theme={theme} onThemeChange={handleThemeChange} />

      {/* Sign out */}
      <div className="card" style={{ padding: "24px" }}>
        <h3
          style={{ margin: "0 0 8px", fontSize: "0.9375rem", fontWeight: 600 }}
        >
          Account
        </h3>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: "0.875rem",
            color: "var(--color-text-muted)",
          }}
        >
          Signing out will end your session on this device.
        </p>
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="btn btn-secondary"
        >
          {isSigningOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </div>
  );
}

export const SettingsPage = withErrorBoundary(SettingsPageInner);
