import React, { useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { palette } from './src/model';
import { FamilyProvider, useFamily } from './src/store';
import { OverviewScreen, UpdateScreen, UpdateTab, WhoScreen } from './src/screens';

function FetaApp() {
  const { ready } = useFamily();
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

  return (
    <SafeAreaView style={styles.safeArea}>
      {screen === 'who' ? (
        <WhoScreen onContinue={() => setScreen('overview')} />
      ) : screen === 'overview' ? (
        <OverviewScreen onPeople={() => setScreen('who')} onUpdate={openUpdate} />
      ) : (
        <UpdateScreen initialTab={updateTab} onOverview={() => setScreen('overview')} onPeople={() => setScreen('who')} />
      )}
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
});
