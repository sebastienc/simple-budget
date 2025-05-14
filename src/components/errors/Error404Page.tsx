import React from 'react';

const Error404Page: React.FC = () => {
  return (
      <div className='flex flex-auto w-full h-full flex-col gap-2'>
        <div className='flex justify-center items-center p-2'>logo</div>
        <div className='flex justify-center items-center'>Page was not found</div>
      </div>
  )
};

export default Error404Page
