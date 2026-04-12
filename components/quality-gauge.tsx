'use client';

interface QualityGaugeProps {
  value: number;
  label: string;
  size?: number;
  color?: string;
}

export default function QualityGauge({ value, label, size = 120, color }: QualityGaugeProps) {
  const gaugeColor = color || (value >= 90 ? '#198038' : value >= 70 ? '#f1c21b' : '#da1e28');
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e0e0e0" strokeWidth={8} />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={gaugeColor} strokeWidth={8} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-light" style={{ color: gaugeColor }}>{Math.round(value)}</span>
          <span className="text-[10px] text-[#6f6f6f]">/ 100</span>
        </div>
      </div>
      <span className="text-xs text-[#525252] text-center">{label}</span>
    </div>
  );
}
