import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginForm } from "./LoginForm";
import { authClient } from "../../lib/auth-client";

vi.mock("../../lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: vi.fn(),
      social: vi.fn(),
    },
  },
}));

describe("LoginForm", () => {
  let assignedHref = "";

  beforeEach(() => {
    vi.clearAllMocks();
    assignedHref = "";
    vi.stubGlobal("location", {
      get href() {
        return assignedHref;
      },
      set href(val: string) {
        assignedHref = val;
      },
      search: "",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirects to /verify-email with reason=login when email is unverified", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValueOnce({
      error: { message: "Email is not verified", status: 403 },
      data: null,
    } as never);

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "unverified@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { selector: "input" }), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(assignedHref).toBe(
        "/verify-email?email=unverified%40example.com&reason=login"
      );
    });
  });

  it("shows error message when sign-in fails with invalid credentials", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValueOnce({
      error: { message: "Invalid email or password", status: 401 },
      data: null,
    } as never);

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { selector: "input" }), {
      target: { value: "wrongpassword" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
    });
    expect(assignedHref).toBe("");
  });

  it("redirects to /dashboard on successful login", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValueOnce({
      error: null,
      data: { user: { id: "user-1" } },
    } as never);

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "verified@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { selector: "input" }), {
      target: { value: "correctpassword" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(assignedHref).toBe("/dashboard");
    });
  });
});
