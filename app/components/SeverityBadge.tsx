import React from 'react';
import { Badge } from './ui/Badge';

const severityStyles = {
  Low: { backgroundColor: '#22c55e', color: 'white' },
  Medium: { backgroundColor: '#f59e0b', color: 'white' },
  High: { backgroundColor: '#ef4444', color: 'white' },
};

interface SeverityBadgeProps {
  level: 'Low' | 'Medium' | 'High';
}

export function SeverityBadge({ level }: SeverityBadgeProps) {
  const style = severityStyles[level];
  
  return (
    <Badge 
      style={{ backgroundColor: style.backgroundColor }}
      textStyle={{ color: style.color }}
    >
      {level}
    </Badge>
  );
}
