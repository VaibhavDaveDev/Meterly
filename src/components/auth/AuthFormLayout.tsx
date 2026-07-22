import React from 'react';

interface SocialProvider {
  id: 'google' | 'github';
  label: string;
  icon: React.ReactNode;
  onClick: () => Promise<void> | void;
}

interface AuthFormLayoutProps {
  title: string;
  description: string;
  backToLink?: { href: string; label: string };
  message?: string;
  isError?: boolean;
  isLoading?: boolean;
  socialProviders?: SocialProvider[];
  footerLink?: { href: string; text: string; linkText: string };
  children: React.ReactNode;
}

export function AuthFormLayout({
  title,
  description,
  backToLink,
  message,
  isError = false,
  isLoading = false,
  socialProviders,
  footerLink,
  children,
}: AuthFormLayoutProps) {
  return (
    <div className="flex flex-col w-full">
      {/* Header */}
      <div className="mb-stack-md">
        {backToLink && (
          <a
            href={backToLink.href}
            className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors duration-200 ease-smooth mb-4 w-max"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            {backToLink.label}
          </a>
        )}
        <h2 className="font-headline-lg text-headline-lg md:text-headline-lg text-on-background mb-2">
          {title}
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant m-0">
          {description}
        </p>
      </div>

      {/* Message banner */}
      {message && (
        <div 
          className={`px-4 py-3 mb-6 rounded-lg border text-sm font-body-sm shadow-sm ${
            isError 
              ? 'border-error-container bg-error-container text-on-error-container' 
              : 'border-secondary-container bg-secondary-container text-on-secondary-container'
          }`}
          role="alert" 
          aria-live="polite"
        >
          {message}
        </div>
      )}

      {/* Form content */}
      <div className="flex flex-col gap-6">
        
        {/* Social SSO */}
        {socialProviders && socialProviders.length > 0 && (
          <>
            <div className="flex flex-col gap-3">
              {socialProviders.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={provider.onClick}
                  disabled={isLoading}
                  className="w-full flex justify-center items-center gap-3 py-3 px-4 border border-outline-variant rounded-lg bg-surface text-on-surface font-label-caps text-label-caps hover:bg-surface-container-low transition-all duration-200"
                  aria-label={provider.label}
                >
                  {provider.icon}
                  {provider.label}
                </button>
              ))}
            </div>
            <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-outline-variant"></div>
                <span className="flex-shrink mx-4 font-label-caps text-label-caps text-outline-variant">or</span>
                <div className="flex-grow border-t border-outline-variant"></div>
            </div>
          </>
        )}

        {children}
      </div>

      {/* Footer link */}
      {footerLink && (
        <div className="mt-stack-md text-center">
          <p className="font-body-md text-body-md text-on-surface-variant m-0">
            {footerLink.text}{' '}
            <a
              href={footerLink.href}
              className="font-semibold text-primary hover:text-primary-container transition-colors underline underline-offset-4 decoration-primary/30 hover:decoration-primary"
            >
              {footerLink.linkText}
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
