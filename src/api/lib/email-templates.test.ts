import { describe, it, expect } from "vitest";
import {
  emailVerificationTemplate,
  passwordResetTemplate,
  tenantInviteTemplate,
  passwordChangedTemplate,
} from "./email-templates";

describe("email-templates", () => {
  describe("shared footer content", () => {
    it("includes a link to the live demo site in every template", () => {
      const templates = [
        emailVerificationTemplate("123456"),
        passwordResetTemplate("654321"),
        tenantInviteTemplate("Owner", "Property", "https://example.com/invite/abc"),
        passwordChangedTemplate("2026-01-01", "10:00 AM"),
      ];

      for (const { html } of templates) {
        expect(html).toContain('href="https://meterly.pages.dev"');
        expect(html).toContain("meterly.pages.dev");
      }
    });

    it("includes a link to the GitHub repository in every template", () => {
      const templates = [
        emailVerificationTemplate("123456"),
        passwordResetTemplate("654321"),
        tenantInviteTemplate("Owner", "Property", "https://example.com/invite/abc"),
        passwordChangedTemplate("2026-01-01", "10:00 AM"),
      ];

      for (const { html } of templates) {
        expect(html).toContain(
          'href="https://github.com/VaibhavDaveDev/Meterly.git"'
        );
        expect(html).toContain("View on GitHub");
        expect(html).toContain("Open source");
      }
    });

    it("still includes the support email contact", () => {
      const { html } = emailVerificationTemplate("123456");
      expect(html).toContain("mailto:meterly.support@protonmail.com");
    });
  });

  describe("emailVerificationTemplate", () => {
    it("returns the expected subject", () => {
      const { subject } = emailVerificationTemplate("123456");
      expect(subject).toBe("Verify your Meterly email");
    });

    it("embeds the OTP code in the HTML body", () => {
      const { html } = emailVerificationTemplate("123456");
      expect(html).toContain("123456");
    });
  });

  describe("passwordResetTemplate", () => {
    it("returns the expected subject", () => {
      const { subject } = passwordResetTemplate("654321");
      expect(subject).toBe("Your Meterly password reset code");
    });

    it("embeds the OTP code in the HTML body", () => {
      const { html } = passwordResetTemplate("654321");
      expect(html).toContain("654321");
    });
  });

  describe("tenantInviteTemplate", () => {
    it("builds a subject that includes the owner's name", () => {
      const { subject } = tenantInviteTemplate(
        "Jane Doe",
        "123 Main St",
        "https://example.com/invite/abc"
      );
      expect(subject).toBe("Jane Doe invited you to Meterly");
    });

    it("embeds the invite URL as a link", () => {
      const { html } = tenantInviteTemplate(
        "Jane Doe",
        "123 Main St",
        "https://example.com/invite/abc"
      );
      expect(html).toContain('href="https://example.com/invite/abc"');
    });

    it("escapes HTML special characters in owner and property names", () => {
      const { html } = tenantInviteTemplate(
        '<script>alert("xss")</script>',
        "Prop & <b>Name</b>",
        "https://example.com/invite/abc"
      );
      expect(html).not.toContain("<script>alert");
      expect(html).toContain("&lt;script&gt;");
      expect(html).toContain("Prop &amp; &lt;b&gt;Name&lt;/b&gt;");
    });
  });

  describe("passwordChangedTemplate", () => {
    it("returns the expected subject", () => {
      const { subject } = passwordChangedTemplate("2026-01-01", "10:00 AM");
      expect(subject).toBe("Your Meterly password has been changed");
    });

    it("embeds the provided date and time", () => {
      const { html } = passwordChangedTemplate("2026-01-01", "10:00 AM");
      expect(html).toContain("2026-01-01");
      expect(html).toContain("10:00 AM");
    });

    it("includes a reset password call-to-action link", () => {
      const { html } = passwordChangedTemplate("2026-01-01", "10:00 AM");
      expect(html).toContain("https://meterly.pages.dev/forgot-password");
    });
  });
});