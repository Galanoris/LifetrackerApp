import { useEffect, useState } from 'preact/hooks';
import { useRegisterSW } from 'virtual:pwa-register/preact';
import { db, ensureSeeded, requestPersistence, useLive } from './lib/db';
import { dueWeek } from './lib/dates';
import { Today } from './screens/Today';
import { Week } from './screens/Week';
import { Insights } from './screens/Insights';
import { SettingsScreen } from './screens/Settings';
import { InsightsIcon, SettingsIcon, TodayIcon, WeekIcon } from './components/Icons';

export type Tab = 'today' | 'week' | 'insights' | 'settings';

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTabState] = useState<Tab>(() => {
    const h = location.hash.slice(1);
    return (['today', 'week', 'insights', 'settings'] as const).find((t) => t === h) ?? 'today';
  });
  const setTab = (t: Tab) => {
    setTabState(t);
    history.replaceState(null, '', t === 'today' ? location.pathname + location.search : `#${t}`);
  };
  const [weekTarget, setWeekTarget] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    ensureSeeded()
      .then(async () => {
        if (import.meta.env.DEV) {
          const demo = await import('./lib/demo');
          if (demo.isDemo) await demo.fillDemo();
        }
        setReady(true);
      })
      .catch((e) => setError(String(e?.message ?? e)));
    requestPersistence();
  }, []);

  // When the app comes back from the background (e.g. next morning), refresh "now".
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && setNow(new Date());
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(t);
    };
  }, []);

  const settings = useLive(() => db.settings.get('settings'), [ready]);
  const dimensions = useLive(() => db.dimensions.orderBy('order').toArray(), [ready]);

  const due = settings ? dueWeek(now, settings.weeklyCheckInDay) : null;
  const weeklyIds = dimensions?.filter((d) => d.active && d.frequency === 'weekly').map((d) => d.id) ?? [];
  const weeklyAnswered = useLive(
    async () => (due ? (await db.entries.where('period').equals(due).toArray()).filter((e) => weeklyIds.includes(e.dimensionId)).length : 0),
    [due, weeklyIds.join(',')],
  );
  const weeklyDue = !!due && weeklyIds.length > 0 && weeklyAnswered !== undefined && weeklyAnswered < weeklyIds.length;

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Check for a new version whenever the app is opened / every hour.
      if (reg) setInterval(() => reg.update(), 60 * 60 * 1000);
    },
  });

  if (error) {
    return (
      <div class="screen">
        <div class="banner warn">Could not open the on-device database: {error}</div>
      </div>
    );
  }
  if (!ready || !settings || !dimensions) return <div class="screen" />;

  const openWeek = (week: string) => {
    setWeekTarget(week);
    setTab('week');
  };

  return (
    <div class="app">
      <main class="screen" key={tab}>
        {needRefresh && (
          <div class="banner">
            <span class="grow">A new version is available.</span>
            <button class="btn primary" onClick={() => updateServiceWorker(true)}>Reload</button>
          </div>
        )}
        {tab === 'today' && (
          <Today settings={settings} dimensions={dimensions} now={now} weeklyDue={weeklyDue ? due : null} onOpenWeek={openWeek} onOpenSettings={() => setTab('settings')} />
        )}
        {tab === 'week' && <Week settings={settings} dimensions={dimensions} now={now} initialWeek={weekTarget ?? due} />}
        {tab === 'insights' && <Insights settings={settings} dimensions={dimensions} now={now} />}
        {tab === 'settings' && <SettingsScreen settings={settings} dimensions={dimensions} />}
      </main>
      <div class="tabbar">
        <nav>
          {(
            [
              ['today', 'Today', <TodayIcon />],
              ['week', 'Week', <WeekIcon />],
              ['insights', 'Insights', <InsightsIcon />],
              ['settings', 'Settings', <SettingsIcon />],
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              class={tab === id ? 'active' : ''}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => {
                if (id === 'week') setWeekTarget(null);
                setTab(id);
                window.scrollTo(0, 0);
              }}
            >
              {icon}
              {label}
              {id === 'week' && weeklyDue && <span class="dot" aria-label="Weekly check-in due" />}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
