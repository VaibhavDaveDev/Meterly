import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { VerifyEmailForm } from "./VerifyEmailForm";
import { authClient } from "../../lib/auth-client";

vi.mock("../../lib/auth-client", () => ({
  authClient: {
    emailOtp: {
      sendVerificationOtp: vi.fn(),
      verifyEmail: vi.fn(),
    },
  },
}));

describe("VerifyEmailForm", () => {
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
      search: "?email=test%40example.com",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("displays context banner and adjusted description when reason=login is present in query params", () => {
    window.location.search = "?email=test%40example.com&reason=login";

    render(<VerifyEmailForm />);

    expect(
      screen.getByText(/your email isn't verified yet/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/enter the 6-digit code for test@example.com/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/we sent a 6-digit code to/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/check your email for the 6-digit verification code/i)
    ).not.toBeInTheDocument();
  });

  it("displays standard check-email message when arriving from signup", () => {
    window.location.search = "?email=test%40example.com";

    render(<VerifyEmailForm />);

    expect(
      screen.getByText(/check your email for the 6-digit verification code/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/your email isn't verified yet/i)
    ).not.toBeInTheDocument();
  });

  it("calls sendVerificationOtp and displays countdown timer upon clicking resend code", async () => {
    window.location.search = "?email=test%40example.com";
    vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValueOnce({
      error: null,
      data: null,
    } as never);

    render(<VerifyEmailForm />);

    const resendBtn = screen.getByRole("button", { name: /resend code/i });
    expect(resendBtn).toBeInTheDocument();

    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(authClient.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
        email: "test@example.com",
        type: "email-verification",
      });
      expect(
        screen.getByText(
          /if an account exists, a verification code has been sent/i
        )
      ).toBeInTheDocument();
      expect(screen.getByText(/resend available in 5m/i)).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: /resend code/i })
    ).not.toBeInTheDocument();
  });

  it("handles rate-limit cooldown message from server", async () => {
    window.location.search = "?email=test%40example.com";
    vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValueOnce({
      error: {
        message: "Please wait 15 minutes before requesting another code.",
      },
      data: null,
    } as never);

    render(<VerifyEmailForm />);

    const resendBtn = screen.getByRole("button", { name: /resend code/i });
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(screen.getByText(/resend available in 15m/i)).toBeInTheDocument();
    });
  });

  it("submits 6-digit OTP and redirects on success", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.location.search = "?email=test%40example.com";
    vi.mocked(authClient.emailOtp.verifyEmail).mockResolvedValueOnce({
      error: null,
      data: null,
    } as never);

    render(<VerifyEmailForm />);

    const otpInput = screen.getByLabelText(/verification code/i);
    fireEvent.change(otpInput, { target: { value: "123456" } });

    const submitBtn = screen.getByRole("button", { name: /verify email/i });
    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authClient.emailOtp.verifyEmail).toHaveBeenCalledWith({
        email: "test@example.com",
        otp: "123456",
      });
      expect(
        screen.getByText(/email verified! redirecting/i)
      ).toBeInTheDocument();
    });

    await vi.advanceTimersByTimeAsync(1600);

    expect(assignedHref).toBe("/login?verified=true");
    vi.useRealTimers();
  });

  it("formats cooldown countdown accurately across second ticks (e.g. 4m 59s instead of 5m 59s)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.location.search = "?email=test%40example.com";
    vi.mocked(authClient.emailOtp.sendVerificationOtp).mockResolvedValueOnce({
      error: null,
      data: null,
    } as never);

    render(<VerifyEmailForm />);

    const resendBtn = screen.getByRole("button", { name: /resend code/i });
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/resend available in 5m 0s/i)
      ).toBeInTheDocument();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/resend available in 4m 59s/i)
      ).toBeInTheDocument();
    });

    vi.useRealTimers();
  });
});
