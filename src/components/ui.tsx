import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, shadow } from '../theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'dark' | 'success' | 'ghost';

const buttonColors: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.gold, fg: colors.ink, border: colors.gold },
  secondary: { bg: colors.card, fg: colors.text, border: colors.border },
  danger: { bg: colors.danger, fg: '#FFFFFF', border: colors.danger },
  dark: { bg: colors.ink, fg: colors.onDark, border: colors.ink },
  success: { bg: colors.free, fg: '#FFFFFF', border: colors.free },
  ghost: { bg: 'transparent', fg: colors.goldDeep, border: 'transparent' },
};

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  small?: boolean;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, onPress, variant = 'primary', icon, disabled, small, large, style }: ButtonProps) {
  const c = buttonColors[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        large && styles.btnLarge,
        { backgroundColor: c.bg, borderColor: c.border, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        pressed && !disabled ? styles.pressedScale : null,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={small ? 16 : large ? 22 : 19} color={c.fg} /> : null}
      <Text
        style={[styles.btnText, small && styles.btnTextSmall, large && styles.btnTextLarge, { color: c.fg }]}
        numberOfLines={1}
      >
        {title}
      </Text>
    </Pressable>
  );
}

interface IconButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({ icon, label, onPress, color = colors.text, size = 22, disabled, style }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      style={({ pressed }) => [styles.iconBtn, { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }, style]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Titre de section : petites capitales dorées avec un filet. */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionTitle}>{children}</Text>
      <View style={styles.sectionRule} />
    </View>
  );
}

/** Texte en Playfair Display (titres). */
export function Display({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.display, style]}>{children}</Text>;
}

interface FieldProps extends TextInputProps {
  label: string;
  hint?: string;
}

export function Field({ label, hint, style, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor="#A99E90"
        accessibilityLabel={label}
        {...props}
        style={[styles.input, props.multiline && styles.inputMultiline, style]}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

interface SwitchRowProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}

export function SwitchRow({ label, value, onChange, hint }: SwitchRowProps) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.flex1}>
        <Text style={styles.switchLabel}>{label}</Text>
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.gold, false: colors.border }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
}

export function Segmented<T extends string>({ options, value, onChange, style, dark }: SegmentedProps<T>) {
  return (
    <View style={[styles.segmented, dark && styles.segmentedDark, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && (dark ? styles.segmentActiveDark : styles.segmentActive)]}
          >
            <Text
              style={[
                styles.segmentText,
                dark && styles.segmentTextDark,
                selected && (dark ? styles.segmentTextActiveDark : styles.segmentTextActive),
              ]}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface ChipProps {
  label: string;
  selected?: boolean;
  color?: string;
  onPress: () => void;
  icon?: IconName;
}

export function Chip({ label, selected, color = colors.ink, onPress, icon }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? color : colors.border, backgroundColor: selected ? color : colors.card },
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? '#FFFFFF' : color} /> : null}
      <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, color, soft }: { label: string; color: string; soft: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: soft }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  label: string;
}

export function Stepper({ value, onChange, min = 0, label }: StepperProps) {
  return (
    <View style={styles.stepper}>
      <IconButton
        icon="remove-circle-outline"
        label={`Diminuer ${label}`}
        onPress={() => onChange(value - 1)}
        disabled={value <= min}
        size={30}
        color={colors.ink}
      />
      <Text style={styles.stepperValue} accessibilityLabel={`${label} : ${value}`}>
        {value}
      </Text>
      <IconButton icon="add-circle" label={`Augmenter ${label}`} onPress={() => onChange(value + 1)} size={30} color={colors.goldDeep} />
    </View>
  );
}

interface EmptyProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function Empty({ icon, title, subtitle, children }: EmptyProps) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={34} color={colors.goldDeep} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

type NoticeTone = 'info' | 'warning' | 'danger' | 'success';

const noticeTones: Record<NoticeTone, { bg: string; fg: string; icon: IconName }> = {
  info: { bg: colors.goldSoft, fg: colors.goldDeep, icon: 'information-circle' },
  warning: { bg: colors.readySoft, fg: colors.ready, icon: 'alarm' },
  danger: { bg: colors.dangerSoft, fg: colors.danger, icon: 'alert-circle' },
  success: { bg: colors.freeSoft, fg: colors.free, icon: 'checkmark-circle' },
};

export function Notice({ tone = 'info', title, children }: { tone?: NoticeTone; title?: string; children?: React.ReactNode }) {
  const t = noticeTones[tone];
  return (
    <View style={[styles.notice, { backgroundColor: t.bg }]}>
      <Ionicons name={t.icon} size={20} color={t.fg} />
      <View style={styles.flex1}>
        {title ? <Text style={[styles.noticeTitle, { color: t.fg }]}>{title}</Text> : null}
        {typeof children === 'string' ? <Text style={styles.noticeText}>{children}</Text> : children}
      </View>
    </View>
  );
}

interface FormModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSave?: () => void;
  saveLabel?: string;
  onDelete?: () => void;
  children: React.ReactNode;
}

export function FormModal({ visible, title, onClose, onSave, saveLabel = 'Enregistrer', onDelete, children }: FormModalProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalGrip} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <IconButton icon="close" label="Fermer" onPress={onClose} color={colors.muted} size={26} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalBody}>
            {children}
          </ScrollView>
          {onSave || onDelete ? (
            <View style={styles.modalActions}>
              {onDelete ? (
                <Button title="Supprimer" variant="danger" icon="trash-outline" onPress={onDelete} style={styles.flex1} />
              ) : null}
              {onSave ? <Button title={saveLabel} icon="checkmark" onPress={onSave} style={styles.flex2} /> : null}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
}

export function ListRow({ title, subtitle, icon, iconColor = colors.ink, right, onPress, chevron }: ListRowProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? styles.rowPressed : null]}
    >
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: iconColor + '1F' }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
      ) : null}
      <View style={styles.flex1}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
      {chevron ? <Ionicons name="chevron-forward" size={20} color={colors.gold} /> : null}
    </Pressable>
  );
}

export function Group({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.group, style]}>{children}</View>;
}

interface PinPadProps {
  title: string;
  subtitle?: string;
  /** Retourne un message d'erreur, ou null si le code est accepté. */
  onSubmit: (code: string) => string | null;
  minLength?: number;
  maxLength?: number;
  submitLabel?: string;
  dark?: boolean;
}

/** Pavé numérique pour saisir un code (gérant, admin). */
export function PinPad({ title, subtitle, onSubmit, minLength = 4, maxLength = 8, submitLabel = 'Valider', dark = true }: PinPadProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const press = (k: string) => {
    setError(null);
    if (k === 'del') setCode((c) => c.slice(0, -1));
    else setCode((c) => (c.length < maxLength ? c + k : c));
  };
  const submit = () => {
    if (code.length < minLength) {
      setError(`Le code contient au moins ${minLength} chiffres.`);
      return;
    }
    const err = onSubmit(code);
    if (err) {
      setError(err);
      setCode('');
    }
  };
  const fg = dark ? colors.onDark : colors.text;
  return (
    <View style={styles.pin}>
      <Text style={[styles.pinTitle, { color: fg }]}>{title}</Text>
      {subtitle ? <Text style={[styles.pinSubtitle, { color: dark ? colors.onDarkMuted : colors.muted }]}>{subtitle}</Text> : null}
      <View style={styles.pinDots} accessibilityLabel={`${code.length} chiffres saisis`}>
        {Array.from({ length: Math.max(minLength, code.length) }, (_, i) => (
          <View key={i} style={[styles.pinDot, { borderColor: colors.gold }, i < code.length && { backgroundColor: colors.gold }]} />
        ))}
      </View>
      <Text style={styles.pinError}>{error ?? ' '}</Text>
      <View style={styles.pinGrid}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityLabel={k === 'del' ? 'Effacer' : k === 'ok' ? submitLabel : k}
            onPress={() => (k === 'ok' ? submit() : press(k))}
            style={({ pressed }) => [
              styles.pinKey,
              dark ? styles.pinKeyDark : styles.pinKeyLight,
              k === 'ok' && styles.pinKeyOk,
              pressed && styles.pinKeyPressed,
            ]}
          >
            {k === 'del' ? (
              <Ionicons name="backspace-outline" size={26} color={fg} />
            ) : k === 'ok' ? (
              <Ionicons name="checkmark" size={30} color={colors.ink} />
            ) : (
              <Text style={[styles.pinKeyText, { color: fg }]}>{k}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Confirmation avant une action destructive (fonctionne aussi sur le web). */
export function confirm(title: string, message: string, onConfirm: () => void, confirmLabel = 'Confirmer') {
  if (Platform.OS === 'web') {
    const w = globalThis as { confirm?: (msg: string) => boolean };
    if (w.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Annuler', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

export function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    const w = globalThis as { alert?: (msg: string) => void };
    w.alert?.(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export const styles = StyleSheet.create({
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  pressedScale: { transform: [{ scale: 0.98 }] },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
  },
  btnSmall: { minHeight: 38, paddingHorizontal: 12, borderRadius: 11 },
  btnLarge: { minHeight: 58, borderRadius: 16 },
  btnText: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  btnTextSmall: { fontSize: 14 },
  btnTextLarge: { fontSize: 18 },
  iconBtn: { padding: 4, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  sectionWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 10 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.goldDeep,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  sectionRule: { flex: 1, height: 1, backgroundColor: colors.border },
  display: { fontFamily: fonts.display, fontVariant: ['lining-nums'], color: colors.text, fontSize: 24 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  fieldHint: { fontSize: 12, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 9,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#FFFFFF',
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#E9DFCC',
    borderRadius: 14,
    padding: 4,
  },
  segmentedDark: { backgroundColor: colors.ink2 },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.card, ...shadow },
  segmentActiveDark: { backgroundColor: colors.gold },
  segmentText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  segmentTextDark: { color: colors.onDarkMuted },
  segmentTextActive: { color: colors.text },
  segmentTextActiveDark: { color: colors.ink },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: '700' },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '800' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepperValue: { minWidth: 30, textAlign: 'center', fontSize: 19, fontWeight: '800', color: colors.text },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 20, color: colors.text, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: colors.muted, textAlign: 'center', maxWidth: 320 },
  notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, alignItems: 'flex-start' },
  noticeTitle: { fontWeight: '800', fontSize: 15, marginBottom: 2 },
  noticeText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(22,18,15,0.55)' },
  modalSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 8,
    maxHeight: '92%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  modalGrip: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  modalTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 24, color: colors.text, flexShrink: 1 },
  modalBody: { gap: 14, paddingBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 10, paddingTop: 10 },
  group: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.goldSoft },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  rowSubtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  pin: { alignItems: 'center', gap: 10, paddingVertical: 8, width: '100%', maxWidth: 360, alignSelf: 'center' },
  pinTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 26, textAlign: 'center' },
  pinSubtitle: { fontSize: 14, textAlign: 'center' },
  pinDots: { flexDirection: 'row', gap: 14, marginTop: 10, minHeight: 18 },
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  pinError: { color: '#E8857C', fontWeight: '700', minHeight: 20, textAlign: 'center' },
  pinGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, width: 300 },
  pinKey: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  pinKeyDark: { backgroundColor: colors.ink2, borderColor: colors.ink3 },
  pinKeyLight: { backgroundColor: colors.card, borderColor: colors.border },
  pinKeyOk: { backgroundColor: colors.gold, borderColor: colors.gold },
  pinKeyPressed: { opacity: 0.6, transform: [{ scale: 0.95 }] },
  pinKeyText: { fontSize: 30, fontWeight: '500' },
});
