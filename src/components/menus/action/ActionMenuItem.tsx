import React from 'react';
import { MenuItem, type MenuItemProps } from 'react-aria-components';

const ActionMenuItem: React.FC<MenuItemProps> = (props: MenuItemProps) => {
  return (
    <MenuItem
      {...props}
      className="group box-border flex w-full cursor-default items-center rounded-md px-3 py-2 text-gray-900 outline-hidden focus:bg-slate-500 focus:text-white dark:text-gray-100"
    />
  );
};

export default ActionMenuItem;
