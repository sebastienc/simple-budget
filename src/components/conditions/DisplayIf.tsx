import React from 'react';

type DisplayIfProps = {
  condition: boolean;
  children?: React.ReactNode | React.ReactNode[];
  falsy?: React.ReactNode | React.ReactNode[];
};

const DisplayIf: React.FC<DisplayIfProps> = ({ condition, children, falsy }) => {
  return condition ? <>{children}</> : <>{falsy}</>;
};

export default DisplayIf;
