import React from "react";

type IsHiddenWhenProps = {
  condition: boolean;
  children?: React.ReactNode | React.ReactNode[];
};

const IsHiddenWhen: React.FC<IsHiddenWhenProps> = ({ condition, children }) => {
  return condition ? <></> : <>{children}</>;
};

export default IsHiddenWhen;
