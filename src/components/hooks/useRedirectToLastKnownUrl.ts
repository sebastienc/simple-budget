export const useRedirectToLastKnownUrl = () => {
  const storageKey = 'simple_budget_lastKnownUrl';

  const getLastKnownUrl = () => {
    return localStorage.getItem(storageKey);
  };

  const setLastKnownUrl = (path: string) => {
    localStorage.setItem(storageKey, path);
  };

  const clearLastKnownUrl = () => {
    localStorage.removeItem(storageKey);
  };

  return { getLastKnownUrl, setLastKnownUrl, clearLastKnownUrl };
};
