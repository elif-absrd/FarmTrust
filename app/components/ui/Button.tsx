import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'default' | 'outline' | 'destructive';
  size?: 'default' | 'lg' | 'icon';
  disabled?: boolean;
  style?: ViewStyle;
  className?: string;
}

export function Button({ 
  children, 
  onPress, 
  variant = 'default', 
  size = 'default',
  disabled = false,
  style 
}: ButtonProps) {
  const variantStyles = {
    default: styles.default,
    outline: styles.outline,
    destructive: styles.destructive,
  };

  const sizeStyles = {
    default: styles.sizeDefault,
    lg: styles.sizeLg,
    icon: styles.sizeIcon,
  };

  const textVariantStyles = {
    default: styles.textDefault,
    outline: styles.textOutline,
    destructive: styles.textDestructive,
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        variantStyles[variant],
        sizeStyles[size],
        disabled && styles.disabled,
        style,
      ]}
      activeOpacity={0.7}
    >
      {typeof children === 'string' ? (
        <Text style={[styles.text, textVariantStyles[variant]]}>{children}</Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  default: {
    backgroundColor: '#1a73e8',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  destructive: {
    backgroundColor: '#dc2626',
  },
  sizeDefault: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sizeLg: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  sizeIcon: {
    width: 40,
    height: 40,
    padding: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
  textDefault: {
    color: 'white',
  },
  textOutline: {
    color: '#000',
  },
  textDestructive: {
    color: 'white',
  },
});
