import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, ViewStyle } from 'react-native';
import { X } from 'lucide-react-native';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => onOpenChange(false)}
    >
      {children}
    </Modal>
  );
}

interface DialogContentProps {
  children: React.ReactNode;
  style?: ViewStyle;
  className?: string;
}

export function DialogContent({ children, style }: DialogContentProps) {
  return (
    <View style={styles.overlay}>
      <View style={[styles.content, style]}>
        <ScrollView>
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

interface DialogHeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function DialogHeader({ children, style }: DialogHeaderProps) {
  return <View style={[styles.header, style]}>{children}</View>;
}

interface DialogTitleProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function DialogTitle({ children, style }: DialogTitleProps) {
  return (
    <View style={[styles.titleContainer, style]}>
      <Text style={styles.title}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    maxWidth: 500,
    width: '100%',
    maxHeight: '80%',
  },
  header: {
    marginBottom: 16,
  },
  titleContainer: {
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});
