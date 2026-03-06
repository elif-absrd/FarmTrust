import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, Platform } from 'react-native';

interface TableProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Table({ children, style }: TableProps) {
  return <View style={[styles.table, style]}>{children}</View>;
}

interface TableHeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function TableHeader({ children, style }: TableHeaderProps) {
  return <View style={[styles.header, style]}>{children}</View>;
}

interface TableBodyProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function TableBody({ children, style }: TableBodyProps) {
  return <View style={[styles.body, style]}>{children}</View>;
}

interface TableRowProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function TableRow({ children, style }: TableRowProps) {
  return <View style={[styles.row, style]}>{children}</View>;
}

interface TableHeadProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function TableHead({ children, style }: TableHeadProps) {
  return (
    <View style={[styles.cell, styles.headCell, style]}>
      <Text style={styles.headText}>{children}</Text>
    </View>
  );
}

interface TableCellProps {
  children: React.ReactNode;
  style?: ViewStyle;
  className?: string;
}

export function TableCell({ children, style, className }: TableCellProps) {
  const isMono = className?.includes('font-mono');
  
  return (
    <View style={[styles.cell, style]}>
      {typeof children === 'string' ? (
        <Text style={[styles.cellText, isMono && styles.monoText]}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    width: '100%',
  },
  header: {
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  body: {
    // Body styles
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    minHeight: 44,
    alignItems: 'center',
  },
  cell: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  headCell: {
    paddingVertical: 12,
  },
  headText: {
    fontWeight: '600',
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
  },
  cellText: {
    fontSize: 14,
    color: '#000',
  },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
