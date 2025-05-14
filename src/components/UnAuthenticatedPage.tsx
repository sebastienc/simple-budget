import React from 'react';


export interface UnAuthenticatedPageProps {
  children: React.ReactNode | React.ReactNode[];
}

const UnAuthenticatedPage: React.FC<UnAuthenticatedPageProps> = ({ children }) => {
  return (
    <div className='flex h-screen flex-col items-center justify-center'>
      {children}
    </div>
  )
};

export default UnAuthenticatedPage
