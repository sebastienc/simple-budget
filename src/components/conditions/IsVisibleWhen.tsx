import React from "react";

type IsVisibleWhenProps = {
  condition: boolean;
  children?: React.ReactNode | React.ReactNode[];
};

const IsVisibleWhen: React.FC<IsVisibleWhenProps> = ({ condition, children }) => {
  return condition ? <>{children}</> : <></>;
};

export default IsVisibleWhen;
