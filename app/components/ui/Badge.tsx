import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

type BadgeStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SURVEYED_PENDING' | 'PAID' | 'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Surveyed Pending' | 'Paid';

interface BadgeProps {
  children?: React.ReactNode;
  status?: BadgeStatus;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const statusStyles: Record<BadgeStatus, { bg: string; text: string }> = {
  PENDING: { bg: '#fef3c7', text: '#92400e' },
  'Pending': { bg: '#fef3c7', text: '#92400e' },
  UNDER_REVIEW: { bg: '#bfdbfe', text: '#1e40af' },
  'Under Review': { bg: '#bfdbfe', text: '#1e40af' },
  APPROVED: { bg: '#dcfce7', text: '#166534' },
  'Approved': { bg: '#dcfce7', text: '#166534' },
  REJECTED: { bg: '#fee2e2', text: '#991b1b' },
  'Rejected': { bg: '#fee2e2', text: '#991b1b' },
  SURVEYED_PENDING: { bg: '#fce7f3', text: '#831843' },
  'Surveyed Pending': { bg: '#fce7f3', text: '#831843' },
  PAID: { bg: '#d1fae5', text: '#065f46' },
  'Paid': { bg: '#d1fae5', text: '#065f46' },
};

const isBadgeStatus = (value: string): value is BadgeStatus => value in statusStyles;

export function Badge({ children, status, style, textStyle }: BadgeProps) {
  const statusToShow = status ?? (typeof children === 'string' ? children : undefined);
  const colors =
    statusToShow && isBadgeStatus(statusToShow)
      ? statusStyles[statusToShow]
      : { bg: '#e0e0e0', text: '#000' };

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.text, { color: colors.text }, textStyle]}>
        {children ?? statusToShow}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
