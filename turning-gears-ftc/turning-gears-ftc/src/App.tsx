
import { useEffect, useMemo, useState } from "react";
import {
  Activity, Users, ClipboardList, Wrench, BarChart3, Plus,
RefreshCw, CheckCircle2, AlertCircle, Trash2, Pencil
} from "lucide-react";
import { configured, supabase } from "./supabase";

type Scout = { id: string; name: string; active: boolean };

type RecordRow = {
  id: string;
  submitted_by: string;
  team_number: number;
  partner_team_number: number | null;
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
  partner_team_number: "",
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
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
const [editingScoutName, setEditingScoutName] = useState("");
  const [authUserId, setAuthUserId] = useState("");
  const [recordSearch, setRecordSearch] = useState("");
const [recordMatchFilter, setRecordMatchFilter] = useState("");
const [recordAllianceFilter, setRecordAllianceFilter] = useState("All");
  const [recordSort, setRecordSort] = useState("match");
  const [teamSort, setTeamSort] = useState("team-low");
  const [compareTeam1, setCompareTeam1] = useState("");
const [compareTeam2, setCompareTeam2] = useState("");
const [compareTeam3, setCompareTeam3] = useState("");
  const [selectedTeamNumber, setSelectedTeamNumber] = useState<number | null>(null);
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
    setAuthUserId(authData.user?.id || "");
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
  if (!supabase || (!editingRecordId && !selectedScout)) {
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

  if (!Number.isInteger(form.hive_tips) ||
      form.hive_tips < 0 || form.hive_tips > 10) {
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

 const partnerTeam = form.partner_team_number.trim() === ""
  ? null
  : Number(form.partner_team_number);

if (partnerTeam !== null &&
    (!Number.isInteger(partnerTeam) || partnerTeam < 1)) {
  setError("Enter a valid alliance partner team number.");
  setBusy(false);
  return;
}

const recordData = {
    team_number: team,
    partner_team_number: partnerTeam,
    match_number: match,
    alliance: form.alliance,
    scout_name: editingRecordId ? editingScoutName : selectedScout,
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
    notes: form.notes.trim()
};

const saveResult = editingRecordId
    ? await supabase.from("match_records")
        .update(recordData)
        .eq("id", editingRecordId)
        .eq("team_id", teamId)
    : await supabase.from("match_records")
        .insert({
          ...recordData,
          team_id: teamId,
          submitted_by: authData.user.id
        });
  if (saveResult.error) {
    setError(saveResult.error.message);
  } else {
    setMessage(editingRecordId
      ? "Submission successfully updated."
      : "Match scouting saved for the whole team.");

    setForm(emptyForm);
    setEditingRecordId(null);
    setEditingScoutName("");
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
async function editRecord(record: RecordRow) {
  if (!supabase) return;

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;

  if (!isCoordinator && record.submitted_by !== userId) {
    setError("You can only edit your own submissions.");
    return;
  }

  setEditingRecordId(record.id);
  setEditingScoutName(record.scout_name);

  setForm({
    team_number: String(record.team_number),
    partner_team_number: record.partner_team_number
      ? String(record.partner_team_number)
      : "",
    match_number: String(record.match_number),
    alliance: record.alliance,
    auto_rating: record.auto_rating ?? 3,
    shooting_accuracy: record.shooting_accuracy ?? 3,
    shooting_speed: record.shooting_speed ?? 3,
    driving_speed: record.driving_speed ?? 3,
    maneuverability: record.maneuverability ?? 3,
    reliability: record.reliability ?? 3,
    hive_tips: record.hive_tips ?? 0,
    can_shoot_nectar: record.can_shoot_nectar ?? false,
    refilled_flower: record.refilled_flower ?? false,
    ranking_points: record.ranking_points ?? 0,
    notes: record.notes ?? ""
  });

  setMessage("Editing submission for Team " + record.team_number);
  setError("");
  setTab("scout");
}
async function deleteRecord(id: string) {
  if (!supabase || !isCoordinator) {
    setError("Only coordinators can remove submissions.");
    return;
  }

  const confirmed = window.confirm(
    "Are you sure you want to permanently delete this scouting submission?"
  );

  if (!confirmed) return;

  setBusy(true);
  setError("");
  setMessage("");

  const { error: deleteError } = await supabase
    .from("match_records")
    .delete()
    .eq("id", id)
    .eq("team_id", teamId);

  if (deleteError) {
    setError(deleteError.message);
  } else {
    setMessage("Submission successfully removed.");
    await loadTeam();
  }

  setBusy(false);
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
  const sortedTeamSummaries = useMemo(() => {
  return [...teamSummaries].sort((a, b) => {
    if (teamSort === "team-high") {
      return b.team - a.team;
    }

    if (teamSort === "rp-total-low") {
      return a.rankingTotal - b.rankingTotal || a.team - b.team;
    }

    if (teamSort === "rp-total-high") {
      return b.rankingTotal - a.rankingTotal || a.team - b.team;
    }

    if (teamSort === "rp-average-low") {
      return (a.rankingAverage ?? 0) - (b.rankingAverage ?? 0)
        || a.team - b.team;
    }

    if (teamSort === "rp-average-high") {
      return (b.rankingAverage ?? 0) - (a.rankingAverage ?? 0)
        || a.team - b.team;
    }

    return a.team - b.team;
  });
}, [teamSummaries, teamSort]);
  const comparisonTeams = [
  compareTeam1,
  compareTeam2,
  compareTeam3
]
  .filter(Boolean)
  .map(teamNumber =>
    teamSummaries.find(t => String(t.team) === teamNumber)
  )
  .filter((team): team is (typeof teamSummaries)[number] => Boolean(team));
  const selectedTeamRecords = records
  .filter(r => r.team_number === selectedTeamNumber)
  .sort((a, b) => a.match_number - b.match_number);

const selectedTeamSummary = teamSummaries.find(
  t => t.team === selectedTeamNumber
);
  const filteredRecords = useMemo(() => {
  const search = recordSearch.trim().toLowerCase();

  const filtered = records.filter(r => {
    const matchesSearch =
      !search ||
      String(r.team_number).includes(search) ||
      r.scout_name.toLowerCase().includes(search);

    const matchesMatch =
      !recordMatchFilter ||
      String(r.match_number) === recordMatchFilter;

    const matchesAlliance =
      recordAllianceFilter === "All" ||
      r.alliance === recordAllianceFilter;

    return matchesSearch && matchesMatch && matchesAlliance;
  });

  return [...filtered].sort((a, b) => {
    if (recordSort === "ranking") {
      return (b.ranking_points ?? 0) - (a.ranking_points ?? 0);
    }

    if (recordSort === "hive") {
      return (b.hive_tips ?? 0) - (a.hive_tips ?? 0);
    }
if (recordSort === "team-low") {
  return (
    a.team_number - b.team_number ||
    a.match_number - b.match_number
  );
}

if (recordSort === "team-high") {
  return (
    b.team_number - a.team_number ||
    a.match_number - b.match_number
  );
}
    return (
      a.match_number - b.match_number ||
      a.team_number - b.team_number
    );
  });
}, [
  records,
  recordSearch,
  recordMatchFilter,
  recordAllianceFilter,
  recordSort
]);
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
  tab === "teams" ? "Team analytics" :
  tab === "team-detail" ? `Team ${selectedTeamNumber} profile` :
  tab === "compare" ? "Team comparison" : "Scout roster"}</h2>
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
          <h3>{editingRecordId ? "Edit submission" : "Match performance"}</h3>
          <p className="muted">Rate what the robot can do and how consistently it performs.</p>
        </div>

       <div className="two-col">
  <Field label="Team number">
    <input inputMode="numeric" value={form.team_number}
      onChange={e => setForm({...form, team_number: e.target.value})}
      placeholder="e.g. 12345"/>
  </Field>

  <Field label="Alliance partner team number">
    <input inputMode="numeric" value={form.partner_team_number}
      onChange={e => setForm({...form, partner_team_number: e.target.value})}
      placeholder="e.g. 67890"/>
  </Field>
</div>

<Field label="Match number">
  <input inputMode="numeric" value={form.match_number}
    onChange={e => setForm({...form, match_number: e.target.value})}
    placeholder="e.g. 8"/>
</Field>

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

      <div className="two-col">
  <button
    className="primary full"
    onClick={submitRecord}
    disabled={busy || (!selectedScout && !editingRecordId)}
  >
    {busy ? "Saving…" : editingRecordId ? "Save changes" : "Save match scouting"}
  </button>

  {editingRecordId && (
    <button
      className="text-btn"
      onClick={() => {
        setEditingRecordId(null);
        setEditingScoutName("");
        setForm(emptyForm);
        setTab("records");
        setMessage("Editing cancelled.");
      }}
    >
      Cancel editing
    </button>
  )}
</div>
      </section>}

           {tab === "records" && <section className="panel">
             
        <div className="section-head">
          <h3>Recent submissions</h3>
          <span className="muted tiny">
            Showing {filteredRecords.length} of {records.length} records
          </span>
        </div>

        <div className="filter-panel">
          <input
            value={recordSearch}
            onChange={e => setRecordSearch(e.target.value)}
            placeholder="Search team number or scout name..."
          />

          <div className="two-col">
            <input
              type="number"
              min="1"
              value={recordMatchFilter}
              onChange={e => setRecordMatchFilter(e.target.value)}
              placeholder="Filter by match number"
            />

            <select
              value={recordAllianceFilter}
              onChange={e => setRecordAllianceFilter(e.target.value)}
            >
              <option value="All">All alliances</option>
              <option value="Red">Red alliance</option>
              <option value="Blue">Blue alliance</option>
            </select>
          </div>
          <select
            className="sort-select"
            value={recordSort}
            onChange={e => setRecordSort(e.target.value)}
          >
            <option value="match">Sort: Match number (low to high)</option>
            <option value="ranking">Sort: Ranking points (high to low)</option>
            <option value="hive">Sort: Hive tips (high to low)</option>
            <option value="team-low">Sort: Team number (low to high)</option>
            <option value="team-high">Sort: Team number (high to low)</option>
          </select>
          <button
            className="text-btn"
            onClick={() => {
              setRecordSearch("");
              setRecordMatchFilter("");
              setRecordAllianceFilter("All");
              setRecordSort("match");
            }}
          >
            <RefreshCw size={15} /> Reset filters
          </button>
        </div>

        {filteredRecords.length === 0 ? (
          <Empty text={
            records.length === 0
              ? "No match submissions yet."
              : "No submissions match your filters."
          }/>
        ) : filteredRecords.map(r => (
          <div className="record" key={r.id}>
            <div className="record-top">
              <b>Team {r.team_number}</b>
              <span className={"alliance " + r.alliance.toLowerCase()}>{r.alliance}</span>
              <span className="muted tiny">Match {r.match_number}</span>

              {(isCoordinator || r.submitted_by === authUserId) && (
                <button
                  className="text-btn"
                  onClick={() => editRecord(r)}
                  disabled={busy}
                  title="Edit submission"
                >
                  <Pencil size={15} /> Edit
                </button>
              )}

              {isCoordinator && (
                <button
                  className="text-btn"
                  onClick={() => deleteRecord(r.id)}
                  disabled={busy}
                  title="Remove submission"
                >
                  <Trash2 size={15} /> Remove
                </button>
              )}
            </div>

          <div className="record-meta">
  Scouted by {r.scout_name} · {new Date(r.created_at).toLocaleString()}
  <br/>
  Alliance partner: {r.partner_team_number
    ? `Team ${r.partner_team_number}`
    : "Not recorded"}
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
          </div>
        ))}
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
<div className="filter-panel">
  <select
    className="sort-select"
    value={teamSort}
    onChange={e => setTeamSort(e.target.value)}
  >
    <option value="team-low">Sort: Team number (low to high)</option>
    <option value="team-high">Sort: Team number (high to low)</option>
    <option value="rp-total-low">Sort: RP total (low to high)</option>
    <option value="rp-total-high">Sort: RP total (high to low)</option>
    <option value="rp-average-low">Sort: RP average (low to high)</option>
    <option value="rp-average-high">Sort: RP average (high to low)</option>
  </select>
</div>
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
            {sortedTeamSummaries.map(t => <div className="team-row analytics-row" key={t.team}>
             <button
  className="team-number-link"
  onClick={() => {
    setSelectedTeamNumber(t.team);
    setTab("team-detail");
  }}
>
  #{t.team}
</button>
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
      {tab === "team-detail" && selectedTeamNumber !== null && (
  <section className="panel">
    <button className="text-btn" onClick={() => setTab("teams")}>
      ← Back to teams
    </button>

    <div className="section-heading">
      <h3>Team {selectedTeamNumber}</h3>
      <p className="muted">Individual match scouting history</p>
    </div>

    {selectedTeamSummary && (
      <div className="stats-grid">
        <Stat label="Matches scouted" value={selectedTeamSummary.count} />
        <Stat label="Autonomous" value={selectedTeamSummary.autonomous.toFixed(1)} />
        <Stat label="Shooting" value={selectedTeamSummary.shooting.toFixed(1)} />
        <Stat label="Mobility" value={selectedTeamSummary.mobility.toFixed(1)} />
        <Stat label="Reliability" value={selectedTeamSummary.reliability.toFixed(1)} />
        <Stat label="RP total" value={selectedTeamSummary.rpTotal} />
        <Stat label="RP average" value={selectedTeamSummary.rpAverage.toFixed(1)} />
      </div>
    )}

    <h3 className="section-title">Match-by-match history</h3>

    {selectedTeamRecords.length === 0 ? (
      <p className="muted">No scouting records found for this team.</p>
    ) : (
      selectedTeamRecords.map(r => (
        <div className="record" key={r.id}>
          <div className="record-top">
            <b>Match {r.match_number}</b>
            <span className={"alliance " + r.alliance.toLowerCase()}>
              {r.alliance}
            </span>
            <span>Partner: {r.partner_team_number ?? "Not recorded"}</span>
          </div>

          <div className="record-meta">
            Scouted by {r.scout_name} · {new Date(r.created_at).toLocaleString()}
          </div>

          <div className="mini-ratings">
            <span>Auto <b>{r.auto_rating ?? "—"}/5</b></span>
            <span>Shooting accuracy <b>{r.shooting_accuracy ?? "—"}/5</b></span>
            <span>Shooting speed <b>{r.shooting_speed ?? "—"}/5</b></span>
            <span>Driving speed <b>{r.driving_speed ?? "—"}/5</b></span>
            <span>Maneuverability <b>{r.maneuverability ?? "—"}/5</b></span>
            <span>Reliability <b>{r.reliability ?? "—"}/5</b></span>
            <span>Hive tips <b>{r.hive_tips ?? 0}</b></span>
            <span>Can shoot nectar <b>{r.can_shoot_nectar ? "Yes" : "No"}</b></span>
            <span>Refilled flower <b>{r.refilled_flower ? "Yes" : "No"}</b></span>
            <span>Ranking points <b>{r.ranking_points ?? 0}</b></span>
          </div>

          {r.notes && (
            <p className="record-notes">{r.notes}</p>
          )}
        </div>
      ))
    )}
  </section>
)}
{tab === "compare" && <section className="panel">
  <div className="section-head">
    <h3>Team comparison</h3>
    <span className="muted tiny">Compare up to 3 teams</span>
  </div>

  <p className="muted tiny">
    Select two or three teams to compare their scouting performance side by side.
  </p>

  <div className="compare-selectors">
    <label className="field">
      <span>Team 1</span>
      <select
        value={compareTeam1}
        onChange={e => setCompareTeam1(e.target.value)}
      >
        <option value="">Choose team</option>
        {teamSummaries.map(t => (
          <option
            key={t.team}
            value={String(t.team)}
            disabled={[compareTeam2, compareTeam3].includes(String(t.team))}
          >
            Team {t.team}
          </option>
        ))}
      </select>
    </label>

    <label className="field">
      <span>Team 2</span>
      <select
        value={compareTeam2}
        onChange={e => setCompareTeam2(e.target.value)}
      >
        <option value="">Choose team</option>
        {teamSummaries.map(t => (
          <option
            key={t.team}
            value={String(t.team)}
            disabled={[compareTeam1, compareTeam3].includes(String(t.team))}
          >
            Team {t.team}
          </option>
        ))}
      </select>
    </label>

    <label className="field">
      <span>Team 3 (optional)</span>
      <select
        value={compareTeam3}
        onChange={e => setCompareTeam3(e.target.value)}
      >
        <option value="">Choose team</option>
        {teamSummaries.map(t => (
          <option
            key={t.team}
            value={String(t.team)}
            disabled={[compareTeam1, compareTeam2].includes(String(t.team))}
          >
            Team {t.team}
          </option>
        ))}
      </select>
    </label>
  </div>

  {comparisonTeams.length < 2 ? (
    <Empty text="Choose at least two different teams to start comparing."/>
  ) : (
    <div className="comparison-grid">
      {comparisonTeams.map(t => (
        <div className="comparison-card" key={t.team}>
          <div className="comparison-card-head">
            <span className="eyebrow">TEAM</span>
            <h3>#{t.team}</h3>
            <span className="muted tiny">
              {t.count} observations
            </span>
          </div>

          <div className="comparison-stat">
            <span>Autonomous</span>
            <RatingPill value={t.autonomous}/>
          </div>

          <div className="comparison-stat">
            <span>Shooting</span>
            <RatingPill value={t.shooting}/>
          </div>

          <div className="comparison-stat">
            <span>Mobility</span>
            <RatingPill value={t.mobility}/>
          </div>

          <div className="comparison-stat">
            <span>Reliability</span>
            <RatingPill value={t.reliability}/>
          </div>

          <div className="comparison-stat">
            <span>RP Total</span>
            <RatingPill value={t.rankingTotal}/>
          </div>

          <div className="comparison-stat">
            <span>RP Average</span>
            <RatingPill value={t.rankingAverage}/>
          </div>
        </div>
      ))}
    </div>
  )}

  <button
    className="text-btn"
    onClick={() => {
      setCompareTeam1("");
      setCompareTeam2("");
      setCompareTeam3("");
    }}
  >
    <RefreshCw size={15}/> Clear comparison
  </button>
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
      <NavItem active={tab === "teams" || tab === "team-detail"} icon={<BarChart3/>} label="Teams" onClick={() => setTab("teams")}/>
      <NavItem active={tab === "compare"} icon={<Activity/>} label="Compare" onClick={() => setTab("compare")}/>
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
