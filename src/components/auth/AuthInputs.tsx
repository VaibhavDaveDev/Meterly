import React from 'react';

export function EmailInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor="email" className="block font-label-caps text-label-caps text-on-surface-variant mb-1">Email Address</label>
      <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-outline" data-icon="mail">mail</span>
          </div>
          <input
              id="email"
              name="email" 
              type="email"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="jane@example.com"
              required
              disabled={disabled}
              className="block w-full pl-10 pr-3 py-3 border border-outline-variant rounded-lg bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-primary font-body-md text-body-md placeholder-outline-variant transition-shadow disabled:opacity-50"
          />
      </div>
    </div>
  );
}

export function TextInput({
  id,
  label,
  value,
  onChange,
  disabled,
  placeholder,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-label-caps text-label-caps text-on-surface-variant mb-1">{label}</label>
      <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-outline" data-icon="person_outline">person_outline</span>
          </div>
          <input
              id={id}
              name={id}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              required={required}
              disabled={disabled}
              className="block w-full pl-10 pr-3 py-3 border border-outline-variant rounded-lg bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-primary font-body-md text-body-md placeholder-outline-variant transition-shadow disabled:opacity-50"
          />
      </div>
    </div>
  );
}

export function PasswordInput({
  id = 'password',
  label = 'Password',
  value,
  onChange,
  disabled,
  showPassword,
  setShowPassword,
  placeholder = '••••••••',
  hint,
  rightLabel,
  minLength,
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  placeholder?: string;
  hint?: React.ReactNode;
  rightLabel?: React.ReactNode;
  minLength?: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label htmlFor={id} className="block font-label-caps text-label-caps text-on-surface-variant">{label}</label>
        {rightLabel}
      </div>
      <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-outline" data-icon="lock">lock</span>
          </div>
          <input
              id={id}
              name={id}
              type={showPassword ? 'text' : 'password'}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              required
              minLength={minLength}
              disabled={disabled}
              className="block w-full pl-10 pr-12 py-3 border border-outline-variant rounded-lg bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-primary font-body-md text-body-md placeholder-outline-variant transition-shadow disabled:opacity-50"
          />
          <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors duration-200 p-1"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
              <span className="material-symbols-outlined text-[20px]">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
          </button>
      </div>
      {hint && (
        <div className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
          {hint}
        </div>
      )}
    </div>
  );
}
