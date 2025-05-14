import React from 'react';
import { useRouteError } from 'react-router-dom';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ErrorBoundary: React.FC<{ children?: any }> = (props) => {
  const error = useRouteError();

  if (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usableError = (error as any);
    return (
      <div className='flex flex-auto w-full h-full flex-col gap-2'>
        <div className='flex justify-center items-center p-2'>logo</div>
        <div className='flex justify-center items-center'>{usableError}</div>
      </div>
    );
  }

  return props.children;
};

export default ErrorBoundary;
