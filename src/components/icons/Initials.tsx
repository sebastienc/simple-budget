import React from 'react';

interface InitialsProps {
  initials: string;
  size?: number;
  className?: string;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  fontFamily?: string;
  fontWeight?: string | number;
}

const Initials: React.FC<InitialsProps> = ({
  initials,
  size = 40,
  className = '',
  textColor = 'black',
  backgroundColor = 'white',
  borderColor = 'black',
  borderWidth = 2,
  fontFamily = 'sans-serif',
  fontWeight = 'bold',
}) => {
  const viewBoxSize = 100;
  const scaledBorderWidth = (borderWidth / size) * viewBoxSize;
  const radius = viewBoxSize / 2 - scaledBorderWidth / 2;

  const cx = viewBoxSize / 2;
  const cy = viewBoxSize / 2;

  const displayText = initials.toUpperCase();
  const numChars = displayText.length;

  let calculatedFontSize;
  if (numChars === 0) {
    calculatedFontSize = 0; // No text if initials are empty
  } else if (numChars === 1) {
    calculatedFontSize = viewBoxSize * 0.5; // e.g., 50 for viewBoxSize 100
  } else if (numChars === 2) {
    calculatedFontSize = viewBoxSize * 0.4; // e.g., 40
  } else if (numChars === 3) {
    calculatedFontSize = viewBoxSize * 0.3; // e.g., 30
  } else {
    // For 4+ characters, scale down to fit approximately.
    // (viewBoxSize * 0.8) aims to leave ~20% horizontal padding for the text block.
    calculatedFontSize = (viewBoxSize * 0.8) / numChars;
  }

  // Prevent rendering text if initials are empty or font size is zero
  const showText = displayText && calculatedFontSize > 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label={displayText ? `Initials: ${displayText}` : 'User avatar placeholder'}
    >
      <circle cx={cx} cy={cy} r={radius} fill={backgroundColor} stroke={borderColor} strokeWidth={scaledBorderWidth} />
      {showText && (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill={textColor} fontSize={calculatedFontSize} fontFamily={fontFamily} fontWeight={fontWeight}>
          {displayText}
        </text>
      )}
    </svg>
  );
};

export default Initials;
