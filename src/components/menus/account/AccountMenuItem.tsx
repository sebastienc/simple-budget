import { MenuItem } from 'react-aria-components';
import type { MenuItemProps } from 'react-aria-components';
import clsx from 'clsx';

/** `className` is merged, not replaced — a destructive entry needs its own styling. */
const AccountMenuItem = ({ className, ...props }: MenuItemProps & { className?: string }) => (
  <MenuItem
    {...props}
    className={clsx('group box-border flex w-full cursor-default items-center rounded-md px-3 py-2 text-sm outline-hidden', className ?? 'text-ink focus:bg-accent-soft focus:text-accent')}
  />
);

export default AccountMenuItem;
