
import { useEffect, useMemo, useState } from "react";
import {
  Activity, Users, ClipboardList, Wrench, BarChart3, Plus,
RefreshCw, CheckCircle2, AlertCircle, Trash2
} from "lucide-react";
import { configured, supabase } from "./supabase";

type Scout = { id: string; name: string; active: boolean };

type RecordRow = {
  id: string;
  team_number: number;
  match_number: number;
  alliance: string;
  scout_name: string;
  created_at: string;
  auto_rating: number | null;
  shooting_accuracy: number | null;
  shooting_speed: number | null;
  driving_speed: number | null;
  maneuverability: number | null;
  reliability: number | null;
  hive_tips: number;
  can_shoot_nectar: boolean;
  refilled_flower: boolean;
  ranking_points: number;
  notes: string | null;
};

const emptyForm = {
  team_number: "",
  match_number: "",
  alliance: "Red",
  auto_rating: 3,
  shooting_accuracy: 3,
  shooting_speed: 3,
  driving_speed: 3,
  maneuverability: 3,
  reliability: 3,
  hive_tips: 0,
  can_shoot_nectar: false,
  refilled_flower: false,
  ranking_points: 0,
  notes: ""
};

export default function App() {
  const [sessionReady, setSessionReady] = useState(false);
  const [joined, setJoined] = useState(false);
  const [tab, setTab] = useState("home");
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [selectedScout, setSelectedScout] = useState(
    () => localStorage.getItem("tg-selected-scout") || ""
  );
  const [teamId, setTeamId] = useState("");
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [teamCode, setTeamCode] = useState("");
  const [coordinatorCode, setCoordinatorCode] = useState("");
  const [newScout, setNewScout] = useState("");
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setSessionReady(true);
        await loadTeam();
      } else setSessionReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setJoined(false);
        setScouts([]);
        setRecords([]);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadTeam() {
    if (!supabase) return;
    const { data: authData } = await supabase.auth.getUser();

    const [
      { data: scoutData, error: scoutError },
      { data: recordData, error: recordError },
      { data: memberData }
    ] = await Promise.all([
      supabase.from("scouts").select("id,name,active").eq("active", true).order("name"),
      supabase.from("match_records").select("*").order("created_at", { ascending: false }).limit(250),
      supabase.from("team_members").select("role,team_id")
        .eq("user_id", authData.user?.id || "").limit(1).maybeSingle()
    ]);

    setIsCoordinator(memberData?.role === "coordinator");
    setTeamId(memberData?.team_id || "");

    if (scoutError || recordError) {
      setError(scoutError?.message || recordError?.message || "Could not load team data.");
      return;
    }

    setScouts(scoutData || []);
    setRecords((recordData || []) as RecordRow[]);
    setJoined(true);
    setError("");
  }

  async function enterTeam() {
    if (!supabase) return;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const { error: authError } = await supabase.auth.signInAnonymously();
      if (authError) throw authError;

      const { data: joinData, error: joinError } =
        await supabase.functions.invoke("join-team", {
          body: {
            accessCode: teamCode.trim(),
            coordinatorCode: coordinatorCode.trim() || null
          }
        });

      if (joinError) throw joinError;
      if (joinData?.error) throw new Error(joinData.error);

      setJoined(true);
      setIsCoordinator(joinData?.role === "coordinator");
      await loadTeam();
      setMessage("Connected to your team.");
    } catch (e: any) {
      setError(e.message || "Could not join the team. Check the access code and setup.");
    } finally {
      setBusy(false);
    }
  }

  async function submitRecord() {
    if (!supabase || !selectedScout) {
      setError("Choose your scout name first.");
      return;
    }

    const team = Number(form.team_number);
    const match = Number(form.match_number);

    if (!Number.isInteger(team) || team < 1 ||
        !Number.isInteger(match) || match < 1) {
      setError("Enter a valid team number and match number.");
      return;
    }

    if (!Number.isInteger(form.hive_tips) || form.hive_tips < 0 || form.hive_tips > 10) {
      setError("Hive tips must be a whole number from 0 to 10.");
      return;
    }

    if (!Number.isInteger(form.ranking_points) ||
        form.ranking_points < 0 || form.ranking_points > 6) {
      setError("Ranking points must be a whole number from 0 to 6.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user || !teamId) {
      setError("Your team session needs to be refreshed. Please return to the dashboard and rejoin.");
      setBusy(false);
      return;
    }

    const payload = {
      team_id: teamId,
      submitted_by: authData.user.id,
      team_number: team,
      match_number: match,
      alliance: form.alliance,
      scout_name: selectedScout,
      auto_rating: form.auto_rating,
      shooting_accuracy: form.shooting_accuracy,
      shooting_speed: form.shooting_speed,
      driving_speed: form.driving_speed,
      maneuverability: form.maneuverability,
      reliability: form.reliability,
      hive_tips: form.hive_tips,
      can_shoot_nectar: form.can_shoot_nectar,
      refilled_flower: form.refilled_flower,
      ranking_points: form.ranking_points,
      notes: form.notes.trim() || null
    };

    const { error: saveError } = await supabase.from("match_records").insert(payload);

    if (saveError) {
      setError(saveError.message);
    } else {
      setMessage("Match scouting saved for the whole team.");
      setForm(emptyForm);
      await loadTeam();
      setTab("records");
    }

    setBusy(false);
  }

  async function addScout() {
    const cleanName = newScout.trim().replace(/\s+/g, " ");
    if (!supabase || !cleanName || !teamId) return;

    if (cleanName.length > 40) {
      setError("Scout names must be 40 characters or fewer.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    const existing = scouts.find(
      s => s.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase()
    );

    if (existing) {
      setSelectedScout(existing.name);
      localStorage.setItem("tg-selected-scout", existing.name);
      setNewScout("");
      setMessage("That name is already on the list. We selected it for you.");
      setBusy(false);
      return;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("scouts")
      .insert({ team_id: teamId, name: cleanName })
      .select("id,name,active")
      .single();

    if (insertError) {
      setError(insertError.code === "23505"
        ? "That name is already on the list. Select it instead."
        : insertError.message);
    } else {
      setNewScout("");
      setSelectedScout(inserted.name);
      localStorage.setItem("tg-selected-scout", inserted.name);
      setMessage(`Welcome, ${inserted.name}! Your name is now on the team list.`);
      await loadTeam();
    }

    setBusy(false);
  }

  function chooseScout(name: string) {
    setSelectedScout(name);
    if (name) localStorage.setItem("tg-selected-scout", name);
    else localStorage.removeItem("tg-selected-scout");
  }

  async function deactivateScout(id: string) {
  if (!supabase) return;
  const { error: updateError } = await supabase
    .from("scouts").update({ active: false }).eq("id", id);

  if (updateError) setError(updateError.message);
  else await loadTeam();
}

  const teamSummaries = useMemo(() => {
    const grouped = new Map<number, RecordRow[]>();

    records.forEach(r => {
      grouped.set(r.team_number, [...(grouped.get(r.team_number) || []), r]);
    });

    return [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([team, rows]) => ({
        team,
        count: rows.length,
        autonomous: avg(rows, ["auto_rating"]),
        shooting: avg(rows, ["shooting_accuracy", "shooting_speed"]),
        mobility: avg(rows, ["driving_speed", "maneuverability"]),
        reliability: avg(rows, ["reliability"]),
        rankingTotal: rows.reduce((sum, r) => sum + (r.ranking_points || 0), 0),
        rankingAverage: rows.length
          ? rows.reduce((sum, r) => sum + (r.ranking_points || 0), 0) / rows.length
          : null
      }));
  }, [records]);

  if (!configured) return <SetupScreen />;

  if (!sessionReady) {
    return <div className="center"><div className="spinner"/>Connecting…</div>;
  }

  if (!joined) return <main className="gate">
    <div className="brand-mark">TG</div>
    <p className="eyebrow">FTC TEAM SCOUTING</p>
    <h1>TURNING GEARS<br/><span>SCOUTING</span></h1>
    <p className="muted">Join your team's shared scouting workspace.</p>
    <section className="panel gate-panel">
      <label>Team access code</label>
      <input value={teamCode} onChange={e => setTeamCode(e.target.value)}
        placeholder="Enter team code" type="password"/>
      <label>Coordinator code <small>(optional)</small></label>
      <input value={coordinatorCode} onChange={e => setCoordinatorCode(e.target.value)}
        placeholder="Only for roster managers" type="password"/>
      <button className="primary full" onClick={enterTeam}
        disabled={busy || !teamCode.trim()}>
        {busy ? "Connecting…" : "Join team"}
      </button>
      {error && <p className="error">{error}</p>}
      <p className="tiny muted">Your team coordinator provides these codes. Scouts do not need individual accounts.</p>
    </section>
  </main>;

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark small">TG</div>
        <div><b>TURNING GEARS</b><span>FTC SCOUTING</span></div>
      </div>
      <button className="icon-btn" title="Refresh data" onClick={loadTeam}>
        <RefreshCw size={18}/>
      </button>
    </header>

    <main className="content">
      <div className="welcome">
        <div>
          <p className="eyebrow">TEAM SCOUTING HUB</p>
          <h2>{tab === "home" ? "Dashboard" :
            tab === "scout" ? "Match scouting" :
            tab === "records" ? "Submissions" :
            tab === "teams" ? "Team analytics" : "Scout roster"}</h2>
        </div>
        <div className="live"><span/> SHARED DATA</div>
      </div>

      {message && <div className="notice"><CheckCircle2 size={16}/>{message}</div>}
      {error && <div className="errorbox"><AlertCircle size={16}/>{error}</div>}

      {tab === "home" && <>
        <section className="hero-card">
          <div>
            <span className="eyebrow">CURRENT SCOUT</span>
            <h3>{selectedScout || "Choose your name"}</h3>
            <p>Every submission is tagged to your scout name.</p>
          </div>
          <Users size={34} className="hero-icon"/>
          <select value={selectedScout} onChange={e => chooseScout(e.target.value)}>
            <option value="">Select scout name</option>
            {scouts.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          <div className="add-row scout-self-add">
            <input value={newScout} onChange={e => setNewScout(e.target.value)}
              placeholder="New scout? Enter your name" maxLength={40}/>
            <button className="primary" onClick={addScout}
              disabled={busy || !newScout.trim()}><Plus size={18}/> Add name</button>
          </div>
        </section>

        <div className="stats-grid">
          <Stat label="SUBMISSIONS" value={records.length} icon={<ClipboardList/>}/>
          <Stat label="TEAMS SCOUTED" value={teamSummaries.length} icon={<Activity/>}/>
          <Stat label="SCOUTS" value={scouts.length} icon={<Users/>}/>
        </div>

        <div className="section-head"><h3>Quick actions</h3></div>
        <div className="action-grid">
          <button className="action-card" onClick={() => setTab("scout")}>
            <ClipboardList/><b>Match scouting</b><span>Log a team's performance</span>
          </button>
          <button className="action-card" onClick={() => setTab("teams")}>
            <BarChart3/><b>Team analytics</b><span>Compare observed abilities</span>
          </button>
          <button className="action-card" onClick={() => setTab("records")}>
            <Activity/><b>Submissions</b><span>Review scout observations</span>
          </button>
          <button className="action-card" onClick={() => setTab("roster")}>
            <Users/><b>Scout roster</b>
            <span>{isCoordinator ? "Manage scout names" : "View scout names"}</span>
          </button>
        </div>

        <p className="footnote">Match scouting and shared team records are active. Pit scouting, schedule import, and alliance tools are next.</p>
      </>}

      {tab === "scout" && <section className="panel form-panel">
        <div className="form-intro">
          <span className="eyebrow">NEW OBSERVATION</span>
          <h3>Match performance</h3>
          <p className="muted">Rate what the robot can do and how consistently it performs.</p>
        </div>

        <div className="two-col">
          <Field label="Team number">
            <input inputMode="numeric" value={form.team_number}
              onChange={e => setForm({...form, team_number: e.target.value})}
              placeholder="e.g. 12345"/>
          </Field>
          <Field label="Match number">
            <input inputMode="numeric" value={form.match_number}
              onChange={e => setForm({...form, match_number: e.target.value})}
              placeholder="e.g. 8"/>
          </Field>
        </div>

        <Field label="Alliance">
          <div className="segmented">
            <button className={form.alliance === "Red" ? "selected red" : ""}
              onClick={() => setForm({...form, alliance: "Red"})}>Red</button>
            <button className={form.alliance === "Blue" ? "selected blue" : ""}
              onClick={() => setForm({...form, alliance: "Blue"})}>Blue</button>
          </div>
        </Field>

        <div className="rating-list">
          <Rating label="Autonomous performance" value={form.auto_rating}
            onChange={v => setForm({...form, auto_rating: v})}/>
          <Rating label="Shooting accuracy" value={form.shooting_accuracy}
            onChange={v => setForm({...form, shooting_accuracy: v})}/>
          <Rating label="Shooting speed" value={form.shooting_speed}
            onChange={v => setForm({...form, shooting_speed: v})}/>
          <Rating label="Driving speed" value={form.driving_speed}
            onChange={v => setForm({...form, driving_speed: v})}/>
          <Rating label="Maneuverability" value={form.maneuverability}
            onChange={v => setForm({...form, maneuverability: v})}/>
          <Rating label="Mechanical reliability" value={form.reliability}
            onChange={v => setForm({...form, reliability: v})}/>
        </div>

        <div className="two-col">
          <Field label="Number of hive tips (0–10)">
            <input type="number" min="0" max="10" step="1"
              value={form.hive_tips}
              onChange={e => setForm({...form, hive_tips: Number(e.target.value)})}/>
          </Field>
          <Field label="Ranking points earned (0–6)">
            <input type="number" min="0" max="6" step="1"
              value={form.ranking_points}
              onChange={e => setForm({...form, ranking_points: Number(e.target.value)})}/>
          </Field>
        </div>

        <div className="checkbox-list">
          <label className="check-field">
            <input type="checkbox" checked={form.can_shoot_nectar}
              onChange={e => setForm({...form, can_shoot_nectar: e.target.checked})}/>
            <span>Can shoot nectar</span>
          </label>
          <label className="check-field">
            <input type="checkbox" checked={form.refilled_flower}
              onChange={e => setForm({...form, refilled_flower: e.target.checked})}/>
            <span>Refilled flower</span>
          </label>
        </div>

        <Field label="Notes / observations">
          <textarea rows={3} value={form.notes}
            onChange={e => setForm({...form, notes: e.target.value})}
            placeholder="What worked well? Any failures, inconsistency, or partner interaction?"/>
        </Field>

        {!selectedScout &&
          <p className="warning">Choose your scout name on the Dashboard before submitting.</p>}

        <button className="primary full" onClick={submitRecord}
          disabled={busy || !selectedScout}>
          {busy ? "Saving…" : "Save match scouting"}
        </button>
      </section>}

      {tab === "records" && <section className="panel">
        <div className="section-head">
          <h3>Recent submissions</h3>
          <span className="muted tiny">{records.length} records</span>
        </div>

        {records.length === 0 ? <Empty text="No match submissions yet."/> :
          records.map(r => <div className="record" key={r.id}>
            <div className="record-top">
              <b>Team {r.team_number}</b>
              <span className={"alliance " + r.alliance.toLowerCase()}>{r.alliance}</span>
              <span className="muted tiny">Match {r.match_number}</span>
            </div>
            <div className="record-meta">
              Scouted by {r.scout_name} · {new Date(r.created_at).toLocaleString()}
            </div>
            <div className="mini-ratings">
              <span>Auto <b>{r.auto_rating ?? "—"}/5</b></span>
              <span>Shooting <b>{r.shooting_accuracy ?? "—"}/5</b></span>
              <span>Mobility <b>{r.maneuverability ?? "—"}/5</b></span>
              <span>Reliability <b>{r.reliability ?? "—"}/5</b></span>
              <span>Hive tips <b>{r.hive_tips ?? 0}</b></span>
              <span>Ranking points <b>{r.ranking_points ?? 0}</b></span>
              <span>Nectar <b>{r.can_shoot_nectar ? "Yes" : "No"}</b></span>
              <span>Refilled flower <b>{r.refilled_flower ? "Yes" : "No"}</b></span>
            </div>
            {r.notes && <p className="record-notes">{r.notes}</p>}
          </div>)
        }
      </section>}

      {tab === "teams" && <section className="panel">
        <div className="section-head">
          <h3>Team performance snapshot</h3>
          <span className="muted tiny">Average scout ratings</span>
        </div>
        <p className="muted tiny">
          Ratings are averages of submitted 1–5 scores. Ranking points show both
          the total and average earned per observation.
        </p>

        {teamSummaries.length === 0 ? <Empty text="Team analytics will appear after scouts submit matches."/> :
          <div className="team-table">
            <div className="team-row table-head analytics-row">
              <span>TEAM</span>
              <span>OBS.</span>
              <span>AUTO</span>
              <span>SHOOTING</span>
              <span>MOBILITY</span>
              <span>RELIABILITY</span>
              <span>RP TOTAL</span>
              <span>RP AVG.</span>
            </div>
            {teamSummaries.map(t => <div className="team-row analytics-row" key={t.team}>
              <b>#{t.team}</b>
              <span>{t.count}</span>
              <RatingPill value={t.autonomous}/>
              <RatingPill value={t.shooting}/>
              <RatingPill value={t.mobility}/>
              <RatingPill value={t.reliability}/>
              <RatingPill value={t.rankingTotal}/>
              <RatingPill value={t.rankingAverage}/>
            </div>)}
          </div>
        }
      </section>}

      {tab === "roster" && <section className="panel">
        <div className="section-head">
          <h3>Scout roster</h3>
          <span className="muted tiny">{scouts.length} active</span>
        </div>
        <p className="muted">Anyone with team access can add their own name. New names appear for the whole team.</p>
        <div className="add-row">
          <input value={newScout} onChange={e => setNewScout(e.target.value)}
            placeholder="Add your name" maxLength={40}/>
          <button className="primary" onClick={addScout}
            disabled={busy || !newScout.trim()}><Plus size={18}/> Add</button>
        </div>
        {scouts.map(s => <div className="scout-row" key={s.id}>
          <span className="avatar">{s.name.slice(0, 1).toUpperCase()}</span>
          <b>{s.name}</b>
          {isCoordinator &&
            <button className="text-btn" onClick={() => deactivateScout(s.id)}>Remove</button>}
        </div>)}
      </section>}
    </main>

    <nav className="bottom-nav">
      <NavItem active={tab === "home"} icon={<Activity/>} label="Home" onClick={() => setTab("home")}/>
      <NavItem active={tab === "scout"} icon={<ClipboardList/>} label="Scout" onClick={() => setTab("scout")}/>
      <NavItem active={tab === "teams"} icon={<BarChart3/>} label="Teams" onClick={() => setTab("teams")}/>
      <NavItem active={tab === "records"} icon={<Wrench/>} label="Records" onClick={() => setTab("records")}/>
      <NavItem active={tab === "roster"} icon={<Users/>} label="Roster" onClick={() => setTab("roster")}/>
    </nav>
  </div>;
}

function avg(rows: RecordRow[], keys: (keyof RecordRow)[]) {
  const values = rows.flatMap(r =>
    keys.map(key => r[key]).filter((v): v is number => typeof v === "number")
  );
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}

function SetupScreen() {
  return <main className="gate">
    <div className="brand-mark">TG</div>
    <p className="eyebrow">FTC TEAM SCOUTING</p>
    <h1>TURNING GEARS<br/><span>SCOUTING</span></h1>
    <section className="panel gate-panel">
      <h3>Supabase setup needed</h3>
      <p className="muted">The app code is ready, but it needs your Supabase project URL and publishable/anon key.</p>
      <ol className="setup-list">
        <li>Create a Supabase project.</li>
        <li>Run <b>supabase/schema.sql</b> in the SQL Editor.</li>
        <li>Deploy the <b>join-team</b> Edge Function and set its secrets.</li>
        <li>Copy <b>.env.example</b> to <b>.env</b> and add your project values.</li>
      </ol>
      <p className="tiny muted">See README.md for the complete setup instructions. Do not put your service-role key in the app.</p>
    </section>
  </main>;
}

function Stat({label, value, icon}: {
  label: string; value: number; icon: React.ReactNode
}) {
  return <div className="stat">
    <div className="stat-icon">{icon}</div>
    <strong>{value}</strong>
    <span>{label}</span>
  </div>;
}

function Field({label, children}: {
  label: string; children: React.ReactNode
}) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function Rating({label, value, onChange}: {
  label: string; value: number; onChange: (v: number) => void
}) {
  return <div className="rating">
    <span>{label}</span>
    <div className="rating-buttons">
      {[1, 2, 3, 4, 5].map(n =>
        <button key={n} className={value === n ? "on" : ""}
          onClick={() => onChange(n)}>{n}</button>
      )}
    </div>
  </div>;
}

function RatingPill({value}: {value: number | null}) {
  return <span className="rating-pill">
    {value === null ? "—" : Number.isInteger(value) ? value : value.toFixed(1)}
  </span>;
}

function Empty({text}: {text: string}) {
  return <div className="empty">{text}</div>;
}

function NavItem({active, icon, label, onClick}: {
  active: boolean; icon: React.ReactNode; label: string; onClick: () => void
}) {
  return <button className={active ? "nav-item active" : "nav-item"}
    onClick={onClick}>{icon}<span>{label}</span></button>;
}
