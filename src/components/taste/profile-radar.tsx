"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { TasteProfile } from "@/types";
import { titleCase } from "@/lib/utils";

const DISPLAYED = ["sweet", "sour", "umami", "spicy", "rich", "fresh", "crispy", "creamy"] as const;

export function ProfileRadar({ profile }: { profile: TasteProfile }) {
  const data = DISPLAYED.map((dimension) => ({
    dimension: titleCase(dimension),
    affinity: Math.round(Math.max(0, profile.attributePreferences[dimension]) * 100),
  }));
  return (
    <div className="h-[310px] w-full sm:h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="74%">
          <PolarGrid stroke="#d5d2c8" />
          <PolarAngleAxis dataKey="dimension" tick={{ fill: "#52635b", fontSize: 11, fontWeight: 600 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip formatter={(value) => [`${value} signal`, "Affinity"]} contentStyle={{ borderRadius: 14, borderColor: "#ddd8cc", fontSize: 12 }} />
          <Radar name="Affinity" dataKey="affinity" stroke="#d6533e" fill="#d6533e" fillOpacity={0.28} strokeWidth={2.5} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
