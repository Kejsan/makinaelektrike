import React, { useId } from 'react';
import { Info } from 'lucide-react';

interface DashboardInfoTooltipProps {
  label: string;
  className?: string;
  side?: 'left' | 'right';
}

const DashboardInfoTooltip: React.FC<DashboardInfoTooltipProps> = ({
  label,
  className = '',
  side = 'right',
}) => {
  const tooltipId = useId();
  const alignmentClass = side === 'left' ? 'right-0' : 'left-0';

  return (
    <span className={`group relative inline-flex shrink-0 items-center ${className}`}>
      <button
        type="button"
        aria-describedby={tooltipId}
        aria-label={label}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-white/5 text-gray-400 transition hover:border-gray-cyan/50 hover:bg-gray-cyan/10 hover:text-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan/60"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute ${alignmentClass} top-full z-[90] mt-2 hidden w-72 rounded-xl border border-white/10 bg-gray-950/95 px-3 py-2 text-left text-xs font-medium leading-5 text-gray-100 shadow-2xl shadow-black/40 backdrop-blur-xl group-hover:block group-focus-within:block`}
      >
        {label}
      </span>
    </span>
  );
};

export default DashboardInfoTooltip;
