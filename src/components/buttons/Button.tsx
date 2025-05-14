import React from 'react';

export interface ButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  children?: React.ReactNode | React.ReactNode[];
  className?: string;
  loading?: boolean;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
}

const Button: React.FC<ButtonProps> = ({ children, onClick, className, loading, disabled, title, ariaLabel }) => {
  const handleOnClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    if (onClick) {
      onClick(e);
    }
  };

  const baseClasses = 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded inline-flex items-center'
  
  return (
    <button
      aria-label={ariaLabel}
      title={title}
      className={className ? className : baseClasses}
      onClick={handleOnClick}
      disabled={disabled || loading}
    >
      {children}
    </button>
  );
};

export default Button;
