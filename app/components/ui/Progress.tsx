import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface ProgressProps {
  value: number;
  style?: ViewStyle;
  className?: string;
}

export function Progress({ value, style }: ProgressProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.progress, { width: `${Math.min(100, Math.max(0, value))}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    backgroundColor: '#1a73e8',
    borderRadius: 4,
  },
});
