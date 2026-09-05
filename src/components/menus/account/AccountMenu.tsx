import { useRef } from 'react';
import { Button, Menu, MenuTrigger, Popover, Separator, type Key } from 'react-aria-components';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import AccountMenuItem from './AccountMenuItem';
import DarkModeSwitch from './Theme/DarkModeSwitch';
import LanguageSelector from './LanguageSelection/LanguageSelector';
import { useBackup } from '@/data/useBackup';
import { useToaster } from '@/toast/useToaster';

const AccountMenu = () => {
  const { t } = useTranslation();
  const { exportBackup, importBackup, wipeAllData } = useBackup();
  const { addToast } = useToaster();
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleWipe = async () => {
    if (!window.confirm(t('WipeConfirm'))) {
      return;
    }
    const result = await wipeAllData();
    if (!result.ok) {
      addToast(t('WipeFailed'));
      return;
    }
    // Reloading rather than refetching: every hook in the tree is holding data
    // that no longer exists.
    window.alert(`${t('WipeDone')}\n\n${t('WipeBackupSavedTo', { path: result.backupPath })}`);
    window.location.reload();
  };

  const handleAction = (key: Key) => {
    if (key === 'export') {
      exportBackup();
    } else if (key === 'import') {
      importInputRef.current?.click();
    } else if (key === 'wipe') {
      handleWipe();
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (!window.confirm(t('ImportBackupConfirm'))) {
      return;
    }
    const result = await importBackup(file);
    if (result.ok) {
      window.location.reload();
    } else {
      addToast(t('ImportBackupFailed'));
    }
  };

  return (
    <div className="inline-flex flex-none items-center">
      <input ref={importInputRef} type="file" accept=".db" className="hidden" onChange={handleFileSelected} />
      <MenuTrigger>
        <Button
          id="account-menu-trigger"
          aria-label={t('Settings')}
          className="inline-flex cursor-default items-center justify-center rounded-md border-none bg-transparent p-1.5 text-ink-2 outline-hidden transition-colors hover:bg-accent-soft hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Cog6ToothIcon className="h-5 w-5" />
        </Button>
        <Popover className="origin-top-right overflow-auto rounded-lg border border-rule bg-surface-raised p-2 shadow-lg outline-hidden fill-mode-forwards entering:animate-in entering:fade-in entering:placement-top:slide-in-from-bottom-1 entering:placement-bottom:slide-in-from-top-1 exiting:animate-out exiting:fade-out exiting:placement-top:slide-out-to-bottom-1 exiting:placement-bottom:slide-out-to-top-1">
          <div className="mx-3 mt-2 flex flex-col gap-1">
            <DarkModeSwitch>{t('DarkMode')}</DarkModeSwitch>
          </div>
          <Separator className="mx-3 mt-4 mb-2 h-px border-none bg-rule" />
          <LanguageSelector />
          <Separator className="mx-3 mt-4 mb-2 h-px border-none bg-rule" />
          <Menu className="outline-hidden" onAction={handleAction}>
            <AccountMenuItem id="export">{t('ExportBackup')}</AccountMenuItem>
            <AccountMenuItem id="import">{t('ImportBackup')}</AccountMenuItem>
          </Menu>
          <Separator className="mx-3 mt-4 mb-2 h-px border-none bg-rule" />
          <Menu className="outline-hidden" onAction={handleAction}>
            <AccountMenuItem id="wipe" className="text-danger focus:bg-danger focus:text-surface">
              {t('WipeAllData')}
            </AccountMenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    </div>
  );
};

export default AccountMenu;
