import React, { useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { palette } from './src/model';
import { FamilyProvider, useFamily } from './src/store';
import { OverviewScreen, UpdateScreen, UpdateTab, WhoScreen } from './src/screens';

function FetaApp() {
  const { ready, syncStatus } = useFamily();
  const [screen, setScreen] = useState<'who' | 'overview' | 'update'>('who');
  const [updateTab, setUpdateTab] = useState<UpdateTab>('me');

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={palette.green} />
        <Text style={styles.loadingText}>Getting the household ready…</Text>
      </View>
    );
  }

  const openUpdate = (tab: UpdateTab) => {
    setUpdateTab(tab);
    setScreen('update');
  };

  const syncMeta = {
    local: { label: 'This device only', backgroundColor: '#EDF1F3', color: palette.muted },
    connecting: { label: 'Connecting…', backgroundColor: palette.blueSoft, color: '#266FB6' },
    synced: { label: 'Shared • synced', backgroundColor: palette.greenSoft, color: '#167A4B' },
    offline: { label: 'Shared • offline', backgroundColor: palette.amberSoft, color: '#9B6518' },
  }[syncStatus];

  return (
    <SafeAreaView style={styles.safeArea}>
      {screen === 'who' ? (
        <WhoScreen onContinue={() => setScreen('overview')} />
      ) : screen === 'overview' ? (
        <OverviewScreen onPeople={() => setScreen('who')} onUpdate={openUpdate} />
      ) : (
        <UpdateScreen initialTab={updateTab} onOverview={() => setScreen('overview')} onPeople={() => setScreen('who')} />
      )}
      <View pointerEvents="none" style={[styles.syncBadge, { backgroundColor: syncMeta.backgroundColor }]}>
        <Text style={[styles.syncBadgeText, { color: syncMeta.color }]}>{syncMeta.label}</Text>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <FamilyProvider>
      <StatusBar style="dark" />
      <FetaApp />
    </FamilyProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bg, gap: 12 },
  loadingText: { color: palette.muted, fontSize: 14, fontWeight: '700' },
  syncBadge: { position: 'absolute', top: 8, right: 10, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, opacity: 0.94 },
  syncBadgeText: { fontSize: 10, fontWeight: '800' },
});
