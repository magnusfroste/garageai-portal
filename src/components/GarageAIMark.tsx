import { useId } from "react";

export const GarageAIMark = () => {
  const gradientId = `garageai-g-${useId()}`;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="28" height="28" className="shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00d4ff" />
          <stop offset="1" stopColor="#00c37a" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />
      <path d="M7 18 16 10l9 8" fill="none" stroke="#06121a" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="22" r="2.6" fill="#06121a" />
    </svg>
  );
};