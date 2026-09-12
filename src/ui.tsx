import React from 'react';
import {
  Pressable, StyleProp, StyleSheet, Text, View, ViewStyle,
} from 'react-native';
import { initials, palette, Person, statusMeta } from './model';

export function Panel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function SectionHeading({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Avatar({ person, size = 48 }: { person: Person; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: person.avatarColor }]}> 
      <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>{initials(person.name)}</Text>
    </View>
  );
}

export function StatusPill({ person }: { person: Person }) {
  const meta = statusMeta[person.status];
  return (
    <View style={[styles.pill, { backgroundColor: meta.bg }]}> 
      <View style={[styles.dot, { backgroundColor: meta.fg }]} />
      <Text style={[styles.pillText, { color: meta.fg }]}>{meta.label}</Text>
    </View>
  );
}

export function ProgressBar({ value, color = palette.green, height = 9 }: { value: number; color?: string; height?: number }) {
  const safe = Math.max(0, Math.min(100, value));
  const width = `${safe}%` as `${number}%`;
  return (
    <View style={[styles.progressTrack, { height, borderRadius: height / 2 }]}> 
      <View style={{ width, height: '100%', borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

export function SoftButton({
  label, onPress, tone = 'blue', compact = false, disabled = false,
}: {
  label: string; onPress(): void; tone?: 'blue' | 'green' | 'amber' | 'coral' | 'neutral'; compact?: boolean; disabled?: boolean;
}) {
  const tones = {
    blue: [palette.blueSoft, '#266FB6'], green: [palette.greenSoft, '#167A4B'], amber: [palette.amberSoft, '#9B6518'],
    coral: [palette.coralSoft, '#B94A52'], neutral: ['#EEF1F4', palette.ink],
  } as const;
  const [bg, fg] = tones[tone];
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.softButton, compact && styles.softButtonCompact, { backgroundColor: bg, opacity: disabled ? 0.45 : 1 }]}> 
      <Text style={[styles.softButtonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress(): void; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.primaryButton, disabled && { opacity: 0.4 }]}> 
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function CheckCircle({ checked, size = 26 }: { checked: boolean; size?: number }) {
  return (
    <View style={[
      styles.checkCircle,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: checked ? palette.green : '#FFFFFF', borderColor: checked ? palette.green : '#CBD5E1' },
    ]}>
      {checked ? <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: size * 0.58 }}>✓</Text> : null}
    </View>
  );
}

export function AppNav({ screen, onOverview, onUpdate, onPeople }: { screen: 'overview' | 'update'; onOverview(): void; onUpdate(): void; onPeople(): void }) {
  return (
    <View style={styles.nav}>
      <NavItem label="Overview" icon="⌂" active={screen === 'overview'} onPress={onOverview} />
      <NavItem label="Update" icon="✎" active={screen === 'update'} onPress={onUpdate} />
      <NavItem label="People" icon="☺" active={false} onPress={onPeople} />
    </View>
  );
}

function NavItem({ label, icon, active, onPress }: { label: string; icon: string; active: boolean; onPress(): void }) {
  return (
    <Pressable onPress={onPress} style={[styles.navItem, active && styles.navItemActive]}>
      <Text style={[styles.navIcon, active && { color: '#266FB6' }]}>{icon}</Text>
      <Text style={[styles.navLabel, active && { color: '#266FB6', fontWeight: '800' }]}>{label}</Text>
    </Pressable>
  );
}

export const commonStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.bg },
  scrollContent: { padding: 18, paddingBottom: 110, width: '100%', maxWidth: 1500, alignSelf: 'center' },
  title: { color: palette.ink, fontSize: 30, fontWeight: '900', letterSpacing: -0.7 },
  subtitle: { color: palette.muted, fontSize: 15, marginTop: 4, lineHeight: 21 },
  label: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  body: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center' },
});

const styles = StyleSheet.create({
  panel: {
    backgroundColor: palette.surface, borderRadius: 24, borderWidth: 1, borderColor: palette.line, padding: 18,
    shadowColor: palette.shadow, shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 2,
  },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
  sectionTitle: { color: palette.ink, fontSize: 19, fontWeight: '900', letterSpacing: -0.25 },
  sectionSubtitle: { color: palette.muted, fontSize: 13, marginTop: 2 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.ink, fontWeight: '900' },
  pill: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '800' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  progressTrack: { width: '100%', backgroundColor: '#E8EDF0', overflow: 'hidden' },
  softButton: { minHeight: 43, paddingHorizontal: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  softButtonCompact: { minHeight: 35, paddingHorizontal: 12, borderRadius: 13 },
  softButtonText: { fontSize: 13, fontWeight: '800' },
  primaryButton: { minHeight: 52, paddingHorizontal: 22, borderRadius: 18, backgroundColor: palette.green, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  checkCircle: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  nav: {
    position: 'absolute', bottom: 14, left: 14, right: 14, alignSelf: 'center', maxWidth: 620, flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 24, padding: 7, borderWidth: 1, borderColor: palette.line, shadowColor: palette.shadow, shadowOpacity: 0.12, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 7,
  },
  navItem: { flex: 1, minHeight: 51, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  navItemActive: { backgroundColor: palette.blueSoft },
  navIcon: { fontSize: 20, color: palette.muted, lineHeight: 21 },
  navLabel: { fontSize: 11, marginTop: 2, color: palette.muted },
});
