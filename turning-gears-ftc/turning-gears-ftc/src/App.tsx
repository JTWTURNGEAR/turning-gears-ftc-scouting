
import { useEffect, useMemo, useState } from "react";
import {
  Activity, House, Users, ClipboardList, Wrench, BarChart3, Plus,
  RefreshCw, CheckCircle2, AlertCircle, Trash2, Pencil, CalendarDays
} from "lucide-react";
import { configured, supabase } from "./supabase";

type ScoutGroup =
  | "Scouting Coach"
  | "Parent Scout"
  | "Student Scout";

type Scout = {
  id: string;
  name: string;
  active: boolean;
  scout_group: ScoutGroup | null;
};
type EventRow = {
  id: string;
  event_name: string;
  event_date: string | null;
};
type EventMatch = {
  id: string;
  event_id: string;
  match_number: number;
  match_type: string;
  red_team_1: number;
  red_team_2: number;
  blue_team_1: number;
  blue_team_2: number;
  imported_time: string | null;
  manual_offset_minutes: number;
  manual_time_override: string | null;
  red_score: number | null;
  blue_score: number | null;
  completed: boolean;
};
type RecordRow = {
  id: string;
  submitted_by: string;
  team_number: number;
  partner_team_number: number | null;
  match_number: number;
  alliance: string;
  scout_name: string;
  scout_group: ScoutGroup | null;
  created_at: string;
  auto_rating: number | null;
  shooting_accuracy: number | null;
  shooting_speed: number | null;
  driving_speed: number | null;
  maneuverability: number | null;
  reliability: number | null;
  hive_tips: number;
  auto_hive_tips: number;
  teleop_hive_tips: number;
  can_shoot_nectar: boolean;
  refilled_flower: boolean;
  emptied_flower: boolean;
  ranking_points: number;
  red_final_score: number;
  blue_final_score: number;
  notes: string | null;
};
type GeneralNoteRow = {
  id: string;
  submitted_by: string;
  team_number: number;
  scout_name: string;
  scout_group: ScoutGroup;
  notes: string;
  created_at: string;
};
type FilteredRecordItem =
  | { submissionType: "match"; record: RecordRow }
  | { submissionType: "note"; record: GeneralNoteRow };
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
auto_hive_tips: 0,
teleop_hive_tips: 0,
  can_shoot_nectar: false,
  refilled_flower: false,
 emptied_flower: false,
  ranking_points: 0,
red_final_score: 0,
blue_final_score: 0,
notes: ""
};

export default function App() {
  const [sessionReady, setSessionReady] = useState(false);
  const [joined, setJoined] = useState(false);
  const [tab, setTab] = useState("home");
  const [scoutMode, setScoutMode] = useState<"match" | "notes">("match");
const [noteTeamNumber, setNoteTeamNumber] = useState("");
const [noteText, setNoteText] = useState("");
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [selectedScout, setSelectedScout] = useState(
    () => localStorage.getItem("tg-selected-scout") || ""
  );
  const [teamId, setTeamId] = useState("");
    const [events, setEvents] = useState<EventRow[]>([]);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [activeEventId, setActiveEventId] = useState("");
  const [eventMatches, setEventMatches] = useState<EventMatch[]>([]);
    const [teamListText, setTeamListText] = useState("");
  const [scheduleText, setScheduleText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [generalNotes, setGeneralNotes] = useState<GeneralNoteRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [teamCode, setTeamCode] = useState("");
  const [coordinatorCode, setCoordinatorCode] = useState("");
  const [newScout, setNewScout] = useState("");
  const [newScoutGroup, setNewScoutGroup] = useState<ScoutGroup | "">("");
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
const [editingScoutName, setEditingScoutName] = useState("");
  const [authUserId, setAuthUserId] = useState("");
  const [recordSearch, setRecordSearch] = useState("");
  const [recordTypeFilter, setRecordTypeFilter] = useState<
  "Both" | "Match Records" | "General Notes"
>("Both");
  const [selectedScoutGroups, setSelectedScoutGroups] = useState<ScoutGroup[]>([]);
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
  const [adjustmentStartMatchId, setAdjustmentStartMatchId] = useState("");
const [adjustmentMinutes, setAdjustmentMinutes] = useState(5);
  const [error, setError] = useState("");
    const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockNow(Date.now());
    }, 15000);

    return () => window.clearInterval(timer);
  }, []);
useEffect(() => {
  const client = supabase;

  if (!client || !activeEventId || !joined) return;

  const channel = client
    .channel(`event-matches-${activeEventId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "event_matches",
        filter: `event_id=eq.${activeEventId}`
      },
      () => {
        loadEventMatches(activeEventId);
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}, [activeEventId, joined]);
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
  async function loadEventMatches(eventId: string) {
    if (!supabase || !eventId) {
      setEventMatches([]);
      return;
    }

    const { data, error: matchError } = await supabase
      .from("event_matches")
      .select("*")
      .eq("event_id", eventId)
      .order("imported_time", { ascending: true, nullsFirst: false })
.order("match_number", { ascending: true });

    if (matchError) {
      setError(matchError.message);
      return;
    }

    setEventMatches((data || []) as EventMatch[]);
  }
  async function loadTeam() {
    if (!supabase) return;

    const { data: authData } = await supabase.auth.getUser();
    setAuthUserId(authData.user?.id || "");

    const [
  { data: scoutData, error: scoutError },
  { data: recordData, error: recordError },
  { data: noteData, error: noteError },
  { data: memberData },
  { data: eventData }
] = await Promise.all([
  supabase.from("scouts")
    .select("id,name,active,scout_group")
    .eq("active", true)
    .order("name"),

  supabase.from("match_records")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(250),

  supabase.from("general_notes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(250),

  supabase.from("team_members")
    .select("role,team_id")
    .eq("user_id", authData.user?.id || "")
    .limit(1)
    .maybeSingle(),

  supabase.from("events")
    .select("id,event_name,event_date")
    .order("created_at", { ascending: false })
]);

    setIsCoordinator(memberData?.role === "coordinator");
    setTeamId(memberData?.team_id || "");

   if (scoutError || recordError || noteError) {
  setError(
    scoutError?.message ||
    recordError?.message ||
    noteError?.message ||
    "Could not load team data."
  );
  return;
}

    setScouts(scoutData || []);
    const loadedEvents = (eventData || []) as EventRow[];
    setEvents(loadedEvents);

    if (loadedEvents.length > 0) {
      setActiveEventId(loadedEvents[0].id);
      await loadEventMatches(loadedEvents[0].id);
    }
    setRecords((recordData || []) as RecordRow[]);
    setGeneralNotes((noteData || []) as GeneralNoteRow[]);
    setJoined(true);
    setError("");
  }
 function parseTeamList(text: string) {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      // Ignore FTC headings such as "Match Participants 29"
      if (/^Match Participants/i.test(line)) return null;

      let parts: string[];

      if (line.includes("\t")) {
        parts = line.split("\t").map(part => part.trim());
      } else if (line.includes(",")) {
        parts = line.split(",").map(part => part.trim());
      } else {
        const match = line.match(/^(\d+)\s+(.+)$/);
        if (!match) return null;
        parts = [match[1], match[2].trim()];
      }

      const teamNumber = Number(parts[0]);
      const teamName = parts[1];

      if (!Number.isInteger(teamNumber) || teamNumber <= 0 || !teamName) {
        return null;
      }

      return {
        team_number: teamNumber,
        team_name: teamName
      };
    })
    .filter((team): team is {
      team_number: number;
      team_name: string;
    } => team !== null);
} 
  
  function parseSchedule(text: string, year?: number) {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const matches: {
    match_type: string;
    match_number: number;
    red_team_1: number;
    red_team_2: number;
    blue_team_1: number;
    blue_team_2: number;
    imported_time?: string;
    red_score?: number;
    blue_score?: number;
  }[] = [];

  const headers = /^(Qualification|Playoff|Semifinal|Final)\s+(\d+)$/i;

  for (let i = 0; i < lines.length; i++) {
    const header = lines[i].match(headers);
    if (!header) continue;

    const matchType =
      header[1].charAt(0).toUpperCase() +
      header[1].slice(1).toLowerCase();

    const matchNumber = Number(header[2]);

    const nextHeader = lines.findIndex(
      (line, index) => index > i && headers.test(line)
    );

    const block = lines.slice(
      i + 1,
      nextHeader === -1 ? lines.length : nextHeader
    );

    let importedTime: string | undefined;

    for (const line of block) {
      const timeMatch = line.match(
        /(?:\w{3}\s+)?(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i
      );

      if (timeMatch) {
        const month = Number(timeMatch[1]) - 1;
        const day = Number(timeMatch[2]);
        let hour = Number(timeMatch[3]);
        const minute = Number(timeMatch[4]);
        const ampm = timeMatch[5].toUpperCase();

        if (ampm === "PM" && hour !== 12) hour += 12;
        if (ampm === "AM" && hour === 12) hour = 0;

        const date = new Date(
          year || new Date().getFullYear(),
          month,
          day,
          hour,
          minute
        );

        importedTime = date.toISOString();
        break;
      }
    }

    const numbers = block
      .filter(line => /^\d+$/.test(line))
      .map(Number);

    if (numbers.length < 4) continue;

    const match: {
      match_type: string;
      match_number: number;
      red_team_1: number;
      red_team_2: number;
      blue_team_1: number;
      blue_team_2: number;
      imported_time?: string;
      red_score?: number;
      blue_score?: number;
    } = {
      match_type: matchType,
      match_number: matchNumber,
      red_team_1: numbers[0],
      red_team_2: numbers[1],
      blue_team_1: numbers[2],
      blue_team_2: numbers[3]
    };

    if (importedTime) match.imported_time = importedTime;

    if (numbers.length >= 6) {
      match.red_score = numbers[4];
      match.blue_score = numbers[5];
    }

    matches.push(match);
  }

  return matches;
}
  async function createEvent() {
    if (!supabase || !teamId || !eventName.trim()) {
      setError("Enter an event name first.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    const { data, error: createError } = await supabase
      .from("events")
      .insert({
        team_id: teamId,
        event_name: eventName.trim(),
        event_date: eventDate || null
      })
      .select("id,event_name,event_date")
      .single();

    if (createError) {
      setError(createError.code === "23505"
        ? "An event with that name already exists."
        : createError.message);
    } else {
      setEvents(previous => [data as EventRow, ...previous]);
      setActiveEventId(data.id);
      setEventName("");
      setEventDate("");
      setMessage("Event created successfully.");
    }

    setBusy(false);
  }
  async function applyScheduleAdjustment() {
  if (!supabase || !isCoordinator || !activeEventId) return;

  const startIndex = eventMatches.findIndex(
    match => match.id === adjustmentStartMatchId
  );

  if (startIndex < 0 || adjustmentMinutes === 0) {
    setError("Select a starting match and a non-zero time adjustment.");
    return;
  }

  const matchesToAdjust = eventMatches.slice(startIndex);

  const confirmed = window.confirm(
    `Apply ${adjustmentMinutes > 0 ? "+" : ""}${adjustmentMinutes} minutes to ${matchesToAdjust.length} matches, starting with ${matchesToAdjust[0].match_type} ${matchesToAdjust[0].match_number}?`
  );

  if (!confirmed) return;

  setBusy(true);
  setError("");
  setMessage("");

  for (const match of matchesToAdjust) {
    const { error: updateError } = await supabase
      .from("event_matches")
      .update({
        manual_offset_minutes:
          (match.manual_offset_minutes || 0) + adjustmentMinutes
      })
      .eq("id", match.id);

    if (updateError) {
      setError(`Schedule adjustment stopped: ${updateError.message}`);
      setBusy(false);
      await loadEventMatches(activeEventId);
      return;
    }
  }

  await loadEventMatches(activeEventId);

  setMessage(
    `Successfully adjusted ${matchesToAdjust.length} matches.`
  );
  setBusy(false);
}
  async function deleteEvent(eventId: string) {
  if (!supabase || !teamId || !isCoordinator) return;

  const event = events.find(ev => ev.id === eventId);
  if (!event) return;

  const confirmed = window.confirm(
    `Remove "${event.event_name}" and all its imported teams and matches? This cannot be undone.`
  );

  if (!confirmed) return;

  setBusy(true);
  setError("");
  setMessage("");

  const { error: matchError } = await supabase
    .from("event_matches")
    .delete()
    .eq("event_id", eventId);

  if (matchError) {
    setError(matchError.message);
    setBusy(false);
    return;
  }

  const { error: teamError } = await supabase
    .from("event_teams")
    .delete()
    .eq("event_id", eventId);

  if (teamError) {
    setError(teamError.message);
    setBusy(false);
    return;
  }

  const { error: eventError } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("team_id", teamId);

  if (eventError) {
    setError(eventError.message);
    setBusy(false);
    return;
  }

  setEvents(previous => previous.filter(ev => ev.id !== eventId));

  if (activeEventId === eventId) {
    setActiveEventId("");
    setEventMatches([]);
  }

  setMessage("Event removed successfully.");
  setBusy(false);
}
  async function importEventData() {
    if (!supabase || !activeEventId) {
      setError("Select an event before importing.");
      return;
    }

    const importedTeams = parseTeamList(teamListText);
    const importedMatches = parseSchedule(
      scheduleText,
      Number(
        events.find(ev => ev.id === activeEventId)?.event_date?.slice(0, 4)
      ) || new Date().getFullYear()
    );

    if (importedTeams.length === 0 && importedMatches.length === 0) {
      setError("No valid teams or matches found. Check the pasted information.");
      return;
    }

    setImportBusy(true);
    setError("");
    setMessage("");

    try {
      if (importedTeams.length > 0) {
        const { error: teamError } = await supabase
          .from("event_teams")
          .upsert(
            importedTeams.map(team => ({
              event_id: activeEventId,
              ...team
            })),
            { onConflict: "event_id,team_number" }
          );

        if (teamError) throw teamError;
      }

      if (importedMatches.length > 0) {
        const { data: existingMatches, error: existingError } =
          await supabase
            .from("event_matches")
            .select("*")
            .eq("event_id", activeEventId);

        if (existingError) throw existingError;

        const existingMap = new Map(
          (existingMatches || []).map(match => [
            `${match.match_type}-${match.match_number}`,
            match
          ])
        );

        const rows = importedMatches.map(match => {
          const existing = existingMap.get(
            `${match.match_type}-${match.match_number}`
          );

          return {
            event_id: activeEventId,
            ...match,
            imported_time:
              match.imported_time ?? existing?.imported_time ?? null,
            red_score:
              match.red_score ?? existing?.red_score ?? null,
            blue_score:
              match.blue_score ?? existing?.blue_score ?? null,
            completed:
              match.red_score !== undefined &&
              match.blue_score !== undefined
                ? true
                : existing?.completed ?? false
          };
        });

        const { error: matchError } = await supabase
          .from("event_matches")
          .upsert(rows, {
            onConflict: "event_id,match_type,match_number"
          });

        if (matchError) throw matchError;
      }

      setMessage(
        `Import successful: ${importedTeams.length} teams and ${importedMatches.length} matches processed.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong during import."
      );
    }

    setImportBusy(false);
  }
  // Your next existing function continues here
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

 
async function submitGeneralNote() {
  if (!supabase || !selectedScout || !teamId) {
    setError("Choose your scout name first.");
    return;
  }

  const selectedScoutRow = scouts.find(
    s => s.name === selectedScout
  );

  if (!selectedScoutRow?.scout_group) {
    setError("Your scout needs a group assigned before submitting.");
    return;
  }

  const team = Number(noteTeamNumber);
  const cleanNotes = noteText.trim();

  if (!Number.isInteger(team) || team < 1) {
    setError("Enter a valid team number.");
    return;
  }

  if (!cleanNotes) {
    setError("Please enter your observation notes.");
    return;
  }

  setBusy(true);
  setError("");
  setMessage("");

  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    setError("Your team session needs to be refreshed.");
    setBusy(false);
    return;
  }

  const { error: noteError } = await supabase
    .from("general_notes")
    .insert({
      team_id: teamId,
      submitted_by: authData.user.id,
      scout_name: selectedScout,
      scout_group: selectedScoutRow.scout_group,
      team_number: team,
      notes: cleanNotes
    });

  if (noteError) {
    setError(noteError.message);
  } else {
    setNoteTeamNumber("");
    setNoteText("");
    setMessage("General notes saved for the whole team.");
    await loadTeam();
    setTab("records");
  }

  setBusy(false);
}

async function submitRecord() {
  if (!supabase || (!editingRecordId && !selectedScout)) {
    setError("Choose your scout name first.");
    return;
  }

  const existingRecord = editingRecordId
    ? records.find(r => r.id === editingRecordId)
    : undefined;

  const selectedScoutRow = scouts.find(
    s => s.name === (editingRecordId ? editingScoutName : selectedScout)
  );

  const scoutGroup = editingRecordId
    ? existingRecord?.scout_group ?? null
    : selectedScoutRow?.scout_group ?? null;

  if (!editingRecordId && !scoutGroup) {
    setError("Your scout name needs a group assigned before submitting.");
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

  if (
    !Number.isInteger(form.auto_hive_tips) ||
    form.auto_hive_tips < 0 ||
    !Number.isInteger(form.teleop_hive_tips) ||
    form.teleop_hive_tips < 0
  ) {
    setError("Auto and TeleOp hive tips must be whole numbers of 0 or more.");
    return;
  }

  if (form.auto_hive_tips + form.teleop_hive_tips > form.hive_tips) {
    setError("Auto and TeleOp hive tips cannot add up to more than Total Hive Tips.");
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
  scout_group: scoutGroup,
  auto_rating: form.auto_rating,
  shooting_accuracy: form.shooting_accuracy,
  shooting_speed: form.shooting_speed,
  driving_speed: form.driving_speed,
  maneuverability: form.maneuverability,
  reliability: form.reliability,
  hive_tips: form.hive_tips,
  auto_hive_tips: form.auto_hive_tips,
  teleop_hive_tips: form.teleop_hive_tips,
  can_shoot_nectar: form.can_shoot_nectar,
  refilled_flower: form.refilled_flower,
  emptied_flower: form.emptied_flower,
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

  if (!newScoutGroup) {
    setError("Please select a scout group.");
    return;
  }

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
    .insert({
      team_id: teamId,
      name: cleanName,
      scout_group: newScoutGroup
    })
    .select("id,name,active,scout_group")
    .single();

  if (insertError) {
    setError(
      insertError.code === "23505"
        ? "That name is already on the list. Select it instead."
        : insertError.message
    );
  } else {
    setNewScout("");
    setNewScoutGroup("");
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
    auto_hive_tips: record.auto_hive_tips ?? 0,
teleop_hive_tips: record.teleop_hive_tips ?? 0,
    can_shoot_nectar: record.can_shoot_nectar ?? false,
    refilled_flower: record.refilled_flower ?? false,
     ranking_points: record.ranking_points ?? 0,
    red_final_score: record.red_final_score ?? 0,
    blue_final_score: record.blue_final_score ?? 0,
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
    const filteredRecords = records.filter(r =>
      selectedScoutGroups.length === 0 ||
      (r.scout_group !== null &&
        selectedScoutGroups.includes(r.scout_group))
    );

    const grouped = new Map<number, RecordRow[]>();

    filteredRecords.forEach(r => {
      grouped.set(r.team_number, [
        ...(grouped.get(r.team_number) || []),
        r
      ]);
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
        rankingTotal: rows.reduce(
          (sum, r) => sum + (r.ranking_points || 0), 0
        ),
        rankingAverage: rows.length
          ? rows.reduce(
              (sum, r) => sum + (r.ranking_points || 0), 0
            ) / rows.length
          : null
      }));
  }, [records, selectedScoutGroups]);

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
  .filter(r =>
    r.team_number === selectedTeamNumber &&
    (
      selectedScoutGroups.length === 0 ||
      (r.scout_group !== null &&
        selectedScoutGroups.includes(r.scout_group))
    )
  )
  .sort((a, b) => a.match_number - b.match_number);


const selectedTeamSummary = teamSummaries.find(
  t => t.team === selectedTeamNumber
);
  const scheduledMatches = useMemo(() => {
  return eventMatches
    .map(match => {
      const time = match.manual_time_override
        ? new Date(match.manual_time_override).getTime()
        : match.imported_time
          ? new Date(match.imported_time).getTime() +
            match.manual_offset_minutes * 60000
          : null;

      return { ...match, scheduledTime: time };
    })
    .sort((a, b) =>
      (a.scheduledTime ?? Infinity) - (b.scheduledTime ?? Infinity)
    );
}, [eventMatches]);

const currentMatch = [...scheduledMatches].reverse().find(match =>
  !match.completed &&
  match.scheduledTime !== null &&
  match.scheduledTime <= clockNow
);

const nextMatch = scheduledMatches.find(match =>
  !match.completed &&
  match.scheduledTime !== null &&
  match.scheduledTime > clockNow
);

const currentMatchTeams = currentMatch
  ? [
      currentMatch.red_team_1,
      currentMatch.red_team_2,
      currentMatch.blue_team_1,
      currentMatch.blue_team_2
    ]
  : [];

const futureRelatedTeams = new Set(
  scheduledMatches
    .filter(match => !match.completed)
    .filter(match =>
      !currentMatch || match.id !== currentMatch.id
    )
    .filter(match => [
      match.red_team_1,
      match.red_team_2,
      match.blue_team_1,
      match.blue_team_2
    ].includes(7215))
    .flatMap(match => [
      match.red_team_1,
      match.red_team_2,
      match.blue_team_1,
      match.blue_team_2
    ])
    .filter(team => team !== 7215)
);
 
const filteredRecords = useMemo(() => {
  const search = recordSearch.trim().toLowerCase();

  const matchRecords: FilteredRecordItem[] =
    recordTypeFilter !== "General Notes"
      ? records.map(r => ({
          submissionType: "match",
          record: r
        }))
      : [];

  const noteRecords: FilteredRecordItem[] =
    recordTypeFilter !== "Match Records"
      ? generalNotes.map(n => ({
          submissionType: "note",
          record: n
        }))
      : [];

  const combined: FilteredRecordItem[] = [
    ...matchRecords,
    ...noteRecords
  ];

 
const filtered = combined.filter(item => {
    const scoutGroup = item.record.scout_group;

    const matchesGroup =
      selectedScoutGroups.length === 0 ||
      (scoutGroup !== null &&
        selectedScoutGroups.includes(scoutGroup));

    if (!matchesGroup) return false;

    if (item.submissionType === "note") {
      const n = item.record;

      return (
        !search ||
        String(n.team_number).includes(search) ||
        n.scout_name.toLowerCase().includes(search) ||
        n.notes.toLowerCase().includes(search)
      );
    }

    const r = item.record;

    return (
      (!search ||
        String(r.team_number).includes(search) ||
        r.scout_name.toLowerCase().includes(search) ||
        (r.notes || "").toLowerCase().includes(search)) &&
      (!recordMatchFilter ||
        String(r.match_number) === recordMatchFilter) &&
      (recordAllianceFilter === "All" ||
        r.alliance === recordAllianceFilter)
    );
  });

  return [...filtered].sort((a, b) => {
    if (recordSort === "team-low") {
      return a.record.team_number - b.record.team_number;
    }

    if (recordSort === "team-high") {
      return b.record.team_number - a.record.team_number;
    }

    if (recordSort === "ranking") {
      const aValue =
        a.submissionType === "match"
          ? a.record.ranking_points ?? 0
          : 0;
      const bValue =
        b.submissionType === "match"
          ? b.record.ranking_points ?? 0
          : 0;
      return bValue - aValue;
    }

    if (recordSort === "hive") {
      const aValue =
        a.submissionType === "match"
          ? a.record.hive_tips ?? 0
          : 0;
      const bValue =
        b.submissionType === "match"
          ? b.record.hive_tips ?? 0
          : 0;
      return bValue - aValue;
    }

    const aMatch =
      a.submissionType === "match"
        ? a.record.match_number
        : Infinity;
    const bMatch =
      b.submissionType === "match"
        ? b.record.match_number
        : Infinity;

    return aMatch - bMatch ||
      a.record.team_number - b.record.team_number;
  });
}, [
  records,
  generalNotes,
  recordSearch,
  recordMatchFilter,
  recordAllianceFilter,
  recordSort,
  recordTypeFilter,
  selectedScoutGroups
]);
 function openTeamProfile(team: number) {
  setSelectedTeamNumber(team);
  setTab("team-detail");
}

function allianceTeamButton(team: number, alliance: "red" | "blue") {
  const isOurTeam = team === 7215;
  const isRelated = futureRelatedTeams.has(team);

  return (
    <button
      type="button"
      key={team}
      className={`alliance-team ${alliance} ${
        isOurTeam ? "our-team" : ""
      } ${isRelated ? "related-team" : ""}`}
      onClick={() => openTeamProfile(team)}
    >
      {isOurTeam ? "⭐ " : ""}
      {team}
    </button>
  );
}
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
  tab === "schedule" ? "Event Schedule" :
tab === "event-manager" ? "Event Manager" :
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

  <select
    value={newScoutGroup}
    onChange={e => setNewScoutGroup(e.target.value as ScoutGroup | "")}
  >
    <option value="">Select scout group</option>
    <option value="Scouting Coach">Scouting Coach</option>
    <option value="Parent Scout">Parent Scout</option>
    <option value="Student Scout">Student Scout</option>
  </select>

  <button className="primary" onClick={addScout}
    disabled={busy || !newScout.trim() || !newScoutGroup}>
    <Plus size={18}/> Add name
  </button>
</div>

        </section>
        <section className="panel live-match-panel">
          <div className="section-head">
            <h3>🏁 Live Match Tracker</h3>
            <span className="live">SCHEDULE BASED</span>
          </div>
<div className="match-legend">
  <strong>QUICK COLOR GUIDE</strong>
  <div>🟡 <b>Gold outline:</b> Future partner or opponent</div>
  <div>⭐ <b>7215:</b> Our team</div>
  <div>🔴 <b>Red glow:</b> Red alliance</div>
  <div>🔵 <b>Blue glow:</b> Blue alliance</div>
  <div>Normal box: No identified future connection</div>
</div>
          {!activeEventId ? (
            <Empty text="No event selected." />
          ) : eventMatches.length === 0 ? (
            <Empty text="No matches have been imported yet." />
          ) : (
            <>
              {currentMatch && (
                <div className="live-match-card">
                  <span className="eyebrow">CURRENTLY SCHEDULED</span>
                  <h3>
                    {currentMatch.match_type} {currentMatch.match_number}
                  </h3>
                  <p className="muted">Scheduled start time has passed.</p>

                  <div className="alliance-display">
                    <div className="alliance-group">
                      <b className="red-label">🔴 RED ALLIANCE</b>
                      <div className="alliance-team-row">
                        {allianceTeamButton(currentMatch.red_team_1, "red")}
                        {allianceTeamButton(currentMatch.red_team_2, "red")}
                      </div>
                      {currentMatch.red_score !== null && (
                        <span>Score: {currentMatch.red_score}</span>
                      )}
                    </div>

                    <div className="alliance-group">
                      <b className="blue-label">🔵 BLUE ALLIANCE</b>
                      <div className="alliance-team-row">
                        {allianceTeamButton(currentMatch.blue_team_1, "blue")}
                        {allianceTeamButton(currentMatch.blue_team_2, "blue")}
                      </div>
                      {currentMatch.blue_score !== null && (
                        <span>Score: {currentMatch.blue_score}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {nextMatch && (
                <div className="live-match-card">
                  <span className="eyebrow">
                    {currentMatch ? "UP NEXT" : "NEXT SCHEDULED MATCH"}
                  </span>
                  <h3>
                    {nextMatch.match_type} {nextMatch.match_number}
                  </h3>

                  <p className="muted">
                    {new Date(nextMatch.scheduledTime!).toLocaleString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit"
                    })}
                  </p>

                  <p className="match-countdown">
                    Starts in{" "}
                    {Math.floor(
                      Math.max(0, nextMatch.scheduledTime! - clockNow) / 60000
                    )}{" "}
                    minutes
                  </p>

                  <div className="alliance-display">
                    <div className="alliance-group">
                      <b className="red-label">🔴 RED ALLIANCE</b>
                      <div className="alliance-team-row">
                        {allianceTeamButton(nextMatch.red_team_1, "red")}
                        {allianceTeamButton(nextMatch.red_team_2, "red")}
                      </div>
                    </div>

                    <div className="alliance-group">
                      <b className="blue-label">🔵 BLUE ALLIANCE</b>
                      <div className="alliance-team-row">
                        {allianceTeamButton(nextMatch.blue_team_1, "blue")}
                        {allianceTeamButton(nextMatch.blue_team_2, "blue")}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!currentMatch && !nextMatch && (
                <Empty text="No upcoming matches. All imported matches may be completed or missing times." />
              )}
            </>
          )}
        </section>
        <div className="stats-grid">
          <Stat label="SUBMISSIONS" value={records.length} icon={<ClipboardList/>}/>
          <Stat label="TEAMS SCOUTED" value={teamSummaries.length} icon={<Activity/>}/>
          <Stat label="SCOUTS" value={scouts.length} icon={<Users/>}/>
        </div>

        <div className="section-head"><h3>Quick actions</h3></div>
               <div className="action-grid">
          {isCoordinator && (
            <button className="action-card" onClick={() => setTab("event-manager")}>
              <CalendarDays/>
              <b>Event Manager</b>
              <span>Create and manage event schedules</span>
            </button>
          )}

          <button
            className="action-card"
            onClick={() => setTab("schedule")}
          >
            <CalendarDays />
            <b>Event Schedule</b>
            <span>View matches, alliances, and scores</span>
          </button>
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
      {tab === "schedule" && (
        <section className="panel">
          <div className="section-head">
            <h3>Match Schedule</h3>
            <span>{eventMatches.length} matches</span>
          </div>
{isCoordinator && activeEventId && eventMatches.length > 0 && (
  <div className="panel">
    <h3>Adjust Schedule Times</h3>
    <p className="muted">
      Choose a starting match, then shift that match and all later matches.
      Use a negative number to reduce a previous delay.
    </p>

    <Field label="Starting match">
      <select
        value={adjustmentStartMatchId}
        onChange={e => setAdjustmentStartMatchId(e.target.value)}
      >
        <option value="">Choose a match...</option>
        {eventMatches.map(match => (
          <option key={match.id} value={match.id}>
            {match.match_type} {match.match_number}
          </option>
        ))}
      </select>
    </Field>

    <Field label="Minutes to add or subtract">
      <input
        type="number"
        value={adjustmentMinutes}
        onChange={e => setAdjustmentMinutes(Number(e.target.value))}
      />
    </Field>

    <button
      className="primary full"
      onClick={applyScheduleAdjustment}
      disabled={busy || !adjustmentStartMatchId || adjustmentMinutes === 0}
    >
      {busy ? "Adjusting..." : "Apply Schedule Adjustment"}
    </button>
  </div>
)}
          {!activeEventId ? (
            <Empty text="No event selected yet." />
          ) : eventMatches.length === 0 ? (
            <Empty text="No matches have been imported for this event yet." />
          ) : (
            eventMatches.map(match => {
              const matchTime = match.manual_time_override
                ? new Date(match.manual_time_override)
                : match.imported_time
                  ? new Date(
                      new Date(match.imported_time).getTime() +
                      match.manual_offset_minutes * 60000
                    )
                  : null;

              const teams = [
  match.red_team_1,
  match.red_team_2,
  match.blue_team_1,
  match.blue_team_2
];

const hasScores =
  match.red_score !== null && match.blue_score !== null;

const isTie =
  hasScores && match.red_score === match.blue_score;

const redWins =
  hasScores && match.red_score! > match.blue_score!;

const blueWins =
  hasScores && match.blue_score! > match.red_score!;

return (
  <div className="action-card schedule-match-card" key={match.id}>
    <b>
      {match.match_type} {match.match_number}
    </b>

    <span>
      {matchTime
        ? matchTime.toLocaleString([], {
            weekday: "short",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
          })
        : "Time not set"}
    </span>

    
    <div className="schedule-score-box red-score-box">
      <div className="schedule-alliance-info">
        <b>🔴 Red Alliance</b>
        <span>
          {teams.slice(0, 2).map((team, index) => (
            <span key={team}>
              {index > 0 && " + "}
              {team === 7215 ? (
                <strong>⭐ {team} (OUR TEAM)</strong>
              ) : (
                team
              )}
            </span>
          ))}
        </span>
      </div>

      <span className={`schedule-score ${redWins || isTie ? "score-winner" : "score-loser"}`}>
        {match.red_score ?? "—"}{isTie ? "*" : ""}
      </span>
    </div>

    <div className="schedule-score-box blue-score-box">
      <div className="schedule-alliance-info">
        <b>🔵 Blue Alliance</b>
        <span>
          {teams.slice(2, 4).map((team, index) => (
            <span key={team}>
              {index > 0 && " + "}
              {team === 7215 ? (
                <strong>⭐ {team} (OUR TEAM)</strong>
              ) : (
                team
              )}
            </span>
          ))}
        </span>
      </div>

      <span className={`schedule-score ${blueWins || isTie ? "score-winner" : "score-loser"}`}>
        {match.blue_score ?? "—"}{isTie ? "*" : ""}
      </span>
    </div>

    {isTie && (
      <div className="schedule-tie-note">
        * Resulted in tie
      </div>
    )}

  </div>
);
            })
          )}
        </section>
      )}
      {tab === "event-manager" && isCoordinator && (
        <section className="panel">
          <div className="section-head">
            <h3>Create an event</h3>
          </div>

          <Field label="Event name">
            <input
              value={eventName}
              onChange={e => setEventName(e.target.value)}
              placeholder="e.g. Turning Gears Qualifier"
            />
          </Field>

          <Field label="Event date">
            <input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
            />
          </Field>

          <button
            className="primary full"
            onClick={createEvent}
            disabled={busy || !eventName.trim()}
          >
            {busy ? "Creating…" : "Create event"}
          </button>
          <div className="section-head">
            <h3>Import teams</h3>
          </div>

          <p className="muted">
            Paste your event team list here. Include team numbers and names.
          </p>

          <Field label="Team list">
            <textarea
              rows={6}
              value={teamListText}
              onChange={e => setTeamListText(e.target.value)}
              placeholder={"7215 Turning Gears\n7085 F.L.A.G. Fight Like a Girl"}
            />
          </Field>

          <div className="section-head">
            <h3>Import match schedule</h3>
          </div>

          <p className="muted">
            Paste the qualification matches, times, alliance teams, and scores.
          </p>

          <Field label="Match schedule">
            <textarea
              rows={10}
              value={scheduleText}
              onChange={e => setScheduleText(e.target.value)}
              placeholder={"Qualification 1\nSat 11/7 - 11:01 AM\n7085\n22738\n7215\n21790"}
            />
          </Field> 
                    <button
            className="primary full"
            onClick={importEventData}
            disabled={importBusy || (!teamListText.trim() && !scheduleText.trim()) || !activeEventId}
          >
            {importBusy ? "Importing..." : "Import Teams & Schedule"}
          </button>
          <div className="section-head">
            <h3>Your events</h3>
          </div>

          {events.length === 0 ? (
            <Empty text="No events created yet." />
          ) : (
           events.map(ev => (
  <div
    key={ev.id}
    style={{
      display: "flex",
      gap: "10px",
      alignItems: "stretch",
      marginBottom: "10px"
    }}
  >
    <button
      className="action-card"
      style={{ flex: 1 }}
      onClick={() => {
        setActiveEventId(ev.id);
        loadEventMatches(ev.id);
      }}
    >
      <b>{ev.event_name}</b>
      <span>{ev.event_date || "Date not set"}</span>
      <span>
        {activeEventId === ev.id ? "Selected" : "Select event"}
      </span>
    </button>

    {isCoordinator && (
      <button
        type="button"
        onClick={() => deleteEvent(ev.id)}
        disabled={busy}
        style={{
          background: "rgba(220, 38, 38, 0.15)",
          border: "1px solid #ef4444",
          color: "#ff7777",
          borderRadius: "10px",
          padding: "10px",
          cursor: "pointer",
          fontWeight: 700
        }}
      >
        Remove
      </button>
    )}
  </div>
))
          )}
        </section>
      )}
      {tab === "scout" && <section className="panel form-panel">
        
        <div className="form-intro">
          <span className="eyebrow">SCOUTING MODE</span>
          <div className="segmented">
            <button
              className={scoutMode === "match" ? "selected" : ""}
              onClick={() => setScoutMode("match")}
              disabled={!!editingRecordId}
            >
              Match Report
            </button>
            <button
              className={scoutMode === "notes" ? "selected" : ""}
              onClick={() => setScoutMode("notes")}
              disabled={!!editingRecordId}
            >
              Notes Only
            </button>
          </div>
        </div>

        {scoutMode === "notes" ? (
          <>
            <div className="form-intro">
              <h3>General Team Notes</h3>
              <p className="muted">
                Record observations about a team without attaching them to a specific match.
              </p>
            </div>

            <Field label="Team number">
              <input
                inputMode="numeric"
                value={noteTeamNumber}
                onChange={e => setNoteTeamNumber(e.target.value)}
                placeholder="e.g. 12345"
              />
            </Field>

            <Field label="General observations">
              <textarea
                rows={6}
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Enter observations about this team's robot, strengths, weaknesses, or strategy..."
              />
            </Field>

            {!selectedScout && (
              <p className="warning">
                Choose your scout name on the Dashboard before submitting.
              </p>
            )}

            <button
              className="primary full"
              onClick={submitGeneralNote}
              disabled={busy || !selectedScout || !noteTeamNumber.trim() || !noteText.trim()}
            >
              {busy ? "Saving…" : "Save general notes"}
            </button>
          </>
        ) : (
          <>

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

        
<Field label="Total Hive Tips (0–10)">
  <input
    type="number"
    min="0"
    max="10"
    step="1"
    value={form.hive_tips}
    onChange={e => setForm({
      ...form,
      hive_tips: Number(e.target.value)
    })}
  />
</Field>

<div className="two-col">
  <Field label="Auto Hive Tips">
    <input
      type="number"
      min="0"
      max="10"
      step="1"
      value={form.auto_hive_tips}
      onChange={e => setForm({
        ...form,
        auto_hive_tips: Number(e.target.value)
      })}
    />
  </Field>

  <Field label="TeleOp Hive Tips">
    <input
      type="number"
      min="0"
      max="10"
      step="1"
      value={form.teleop_hive_tips}
      onChange={e => setForm({
        ...form,
        teleop_hive_tips: Number(e.target.value)
      })}
    />
  </Field>
</div>


<div className="checkbox-list">
  <label className="check-field">
    <input
      type="checkbox"
      checked={form.can_shoot_nectar}
      onChange={e => setForm({
        ...form,
        can_shoot_nectar: e.target.checked
      })}
    />
    <span>Can shoot nectar</span>
  </label>

  <label className="check-field">
    <input
      type="checkbox"
      checked={form.refilled_flower}
      onChange={e => setForm({
        ...form,
        refilled_flower: e.target.checked
      })}
    />
    <span>Refilled flower</span>
  </label>

  <label className="check-field">
    <input
      type="checkbox"
      checked={form.emptied_flower}
      onChange={e => setForm({
        ...form,
        emptied_flower: e.target.checked
      })}
    />
    <span>Emptied flower</span>
  </label>
</div>


        <Field label="Notes / observations">
          <textarea rows={3} value={form.notes}
            onChange={e => setForm({...form, notes: e.target.value})}
            placeholder="What worked well? Any failures, inconsistency, or partner interaction?"/>
        </Field>

        {!selectedScout &&
          <p className="warning">Choose your scout name on the Dashboard before submitting.</p>}
        {error && (
          <div className="errorbox">
            <AlertCircle size={16}/>
            {error}
          </div>
        )}
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
          </>
        )}
      </section>}


{tab === "records" && <section className="panel">

  <div className="section-head">
    <h3>Recent submissions</h3>
    <span className="muted tiny">
      Showing {filteredRecords.length} of {records.length + generalNotes.length} submissions
    </span>
  </div>

  <div className="filter-panel">
    <input
      value={recordSearch}
      onChange={e => setRecordSearch(e.target.value)}
      placeholder="Search team number, scout, or notes..."
    />

    <Field label="Submission type">
      <select
        value={recordTypeFilter}
        onChange={e => setRecordTypeFilter(
          e.target.value as "Both" | "Match Records" | "General Notes"
        )}
      >
        <option value="Both">Both</option>
        <option value="Match Records">Match Records</option>
        <option value="General Notes">General Notes</option>
      </select>
    </Field>

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

    <div className="filter-group">
      <strong>Scout groups</strong>
      <div className="checkbox-list">
        {(["Scouting Coach", "Parent Scout", "Student Scout"] as ScoutGroup[]).map(group => (
          <label className="check-field" key={group}>
            <input
              type="checkbox"
              checked={selectedScoutGroups.includes(group)}
              onChange={e => setSelectedScoutGroups(current =>
                e.target.checked
                  ? [...current, group]
                  : current.filter(item => item !== group)
              )}
            />
            {group}
          </label>
        ))}
      </div>
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
        setRecordTypeFilter("Both");
        setSelectedScoutGroups([]);
      }}
    >
      <RefreshCw size={15} /> Reset filters
    </button>
  </div>

  {filteredRecords.length === 0 ? (
    <Empty text="No submissions match your filters." />
  ) : (
    filteredRecords.map(item => {
      if (item.submissionType === "note") {
        const n = item.record;

        return (
          <div className="record" key={`note-${n.id}`}>
            <div className="record-top">
              <button
                className="team-number-link"
                onClick={() => {
                  setSelectedTeamNumber(n.team_number);
                  setTab("team-detail");
                }}
              >
                Team {n.team_number}
              </button>

              <span className="alliance">GENERAL NOTE</span>
            </div>

            <div className="record-meta">
              Scouted by {n.scout_name} · {n.scout_group}
              <br />
              {new Date(n.created_at).toLocaleString()}
            </div>

            <p className="record-notes">{n.notes}</p>
          </div>
        );
      }

      const r = item.record;

      return (
        <div className="record" key={`match-${r.id}`}>
          <div className="record-top">
            <button
              className="team-number-link"
              onClick={() => {
                setSelectedTeamNumber(r.team_number);
                setTab("team-detail");
              }}
            >
              Team {r.team_number}
            </button>

            <span className={"alliance " + r.alliance.toLowerCase()}>
              {r.alliance}
            </span>

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
            Scouted by {r.scout_name} · {r.scout_group || "Unassigned"} · {new Date(r.created_at).toLocaleString()}
            <br />
            Alliance partner: {r.partner_team_number
              ? `Team ${r.partner_team_number}`
              : "Not recorded"}
          </div>

          <div className="mini-ratings">
            <span>Auto <b>{r.auto_rating ?? "—"}/5</b></span>
            <span>Shooting <b>{r.shooting_accuracy ?? "—"}/5</b></span>
            <span>Mobility <b>{r.maneuverability ?? "—"}/5</b></span>
            <span>Reliability <b>{r.reliability ?? "—"}/5</b></span>
            <span>Total Hive Tips <b>{r.hive_tips ?? 0}</b></span>
            <span>Auto Hive Tips <b>{r.auto_hive_tips ?? 0}</b></span>
            <span>TeleOp Hive Tips <b>{r.teleop_hive_tips ?? 0}</b></span>
            <span>Ranking points <b>{r.ranking_points ?? 0}</b></span>
            <span>Red final score <b>{r.red_final_score ?? 0}</b></span>
            <span>Blue final score <b>{r.blue_final_score ?? 0}</b></span>
            <span>Nectar <b>{r.can_shoot_nectar ? "Yes" : "No"}</b></span>
            <span>Refilled flower <b>{r.refilled_flower ? "Yes" : "No"}</b></span>
          </div>

          {r.notes && <p className="record-notes">{r.notes}</p>}
        </div>
      );
    })
  )}
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
  <div className="filter-group">
    <strong>Filter by scout group</strong>
    <div className="checkbox-list">
      {(["Scouting Coach", "Parent Scout", "Student Scout"] as ScoutGroup[]).map(group => (
        <label className="check-field" key={group}>
          <input
            type="checkbox"
            checked={selectedScoutGroups.includes(group)}
            onChange={e => setSelectedScoutGroups(current =>
              e.target.checked
                ? [...current, group]
                : current.filter(item => item !== group)
            )}
          />
          {group}
        </label>
      ))}
    </div>
  </div>

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
    <div className="stat">
      <strong>{selectedTeamSummary.count}</strong>
      <span>Matches scouted</span>
    </div>

    <div className="stat">
      <strong>{selectedTeamSummary.autonomous?.toFixed(1) ?? "—"}</strong>
      <span>Autonomous</span>
    </div>

    <div className="stat">
      <strong>{selectedTeamSummary.shooting?.toFixed(1) ?? "—"}</strong>
      <span>Shooting</span>
    </div>

    <div className="stat">
      <strong>{selectedTeamSummary.mobility?.toFixed(1) ?? "—"}</strong>
      <span>Mobility</span>
    </div>

    <div className="stat">
      <strong>{selectedTeamSummary.reliability?.toFixed(1) ?? "—"}</strong>
      <span>Reliability</span>
    </div>

    <div className="stat">
      <strong>{selectedTeamSummary.rankingTotal}</strong>
      <span>RP total</span>
    </div>

    <div className="stat">
      <strong>{selectedTeamSummary.rankingAverage?.toFixed(1) ?? "—"}</strong>
      <span>RP average</span>
    </div>
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
            <span>Total Hive Tips <b>{r.hive_tips ?? 0}</b></span>
            <span>Auto Hive Tips <b>{r.auto_hive_tips ?? 0}</b></span>
            <span>TeleOp Hive Tips <b>{r.teleop_hive_tips ?? 0}</b></span>
            <span>Can shoot nectar <b>{r.can_shoot_nectar ? "Yes" : "No"}</b></span>
            <span>Refilled flower <b>{r.refilled_flower ? "Yes" : "No"}</b></span>
            <span>Ranking points <b>{r.ranking_points ?? 0}</b></span>
            <span>Red final score <b>{r.red_final_score ?? 0}</b></span>
<span>Blue final score <b>{r.blue_final_score ?? 0}</b></span>
          </div>

          {r.notes && (
            <p className="record-notes">{r.notes}</p>
          )}
        </div>
      ))
   
    )}

    <h3 className="section-title">General Notes</h3>

    {generalNotes
      .filter(n =>
        n.team_number === selectedTeamNumber &&
        (
          selectedScoutGroups.length === 0 ||
          selectedScoutGroups.includes(n.scout_group)
        )
      )
      .sort((a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      )
      .map(n => (
        <div className="record" key={n.id}>
          <div className="record-top">
            <b>General Observation</b>
            <span className="muted">
              {n.scout_group}
            </span>
          </div>

          <div className="record-meta">
            Scouted by {n.scout_name} · {new Date(n.created_at).toLocaleString()}
          </div>

          <p className="record-notes">{n.notes}</p>
        </div>
      ))}

    {generalNotes.filter(n =>
      n.team_number === selectedTeamNumber &&
      (
        selectedScoutGroups.length === 0 ||
        selectedScoutGroups.includes(n.scout_group)
      )
    ).length === 0 && (
      <p className="muted">No general notes found for this team.</p>
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

  <div className="filter-group">
    <strong>Filter by scout group</strong>
    <div className="checkbox-list">
      {(["Scouting Coach", "Parent Scout", "Student Scout"] as ScoutGroup[]).map(group => (
        <label className="check-field" key={group}>
          <input
            type="checkbox"
            checked={selectedScoutGroups.includes(group)}
            onChange={e => setSelectedScoutGroups(current =>
              e.target.checked
                ? [...current, group]
                : current.filter(item => item !== group)
            )}
          />
          {group}
        </label>
      ))}
    </div>
  </div>

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


{comparisonTeams.length === 0 ? (
  <Empty text="Choose an available team to view its scouting statistics."/>

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
   
        <div className="filter-group">
          <strong>Filter by scout group</strong>
          <div className="checkbox-list">
            {(["Scouting Coach", "Parent Scout", "Student Scout"] as ScoutGroup[]).map(group => (
              <label className="check-field" key={group}>
                <input
                  type="checkbox"
                  checked={selectedScoutGroups.includes(group)}
                  onChange={e => setSelectedScoutGroups(current =>
                    e.target.checked
                      ? [...current, group]
                      : current.filter(item => item !== group)
                  )}
                />
                {group}
              </label>
            ))}
          </div>
        </div>

        {scouts
          .filter(s =>
            selectedScoutGroups.length === 0 ||
            (s.scout_group !== null &&
              selectedScoutGroups.includes(s.scout_group))
          )
          .map(s => <div className="scout-row" key={s.id}>

          <span className="avatar">{s.name.slice(0, 1).toUpperCase()}</span>
          <b>{s.name}</b>
          {isCoordinator &&
            <button className="text-btn" onClick={() => deactivateScout(s.id)}>Remove</button>}
        </div>)}
      </section>}
    </main>

    <nav className="bottom-nav">
     <NavItem active={tab === "home"} icon={<House/>} label="Home" onClick={() => setTab("home")}/>
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
