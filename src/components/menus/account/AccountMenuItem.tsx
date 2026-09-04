import { MenuItem } from 'react-aria-components';
import type { MenuItemProps } from 'react-aria-components';

const AccountMenuItem = (props: MenuItemProps) => (
  <MenuItem {...props} className="group box-border flex w-full cursor-default items-center rounded-md px-3 py-2 text-sm text-ink outline-hidden focus:bg-accent-soft focus:text-accent" />
);

export default AccountMenuItem;
