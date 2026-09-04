import { composeRenderProps, Switch } from 'react-aria-components';
import type { SwitchProps } from 'react-aria-components';
import { useTheme } from '@/theme/useTheme';

const DarkModeSwitch = (props: SwitchProps) => {
  const { theme, updateTheme } = useTheme();

  const onChange = (isSelected: boolean) => {
    updateTheme(isSelected ? 'dark' : 'light');
  };

  return (
    <Switch className="group flex cursor-default items-center gap-2 text-sm text-ink transition" isSelected={theme === 'dark'} onChange={onChange}>
      {composeRenderProps(props.children, (children) => (
        <>
          <div className="flex h-3.5 w-7 shrink-0 cursor-default items-center rounded-full border border-transparent bg-rule-strong p-[2px] outline-0 outline-offset-2 outline-accent transition duration-200 ease-in-out group-focus-visible:outline-2 group-selected:bg-accent forced-colors:outline-[Highlight] group-selected:forced-colors:bg-[Highlight]!">
            <div className="h-2.5 w-2.5 translate-x-0 transform rounded-full bg-surface-raised shadow-sm transition duration-200 ease-in-out group-selected:translate-x-[140%]" />
          </div>
          {children}
        </>
      ))}
    </Switch>
  );
};

export default DarkModeSwitch;
