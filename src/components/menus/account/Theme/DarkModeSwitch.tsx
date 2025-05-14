import { composeRenderProps, Switch } from 'react-aria-components';
import type { SwitchProps } from 'react-aria-components';
import { useTheme } from '@/theme/useTheme';

const DarkModeSwitch = (props: SwitchProps) => {
  const { theme, updateTheme } = useTheme();

  const onChange = (isSelected: boolean) => {
    updateTheme(isSelected ? 'dark' : 'light');
  };

  return (
    <Switch className="group flex items-center gap-2 text-base text-gray-800 transition dark:text-zinc-200" isSelected={theme === 'dark'} onChange={onChange}>
      {composeRenderProps(props.children, (children) => (
        <>
          <div className="flex h-3 w-6 shrink-0 cursor-default items-center rounded-full border border-transparent bg-gray-400 p-[2px] shadow-inner outline-0 outline-offset-2 outline-blue-600 transition duration-200 ease-in-out group-focus-visible:outline-2 group-pressed:bg-gray-500 group-selected:bg-gray-700 group-selected:group-pressed:bg-gray-800 dark:bg-zinc-400 dark:outline-blue-500 dark:group-pressed:bg-zinc-300 group-selected:dark:bg-zinc-300 group-selected:dark:group-pressed:bg-zinc-200 forced-colors:outline-[Highlight] group-selected:forced-colors:bg-[Highlight]!">
            <div className="h-3 w-3 translate-x-0 transform rounded-full bg-white shadow-sm outline-1 -outline-offset-1 outline-transparent transition duration-200 ease-in-out group-selected:translate-x-[100%] dark:bg-zinc-900" />
          </div>
          {children}
        </>
      ))}
    </Switch>
  );
};

export default DarkModeSwitch;
