import React from 'react';

type WindowsLicenseIconProps = {
  className?: string;
  title?: string;
};

/**
 * Four-pane window mark in MaxBit palette (cyan on dark).
 * Uses currentColor so parent can set text-cyan-400 / text-cyan-300.
 */
export const WindowsLicenseIcon: React.FC<WindowsLicenseIconProps> = ({
  className = 'h-9 w-9 text-cyan-400',
  title = 'Windows',
}) => (
  <svg
    className={className}
    viewBox="0 0 88 88"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label={title}
  >
    <title>{title}</title>
    <path fill="currentColor" fillOpacity={0.38} d="M0 0h41v41H0z" />
    <path fill="currentColor" fillOpacity={0.58} d="M47 0h41v41H47z" />
    <path fill="currentColor" fillOpacity={0.78} d="M0 47h41v41H0z" />
    <path fill="currentColor" fillOpacity={1} d="M47 47h41v41H47z" />
  </svg>
);

/** Square thumb wrapper matching cart / checkout add-on tiles. */
export function WindowsLicenseThumb({
  className = '',
  iconClassName = 'h-10 w-10',
}: {
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-2.5 ${className}`}
    >
      <WindowsLicenseIcon className={`text-cyan-400 ${iconClassName}`} />
    </div>
  );
}
