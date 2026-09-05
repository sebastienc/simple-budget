import React from 'react';
import { Label, Radio, RadioGroup } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { THEME_PREFERENCES, useTheme, type ThemePreference } from '@/theme/useTheme';

const option =
  'flex-1 cursor-default rounded-md px-2 py-1 text-center text-xs whitespace-nowrap outline-hidden transition-colors selected:bg-surface-raised selected:font-semibold selected:text-ink selected:shadow-sm focus-visible:ring-2 focus-visible:ring-accent';

/**
 * Three options rather than a dark-mode switch.
 *
 * A boolean could express "light" and "dark" but never "follow the OS": once
 * the switch was touched a value was stored, and the system preference was
 * never consulted again — so an account could not get back to tracking the Mac
 * once it had been set either way.
 *
 * It also sidesteps the labelling problem a toggle has. A switch labelled "Dark
 * mode" leaves the reader working out whether the words describe the current
 * state or what flipping it would do; naming all three states removes the
 * question.
 */
const AppearanceControl: React.FC = () => {
  const { t } = useTranslation();
  const { preference, setPreference } = useTheme();

  return (
    <RadioGroup value={preference} onChange={(value) => setPreference(value as ThemePreference)} className="mx-3 mt-2 flex flex-col gap-1.5">
      <Label className="text-xs font-medium tracking-wide text-ink-2">{t('Appearance')}</Label>
      <div className="flex items-center gap-1 rounded-lg border border-rule p-1">
        {THEME_PREFERENCES.map((value) => (
          <Radio key={value} value={value} className={clsx(option, 'text-ink-3 hover:text-ink')}>
            {t(`Theme${value.charAt(0).toUpperCase()}${value.slice(1)}`)}
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
};

export default AppearanceControl;
