import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import {
  agePercent, FlowId, formatRelativeTime, getFlowPresentation, healthMeta, palette, Person, PersonStatus, Priority, statusMeta,
} from './model';
import { useFamily } from './store';
import {
  AppNav, Avatar, CheckCircle, commonStyles, Panel, PrimaryButton, ProgressBar, SectionHeading, SoftButton, StatusPill,
} from './ui';

export type UpdateTab = 'me' | 'habits' | 'flows' | 'next';

export function WhoScreen({ onContinue }: { onContinue(): void }) {
  const { state, addPerson, setCurrentPerson, togglePersonActive } = useFamily();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const activeCount = state.people.filter((person) => person.isActive).length;

  const submit = () => {
    if (!name.trim()) return;
    addPerson(name);
    setName('');
    setAdding(false);
  };

  return (
    <View style={commonStyles.page}>
      <ScrollView contentContainerStyle={[commonStyles.scrollContent, styles.whoContent]}>
        <View style={styles.whoHeader}>
          <Text style={[commonStyles.title, { fontSize: 38 }]}>Who’s here?</Text>
          <Text style={commonStyles.subtitle}>Choose who’s active today and, if you like, who you are.</Text>
        </View>

        <View style={styles.peopleGrid}>
          {state.people.map((person) => {
            const current = state.currentPersonId === person.id;
            return (
              <Panel key={person.id} style={[styles.personSetupCard, !person.isActive && { opacity: 0.62 }]}> 
                <Avatar person={person} size={72} />
                <Text style={styles.setupName}>{person.name}</Text>
                <View style={styles.activeRow}>
                  <Switch
                    value={person.isActive}
                    onValueChange={() => togglePersonActive(person.id)}
                    trackColor={{ false: '#DCE3E7', true: '#9DDFC0' }}
                    thumbColor={person.isActive ? palette.green : '#FFFFFF'}
                  />
                  <Text style={styles.activeText}>{person.isActive ? 'Active' : 'Not active'}</Text>
                </View>
                <SoftButton
                  label={current ? 'This is me ✓' : 'This is me'}
                  tone={current ? 'green' : 'blue'}
                  compact
                  onPress={() => setCurrentPerson(person.id)}
                />
              </Panel>
            );
          })}

          <Pressable onPress={() => setAdding(true)} style={styles.addPersonCard}>
            <View style={styles.plusCircle}><Text style={styles.plusText}>+</Text></View>
            <Text style={styles.addPersonText}>New person</Text>
          </Pressable>
        </View>

        {state.people.length === 0 ? (
          <View style={styles.emptyWelcome}>
            <Text style={styles.emptyWelcomeIcon}>🏡</Text>
            <Text style={styles.emptyWelcomeTitle}>Start with your household</Text>
            <Text style={commonStyles.body}>Add people once. After that this screen is simply the quick “who’s here?” check-in.</Text>
          </View>
        ) : null}

        <View style={styles.continueWrap}>
          <PrimaryButton label={activeCount ? `Continue with ${activeCount} active` : 'Choose someone active'} disabled={!activeCount} onPress={onContinue} />
          {!state.currentPersonId && activeCount > 0 ? <Text style={styles.helperText}>You can continue as a shared wall display without choosing “This is me”.</Text> : null}
        </View>
      </ScrollView>

      <Modal visible={adding} transparent animationType="fade" onRequestClose={() => setAdding(false)}>
        <View style={styles.modalBackdrop}>
          <Panel style={styles.modalCard}>
            <SectionHeading title="Add someone" subtitle="Just a name for now — profiles can get clever later." />
            <TextInput
              autoFocus value={name} onChangeText={setName} onSubmitEditing={submit} returnKeyType="done"
              placeholder="Name" placeholderTextColor="#98A4B3" style={styles.input}
            />
            <View style={styles.modalActions}>
              <SoftButton label="Cancel" tone="neutral" onPress={() => setAdding(false)} />
              <View style={{ flex: 1 }}><PrimaryButton label="Add person" disabled={!name.trim()} onPress={submit} /></View>
            </View>
          </Panel>
        </View>
      </Modal>
    </View>
  );
}

export function OverviewScreen({
  onPeople, onUpdate,
}: {
  onPeople(): void;
  onUpdate(tab: UpdateTab): void;
}) {
  const { width } = useWindowDimensions();
  const { state, advanceFlow, setCurrentPerson, toggleNextUp } = useFamily();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const activePeople = state.people.filter((person) => person.isActive);
  const attentionFlows = state.flows.filter((flow) => getFlowPresentation(flow).attention);
  const activeNext = state.nextUp.filter((item) => !item.completedAt);
  const incompleteHabitChecks = state.habits.reduce((total, habit) => {
    const done = activePeople.filter((person) => state.habitCompletions[habit.id]?.[person.id]).length;
    return total + Math.max(0, activePeople.length - done);
  }, 0);
  const totalHabitChecks = activePeople.length * state.habits.length;
  const completedHabitChecks = Math.max(0, totalHabitChecks - incompleteHabitChecks);
  const habitPercent = totalHabitChecks ? (completedHabitChecks / totalHabitChecks) * 100 : 0;

  const summary = attentionFlows.length
    ? `${attentionFlows.length} ${attentionFlows.length === 1 ? 'thing needs' : 'things need'} attention`
    : activeNext.length
      ? `${activeNext.length} ${activeNext.length === 1 ? 'thing' : 'things'} in Next up`
      : 'All calm';
  const summarySub = attentionFlows.length ? 'Only the useful next actions are shown' : activeNext.length ? 'Nothing urgent in the household flows' : 'Nothing needs attention right now';
  const greeting = now.getHours() < 12 ? 'Good morning!' : now.getHours() < 18 ? 'Good afternoon!' : 'Good evening!';
  const wide = width >= 1050;

  return (
    <View style={commonStyles.page}>
      <ScrollView contentContainerStyle={commonStyles.scrollContent}>
        <View style={styles.dashboardHeader}>
          <View style={{ minWidth: 190 }}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.dateText}>{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          </View>
          <View style={[styles.calmBanner, attentionFlows.length ? { backgroundColor: palette.amberSoft } : undefined]}>
            <View style={[styles.calmIcon, attentionFlows.length ? { backgroundColor: palette.amber } : undefined]}><Text style={styles.calmIconText}>{attentionFlows.length ? '!' : '✓'}</Text></View>
            <View>
              <Text style={styles.calmTitle}>{summary}</Text>
              <Text style={styles.calmSub}>{summarySub}</Text>
            </View>
          </View>
          <View style={styles.clockWrap}>
            <Text style={styles.clock}>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            <Pressable onPress={onPeople}><Text style={styles.switchText}>Who’s here?</Text></Pressable>
          </View>
        </View>

        <View style={styles.overviewPeople}>
          {activePeople.map((person) => (
            <Pressable
              key={person.id}
              onPress={() => { setCurrentPerson(person.id); onUpdate('me'); }}
              style={styles.overviewPersonCard}
            >
              <View style={styles.personCardTop}>
                <Avatar person={person} size={56} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.personName}>{person.name}</Text>
                  <StatusPill person={person} />
                </View>
              </View>
              <View style={styles.energyLabelRow}><Text style={styles.energyLabel}>Energy</Text><Text style={styles.energyValue}>{person.energy}%</Text></View>
              <ProgressBar value={person.energy} color={person.energy < 40 ? palette.purple : palette.green} />
              <View style={styles.healthMiniRow}>
                {(Object.keys(healthMeta) as Array<keyof typeof healthMeta>).map((key) => (
                  <View key={key} style={[styles.healthMini, person.health[key] && styles.healthMiniDone]}>
                    <Text style={styles.healthMiniIcon}>{healthMeta[key].icon}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          ))}
          {activePeople.length === 0 ? <Panel style={{ flex: 1 }}><Text style={commonStyles.body}>No active people. Use “Who’s here?” to bring someone onto the dashboard.</Text></Panel> : null}
        </View>

        <View style={[styles.dashboardColumns, !wide && { flexDirection: 'column' }]}>
          <Panel style={styles.dashboardColumn}>
            <SectionHeading
              title="Today’s habits"
              subtitle={totalHabitChecks ? `${completedHabitChecks} / ${totalHabitChecks} complete` : 'No active people'}
              right={<Text style={styles.panelEmoji}>✓</Text>}
            />
            <ProgressBar value={habitPercent} />
            <View style={styles.listGap}>
              {state.habits.map((habit) => {
                const completed = activePeople.filter((person) => state.habitCompletions[habit.id]?.[person.id]);
                return (
                  <Pressable key={habit.id} onPress={() => onUpdate('habits')} style={styles.habitOverviewRow}>
                    <Text style={styles.rowIcon}>{habit.icon}</Text>
                    <Text style={styles.rowTitle}>{habit.name}</Text>
                    <View style={styles.miniAvatarStack}>
                      {activePeople.slice(0, 5).map((person) => (
                        <View key={person.id} style={[styles.initialDot, { backgroundColor: person.avatarColor }, state.habitCompletions[habit.id]?.[person.id] && styles.initialDotDone]}>
                          <Text style={styles.initialDotText}>{person.name.charAt(0).toUpperCase()}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.countText}>{completed.length}/{activePeople.length}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Panel>

          <Panel style={styles.dashboardColumn}>
            <SectionHeading title="Household flows" subtitle={attentionFlows.length ? 'These are the only bits asking for you' : 'Nothing is nagging you'} right={<Text style={styles.panelEmoji}>↻</Text>} />
            <View style={styles.listGap}>
              {state.flows.map((flow) => {
                const presentation = getFlowPresentation(flow);
                const actor = state.people.find((person) => person.id === flow.lastUpdatedById);
                return (
                  <View key={flow.id} style={[styles.flowOverviewRow, presentation.attention && { backgroundColor: palette.amberSoft }]}> 
                    <View style={[styles.flowIcon, { backgroundColor: presentation.softTone }]}><Text>{flow.icon}</Text></View>
                    <Pressable style={{ flex: 1 }} onPress={() => onUpdate('flows')}>
                      <Text style={styles.rowTitle}>{flow.name}</Text>
                      <Text style={[styles.flowState, { color: presentation.attention ? '#A46716' : presentation.tone }]}>{presentation.label}</Text>
                      <Text style={styles.flowWhen}>{flow.lastUpdatedAt ? `${formatRelativeTime(flow.lastUpdatedAt)}${actor ? ` by ${actor.name}` : ''}` : 'Ready when you are'}</Text>
                    </Pressable>
                    <SoftButton label={presentation.action} compact tone={presentation.attention ? 'amber' : presentation.inProgress ? 'blue' : 'green'} onPress={() => advanceFlow(flow.id)} />
                  </View>
                );
              })}
            </View>
          </Panel>

          <Panel style={styles.dashboardColumn}>
            <SectionHeading title="Next up" subtitle={activeNext.length ? `${activeNext.length} small ${activeNext.length === 1 ? 'thing' : 'things'} waiting` : 'Nothing queued'} right={<Text style={styles.panelEmoji}>☰</Text>} />
            <View style={styles.listGap}>
              {activeNext.slice(0, 5).map((item) => {
                const assignee = state.people.find((person) => person.id === item.assigneeId);
                return (
                  <View key={item.id} style={styles.nextOverviewRow}>
                    <Pressable onPress={() => toggleNextUp(item.id)}><CheckCircle checked={false} /></Pressable>
                    <Pressable style={{ flex: 1 }} onPress={() => onUpdate('next')}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      <Text style={styles.flowWhen}>{assignee ? assignee.name : 'Anyone'} · {item.priority}</Text>
                    </Pressable>
                  </View>
                );
              })}
              {activeNext.length === 0 ? <View style={styles.calmEmpty}><Text style={styles.calmEmptyIcon}>🌿</Text><Text style={styles.calmEmptyText}>Nothing queued. Lovely.</Text></View> : null}
            </View>
            <SoftButton label="+ Add something" tone="blue" onPress={() => onUpdate('next')} />
          </Panel>
        </View>

        <Panel style={{ marginTop: 14 }}>
          <SectionHeading title="Last done" subtitle="Shared household memory — not another task list." />
          <View style={styles.lastDoneGrid}>
            {state.flows.map((flow) => {
              const who = state.people.find((person) => person.id === flow.lastCompletedById);
              const targetHours = flow.id === 'laundry' ? 72 : 24;
              return (
                <View key={flow.id} style={styles.lastDoneItem}>
                  <View style={styles.lastDoneTop}><Text style={styles.rowIcon}>{flow.icon}</Text><Text style={styles.rowTitle}>{flow.name}</Text><Text style={styles.lastDoneTime}>{formatRelativeTime(flow.lastCompletedAt)}</Text></View>
                  <ProgressBar value={agePercent(flow.lastCompletedAt, targetHours)} color={flow.lastCompletedAt ? palette.blue : '#DCE3E7'} height={7} />
                  <Text style={styles.flowWhen}>{who ? `Last finished by ${who.name}` : 'No completion recorded yet'}</Text>
                </View>
              );
            })}
          </View>
        </Panel>
      </ScrollView>
      <AppNav screen="overview" onOverview={() => undefined} onUpdate={() => onUpdate('me')} onPeople={onPeople} />
    </View>
  );
}

export function UpdateScreen({ initialTab, onOverview, onPeople }: { initialTab: UpdateTab; onOverview(): void; onPeople(): void }) {
  const [tab, setTab] = useState<UpdateTab>(initialTab);
  return (
    <View style={commonStyles.page}>
      <ScrollView contentContainerStyle={commonStyles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.updateHeader}>
          <View><Text style={commonStyles.title}>Update</Text><Text style={commonStyles.subtitle}>A few taps, then get on with your day.</Text></View>
          <SoftButton label="Back to overview" tone="neutral" onPress={onOverview} />
        </View>
        <View style={styles.tabBar}>
          {([
            ['me', 'Me'], ['habits', 'Habits'], ['flows', 'Flows'], ['next', 'Next up'],
          ] as Array<[UpdateTab, string]>).map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabActive]}>
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {tab === 'me' ? <MeTab /> : tab === 'habits' ? <HabitsTab /> : tab === 'flows' ? <FlowsTab /> : <NextUpTab />}
      </ScrollView>
      <AppNav screen="update" onOverview={onOverview} onUpdate={() => undefined} onPeople={onPeople} />
    </View>
  );
}

function MeTab() {
  const { state, setCurrentPerson, setEnergy, setStatus, toggleHealth } = useFamily();
  const active = state.people.filter((person) => person.isActive);
  const current = state.people.find((person) => person.id === state.currentPersonId);
  if (!current) {
    return (
      <Panel>
        <SectionHeading title="Who are you updating?" subtitle="The wall display can stay anonymous; choose someone only when you want to update them." />
        <View style={styles.personChipWrap}>{active.map((person) => <PersonChip key={person.id} person={person} onPress={() => setCurrentPerson(person.id)} />)}</View>
      </Panel>
    );
  }

  const statuses: PersonStatus[] = ['in-zone', 'free', 'drained', 'out'];
  return (
    <View style={styles.updateStack}>
      <Panel>
        <View style={styles.currentPersonHeader}>
          <Avatar person={current} size={68} />
          <View style={{ flex: 1 }}><Text style={styles.currentPersonName}>{current.name}</Text><Text style={commonStyles.body}>How available are you to the rest of the household?</Text></View>
        </View>
        <Text style={styles.fieldLabel}>Current state</Text>
        <View style={styles.choiceWrap}>
          {statuses.map((status) => {
            const meta = statusMeta[status]; const selected = current.status === status;
            return <Pressable key={status} onPress={() => setStatus(current.id, status)} style={[styles.choicePill, { backgroundColor: selected ? meta.bg : '#F4F6F7', borderColor: selected ? meta.fg : '#E2E7EA' }]}><Text style={[styles.choiceText, selected && { color: meta.fg }]}>{meta.label}</Text></Pressable>;
          })}
        </View>
        <Text style={styles.fieldLabel}>Energy</Text>
        <View style={styles.energyScale}>
          {[20, 40, 60, 80, 100].map((value) => (
            <Pressable key={value} onPress={() => setEnergy(current.id, value)} style={[styles.energyStep, current.energy >= value && { backgroundColor: current.energy < 40 ? palette.purple : palette.green }]}>
              <Text style={[styles.energyStepText, current.energy >= value && { color: '#FFFFFF' }]}>{value}</Text>
            </Pressable>
          ))}
        </View>
      </Panel>
      <Panel>
        <SectionHeading title="Today’s health checks" subtitle="Lightweight signals, not medical records." />
        {(Object.keys(healthMeta) as Array<keyof typeof healthMeta>).map((key) => (
          <Pressable key={key} onPress={() => toggleHealth(current.id, key)} style={styles.checkRow}>
            <Text style={styles.rowIcon}>{healthMeta[key].icon}</Text><Text style={styles.rowTitle}>{healthMeta[key].label}</Text><CheckCircle checked={current.health[key]} />
          </Pressable>
        ))}
      </Panel>
      {active.length > 1 ? <Panel><SectionHeading title="Switch person" /><View style={styles.personChipWrap}>{active.filter((person) => person.id !== current.id).map((person) => <PersonChip key={person.id} person={person} onPress={() => setCurrentPerson(person.id)} />)}</View></Panel> : null}
    </View>
  );
}

function PersonChip({ person, onPress }: { person: Person; onPress(): void }) {
  return <Pressable onPress={onPress} style={styles.personChip}><Avatar person={person} size={35} /><Text style={styles.personChipText}>{person.name}</Text></Pressable>;
}

function HabitsTab() {
  const { state, toggleHabit } = useFamily();
  const active = state.people.filter((person) => person.isActive);
  return (
    <Panel>
      <SectionHeading title="Daily habits" subtitle="Everyone shares the same habits for now. They reset automatically each day." />
      {active.length === 0 ? <Text style={commonStyles.body}>No active people.</Text> : null}
      <View style={styles.habitTable}>
        {state.habits.map((habit) => (
          <View key={habit.id} style={styles.habitMatrixRow}>
            <View style={styles.habitMatrixTitle}><Text style={styles.rowIcon}>{habit.icon}</Text><Text style={styles.rowTitle}>{habit.name}</Text></View>
            <View style={styles.habitPeople}>
              {active.map((person) => {
                const checked = Boolean(state.habitCompletions[habit.id]?.[person.id]);
                return (
                  <Pressable key={person.id} onPress={() => toggleHabit(person.id, habit.id)} style={styles.habitPersonCell}>
                    <Avatar person={person} size={36} /><CheckCircle checked={checked} size={24} /><Text numberOfLines={1} style={styles.habitPersonName}>{person.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </Panel>
  );
}

function FlowsTab() {
  const { state, advanceFlow } = useFamily();
  return (
    <View style={styles.updateStack}>
      <Panel>
        <SectionHeading title="Household flows" subtitle="Jobs are processes. Advance the state; FETA remembers what the next useful action is." />
        <Text style={styles.flowExplainer}>Dinner → kitchen reset and dishwasher loading. Laundry → wash → dry → put away. No recurring overdue chores.</Text>
      </Panel>
      {state.flows.map((flow) => {
        const presentation = getFlowPresentation(flow);
        const actor = state.people.find((person) => person.id === flow.lastUpdatedById);
        return (
          <Panel key={flow.id} style={presentation.attention ? { borderColor: '#F1CD96' } : undefined}>
            <View style={styles.flowDetailTop}>
              <View style={[styles.flowDetailIcon, { backgroundColor: presentation.softTone }]}><Text style={{ fontSize: 30 }}>{flow.icon}</Text></View>
              <View style={{ flex: 1 }}><Text style={styles.currentPersonName}>{flow.name}</Text><Text style={[styles.flowDetailState, { color: presentation.tone }]}>{presentation.label}</Text><Text style={commonStyles.body}>{flow.lastUpdatedAt ? `Changed ${formatRelativeTime(flow.lastUpdatedAt)}${actor ? ` by ${actor.name}` : ''}` : 'No activity recorded yet'}</Text></View>
            </View>
            <View style={styles.flowActionBar}>
              <View style={{ flex: 1 }}><Text style={styles.fieldLabel}>Next useful action</Text><Text style={styles.flowNextText}>{presentation.action}</Text></View>
              <PrimaryButton label={presentation.action} onPress={() => advanceFlow(flow.id as FlowId)} />
            </View>
            <Text style={styles.lastDoneSmall}>Last completed: {formatRelativeTime(flow.lastCompletedAt)}</Text>
          </Panel>
        );
      })}
    </View>
  );
}

function NextUpTab() {
  const { state, addNextUp, claimNextUp, removeNextUp, toggleNextUp } = useFamily();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [assigneeId, setAssigneeId] = useState<string | undefined>();
  const activePeople = state.people.filter((person) => person.isActive);
  const activeItems = state.nextUp.filter((item) => !item.completedAt);
  const completed = state.nextUp.filter((item) => item.completedAt);
  const currentId = state.currentPersonId;

  const submit = () => {
    if (!title.trim()) return;
    addNextUp(title, priority, assigneeId);
    setTitle(''); setPriority('medium'); setAssigneeId(undefined); setAdding(false);
  };

  return (
    <View style={styles.updateStack}>
      <Panel>
        <SectionHeading title="Next up" subtitle="A short bucket for ad-hoc things — not a backlog." right={<SoftButton label="+ Add" compact tone="blue" onPress={() => setAdding(true)} />} />
        <View style={styles.listGap}>
          {activeItems.map((item) => {
            const assignee = state.people.find((person) => person.id === item.assigneeId);
            return (
              <View key={item.id} style={styles.nextDetailRow}>
                <Pressable onPress={() => toggleNextUp(item.id)}><CheckCircle checked={false} size={29} /></Pressable>
                <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.flowWhen}>{item.priority} · {assignee ? assignee.name : 'Anyone'}</Text></View>
                {!item.assigneeId && currentId ? <SoftButton label="Claim" compact tone="blue" onPress={() => claimNextUp(item.id, currentId)} /> : null}
                <Pressable onPress={() => removeNextUp(item.id)} style={styles.removeButton}><Text style={styles.removeText}>×</Text></Pressable>
              </View>
            );
          })}
          {activeItems.length === 0 ? <View style={styles.calmEmpty}><Text style={styles.calmEmptyIcon}>✨</Text><Text style={styles.calmEmptyText}>Nothing waiting. Keep it that way.</Text></View> : null}
        </View>
      </Panel>
      {completed.length ? <Panel><SectionHeading title="Done" subtitle={`${completed.length} completed item${completed.length === 1 ? '' : 's'}`} /><View style={styles.listGap}>{completed.slice(-5).reverse().map((item) => <Pressable key={item.id} onPress={() => toggleNextUp(item.id)} style={styles.doneRow}><CheckCircle checked /><Text style={[styles.rowTitle, { flex: 1, textDecorationLine: 'line-through', color: palette.muted }]}>{item.title}</Text><Text style={styles.flowWhen}>Undo</Text></Pressable>)}</View></Panel> : null}

      <Modal visible={adding} transparent animationType="fade" onRequestClose={() => setAdding(false)}>
        <View style={styles.modalBackdrop}>
          <Panel style={styles.modalCard}>
            <SectionHeading title="Add to Next up" subtitle="Keep it small and concrete." />
            <TextInput autoFocus value={title} onChangeText={setTitle} placeholder="What needs doing?" placeholderTextColor="#98A4B3" style={styles.input} />
            <Text style={styles.fieldLabel}>Priority</Text>
            <View style={styles.choiceWrap}>{(['low', 'medium', 'high'] as Priority[]).map((value) => <Pressable key={value} onPress={() => setPriority(value)} style={[styles.choicePill, priority === value && { backgroundColor: value === 'high' ? palette.coralSoft : value === 'medium' ? palette.amberSoft : palette.greenSoft }]}><Text style={styles.choiceText}>{value}</Text></Pressable>)}</View>
            <Text style={styles.fieldLabel}>Assign to (optional)</Text>
            <View style={styles.personChipWrap}>{activePeople.map((person) => <Pressable key={person.id} onPress={() => setAssigneeId(assigneeId === person.id ? undefined : person.id)} style={[styles.personChip, assigneeId === person.id && { borderColor: palette.blue, backgroundColor: palette.blueSoft }]}><Avatar person={person} size={30} /><Text style={styles.personChipText}>{person.name}</Text></Pressable>)}</View>
            <View style={styles.modalActions}><SoftButton label="Cancel" tone="neutral" onPress={() => setAdding(false)} /><View style={{ flex: 1 }}><PrimaryButton label="Add item" disabled={!title.trim()} onPress={submit} /></View></View>
          </Panel>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  whoContent: { justifyContent: 'center', minHeight: '100%' },
  whoHeader: { alignItems: 'center', marginBottom: 28 },
  peopleGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  personSetupCard: { width: 210, alignItems: 'center', gap: 12 },
  setupName: { color: palette.ink, fontSize: 20, fontWeight: '900' },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  activeText: { color: palette.muted, fontWeight: '700', fontSize: 13 },
  addPersonCard: { width: 210, minHeight: 220, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#C7D2DA', borderRadius: 24, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.45)' },
  plusCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E7EDF1', alignItems: 'center', justifyContent: 'center' },
  plusText: { color: palette.ink, fontSize: 28, lineHeight: 30 },
  addPersonText: { color: palette.ink, fontWeight: '800' },
  emptyWelcome: { alignItems: 'center', maxWidth: 440, alignSelf: 'center', marginTop: 20 },
  emptyWelcomeIcon: { fontSize: 38 }, emptyWelcomeTitle: { color: palette.ink, fontWeight: '900', fontSize: 18, marginTop: 8, marginBottom: 5 },
  continueWrap: { width: '100%', maxWidth: 440, alignSelf: 'center', marginTop: 25 },
  helperText: { color: palette.muted, fontSize: 12, textAlign: 'center', marginTop: 9 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(20,36,61,0.34)', padding: 18, alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 520 },
  input: { minHeight: 52, borderWidth: 1, borderColor: '#D6DEE4', borderRadius: 16, paddingHorizontal: 15, fontSize: 16, color: palette.ink, backgroundColor: '#FBFCFC' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18, alignItems: 'stretch' },

  dashboardHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 15, marginBottom: 16 },
  greeting: { color: palette.ink, fontSize: 28, fontWeight: '900', letterSpacing: -0.6 },
  dateText: { color: palette.muted, fontSize: 14, marginTop: 2 },
  calmBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.greenSoft, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 24, flexGrow: 1, maxWidth: 470, minWidth: 290 },
  calmIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.green },
  calmIconText: { color: '#FFFFFF', fontWeight: '900', fontSize: 21 }, calmTitle: { color: palette.ink, fontWeight: '900', fontSize: 16 }, calmSub: { color: palette.muted, fontSize: 12, marginTop: 2 },
  clockWrap: { alignItems: 'flex-end' }, clock: { color: palette.ink, fontSize: 28, fontWeight: '900' }, switchText: { color: '#347ABF', fontSize: 12, fontWeight: '800', marginTop: 2 },
  overviewPeople: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  overviewPersonCard: { flexGrow: 1, flexBasis: 230, minWidth: 210, backgroundColor: palette.surface, borderRadius: 22, borderWidth: 1, borderColor: palette.line, padding: 15 },
  personCardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' }, personName: { color: palette.ink, fontWeight: '900', fontSize: 17, marginBottom: 7 },
  energyLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 5 }, energyLabel: { color: palette.muted, fontSize: 11, fontWeight: '700' }, energyValue: { color: palette.muted, fontSize: 11 },
  healthMiniRow: { flexDirection: 'row', gap: 7, marginTop: 11 }, healthMini: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F4F5', opacity: 0.55 }, healthMiniDone: { backgroundColor: palette.greenSoft, opacity: 1 }, healthMiniIcon: { fontSize: 15 },
  dashboardColumns: { flexDirection: 'row', gap: 14, alignItems: 'stretch' }, dashboardColumn: { flex: 1, minWidth: 0 }, panelEmoji: { fontSize: 21 }, listGap: { gap: 8, marginTop: 13 },
  habitOverviewRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 45, borderBottomWidth: 1, borderBottomColor: '#F0F3F4' }, rowIcon: { fontSize: 18 }, rowTitle: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  miniAvatarStack: { flexDirection: 'row', marginLeft: 'auto' }, initialDot: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginLeft: -4, borderWidth: 2, borderColor: '#FFFFFF', opacity: 0.5 }, initialDotDone: { opacity: 1, borderColor: palette.green }, initialDotText: { color: palette.ink, fontSize: 9, fontWeight: '900' }, countText: { color: palette.muted, width: 30, textAlign: 'right', fontSize: 11 },
  flowOverviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 9, borderRadius: 17, backgroundColor: palette.surfaceMuted }, flowIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, flowState: { fontSize: 12, fontWeight: '800', marginTop: 2 }, flowWhen: { color: palette.muted, fontSize: 11, marginTop: 2 },
  nextOverviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderBottomWidth: 1, borderBottomColor: '#F0F3F4' }, calmEmpty: { padding: 18, borderRadius: 18, backgroundColor: '#F7FAF8', alignItems: 'center' }, calmEmptyIcon: { fontSize: 26 }, calmEmptyText: { color: palette.muted, marginTop: 5, fontWeight: '700' },
  lastDoneGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, lastDoneItem: { flexGrow: 1, flexBasis: 280, minWidth: 240, padding: 13, backgroundColor: palette.surfaceMuted, borderRadius: 17 }, lastDoneTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }, lastDoneTime: { marginLeft: 'auto', color: palette.muted, fontSize: 12, fontWeight: '800' },

  updateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 15 },
  tabBar: { flexDirection: 'row', backgroundColor: '#EAEFF1', padding: 5, borderRadius: 19, marginBottom: 14 }, tab: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 15, alignItems: 'center' }, tabActive: { backgroundColor: palette.surface }, tabText: { color: palette.muted, fontSize: 13, fontWeight: '800' }, tabTextActive: { color: '#266FB6' },
  updateStack: { gap: 14 }, currentPersonHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 }, currentPersonName: { color: palette.ink, fontSize: 22, fontWeight: '900' },
  fieldLabel: { color: palette.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 14, marginBottom: 8 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choicePill: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 15, backgroundColor: '#F4F6F7', borderWidth: 1, borderColor: '#E2E7EA' }, choiceText: { color: palette.ink, fontSize: 13, fontWeight: '800', textTransform: 'capitalize' },
  energyScale: { flexDirection: 'row', gap: 6 }, energyStep: { flex: 1, height: 40, borderRadius: 13, backgroundColor: '#EDF1F3', alignItems: 'center', justifyContent: 'center' }, energyStepText: { color: palette.muted, fontSize: 11, fontWeight: '800' },
  checkRow: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: '#EEF2F3' },
  personChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, personChip: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 7, paddingRight: 11, borderRadius: 16, borderWidth: 1, borderColor: palette.line, backgroundColor: '#FBFCFC' }, personChipText: { color: palette.ink, fontWeight: '800', fontSize: 12 },
  habitTable: { gap: 4 }, habitMatrixRow: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#EEF2F3' }, habitMatrixTitle: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10 }, habitPeople: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, habitPersonCell: { width: 76, alignItems: 'center', gap: 5, padding: 7, backgroundColor: '#F7F9F9', borderRadius: 15 }, habitPersonName: { color: palette.muted, fontSize: 10, maxWidth: 66 },
  flowExplainer: { color: palette.muted, fontSize: 13, lineHeight: 19, backgroundColor: '#F5F8F7', padding: 13, borderRadius: 15 }, flowDetailTop: { flexDirection: 'row', alignItems: 'center', gap: 14 }, flowDetailIcon: { width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, flowDetailState: { fontWeight: '900', fontSize: 14, marginVertical: 3 }, flowActionBar: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF2F3' }, flowNextText: { color: palette.ink, fontWeight: '900', fontSize: 16 }, lastDoneSmall: { color: palette.muted, fontSize: 11, marginTop: 10 },
  nextDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 58, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#EEF2F3' }, removeButton: { width: 31, height: 31, borderRadius: 12, backgroundColor: '#F4F6F7', alignItems: 'center', justifyContent: 'center' }, removeText: { color: palette.muted, fontSize: 22, lineHeight: 23 }, doneRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 45 },
});
