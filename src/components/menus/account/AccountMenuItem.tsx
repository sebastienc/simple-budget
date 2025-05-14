import { MenuItem } from 'react-aria-components';
import type { MenuItemProps } from 'react-aria-components';

const AccountMenuItem = (props: MenuItemProps) => {
  return (
    <MenuItem {...props} className="group box-border flex w-full cursor-default items-center rounded-md px-3 py-2 text-gray-900 outline-hidden focus:bg-blue-500 focus:text-white dark:text-gray-100" />
  );
};

export default AccountMenuItem;
