import React from 'react';
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'ghost' | 'link' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends AriaButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Additive only — spacing, width, alignment. Utilities that would fight a
   * variant's own fill or text colour won't reliably win (same specificity,
   * stylesheet order decides). Needs a different look? Add a variant.
   */
  className?: string;
}

const base =
  'inline-flex cursor-default items-center justify-center gap-1.5 rounded-md outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-accent';

/*
 * `text-surface` on a filled button is intentional: because the palette flips
 * with the theme, it resolves to near-white on the dark teal/red of light mode
 * and to near-black on the lighter teal/red of dark mode. One class, correct
 * contrast in both.
 */
const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-surface hover:opacity-90 pressed:opacity-80',
  ghost: 'border border-rule-strong bg-transparent text-ink hover:bg-accent-soft',
  link: 'text-accent hover:underline',
  danger: 'bg-danger text-surface hover:opacity-90 pressed:opacity-80',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
};

const linkSizes: Record<ButtonSize, string> = {
  sm: 'px-1 py-0.5 text-sm',
  md: 'px-2 py-1 text-sm',
};

const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'md', className, ...props }) => (
  <AriaButton {...props} className={clsx(base, variants[variant], variant === 'link' ? linkSizes[size] : sizes[size], className)} />
);

export default Button;
