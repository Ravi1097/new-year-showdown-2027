
"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy, Sparkles, Crown, Users, Copy, Play,
  CheckCircle2, Clock3, LogOut, Tv, RefreshCw
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

const TEAMS = [
  { name: "Gold", color: "border-amber-400", text: "text-amber-300", bg: "bg-amber-400/10" },
  { name: "Blue", color: "border-blue-400", text: "text-blue-300", bg: "bg-blue-400/10" },
  { name: "Purple", color: "border-purple-400", text: "text-purple-300", bg: "bg-purple-400/10" },
  { name: "Green", color: "border-emerald-400", text: "text-emerald-300", bg: "bg-emerald-400/10" }
];

type Player = {
  id: string;
  name: string;
  team: string;
};

type PlayerScore = {
  playerId: string;
  name: string;
  team: string;
  points: number;
};

type Question = {
  index: number;
  round: string;
  difficulty: "Easy" | "Medium" | "Hard";
  prompt: string;
  options: string[];
  startedAt: string;
  revealedAnswer: string | null;
  funFact: string | null;
};

type RoomState = {
  code: string;
  status: string;
  isHost: boolean;
  answerRevealed: boolean;
  question: Question | null;
  players: Player[];
  scores: Record<string, number>;
  myPlayer: Player | null;
  playerScores: PlayerScore[];
  submittedCount: number;
  myAnswer: string | null;
  serverNow: string;
  myAnswerCorrect?: boolean | null;
};

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [team, setTeam] = useState("Gold");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [clockTick, setClockTick] = useState(0);
  const [tvMode, setTvMode] = useState(false);

  
useEffect(() => {
  let mounted = true;

  supabase.auth.getSession().then(({ data, error }) => {
    if (!mounted) return;

    if (error) {
      setMessage(error.message);
      return;
    }

    setSession(data.session);
  });

  const { data: authListener } = supabase.auth.onAuthStateChange(
    (_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
      }
    }
  );

  return () => {
    mounted = false;
    authListener.subscription.unsubscribe();
  };
}, []);

  const refreshRoom = useCallback(async (code: string) => {
    const { data, error } = await supabase.rpc("showdown_get_room_state", {
      p_room_code: code
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    const nextRoom = data as RoomState;

    // Correctness is fetched through a server-side function that verifies the
    // caller owns this player submission. The answer key is never sent to clients.
    if (nextRoom.myAnswer && !nextRoom.isHost && nextRoom.question) {
      const { data: answerResult, error: answerResultError } = await supabase.rpc(
        "showdown_my_answer_result",
        { p_room_code: code }
      );
      if (!answerResultError) nextRoom.myAnswerCorrect = answerResult as boolean | null;
    } else {
      nextRoom.myAnswerCorrect = null;
    }

    setRoom(nextRoom);
  }, []);

  useEffect(() => {
    if (!roomCode) return;

    refreshRoom(roomCode);
    const poll = window.setInterval(() => refreshRoom(roomCode), 2000);

    return () => window.clearInterval(poll);
  }, [roomCode, refreshRoom]);

  useEffect(() => {
    if (!room?.question?.startedAt) return;

    const timer = window.setInterval(() => {
      setClockTick((value) => value + 1);
    }, 250);

    return () => window.clearInterval(timer);
  }, [room?.question?.startedAt]);


async function sendHostLogin() {
  const cleanEmail = email.trim();

  if (!cleanEmail) {
    setMessage("Please enter your email address.");
    return;
  }

  setLoading(true);
  setMessage("");
  setEmailSent(false);

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: "https://new-year-showdown-2027.vercel.app/",
        shouldCreateUser: true
      }
    });

    if (error) {
      setMessage(`Login error: ${error.message}`);
      return;
    }

    setEmailSent(true);
    setMessage("Magic link sent. Check your email.");
  } catch (err) {
    setMessage(
      err instanceof Error
        ? `Login failed: ${err.message}`
        : "Login failed. Please try again."
    );
  } finally {
    setLoading(false);
  }
}

  async function createRoom() {
    if (!session || session.user.is_anonymous) {
      setMessage("The host must sign in using the email link first.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.rpc("showdown_create_room");

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const code = String(data).trim().toUpperCase();
    setRoomCode(code);
    await refreshRoom(code);
  }

  async function joinRoom() {
    const code = joinCode.trim().toUpperCase();

    if (!code || !playerName.trim()) {
      setMessage("Enter your room code and player name.");
      return;
    }

    setLoading(true);
    setMessage("");

    let currentSession = session;

    if (!currentSession) {
      const { data, error } = await supabase.auth.signInAnonymously();

      if (error) {
        setLoading(false);
        setMessage(error.message);
        return;
      }

      currentSession = data.session;
    }

    const { error } = await supabase.rpc("showdown_join_room", {
      p_room_code: code,
      p_name: playerName.trim(),
      p_team: team
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setRoomCode(code);
    await refreshRoom(code);
  }

  async function publishQuestion(index: number) {
    if (!roomCode) return;

    setLoading(true);
    setMessage("");

    const { error } = await supabase.rpc("showdown_publish_question", {
      p_room_code: roomCode,
      p_question_index: index
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await refreshRoom(roomCode);
  }

  async function revealAnswer() {
    if (!roomCode) return;

    setLoading(true);
    setMessage("");

    const { error } = await supabase.rpc("showdown_reveal_answer", {
      p_room_code: roomCode
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await refreshRoom(roomCode);
  }

  
async function submitAnswer(answer: string) {
  if (!room?.question || !roomCode || room.myAnswer) return;

  setLoading(true);
  setMessage("");

  const questionIndex = room.question.index;

  const { error } = await supabase.rpc("showdown_submit_answer", {
    p_room_code: roomCode,
    p_question_index: questionIndex,
    p_answer: answer
  });

  if (error) {
    setLoading(false);
    setMessage(error.message);
    return;
  }

  setRoom((previous) =>
    previous
      ? { ...previous, myAnswer: answer, myAnswerCorrect: null }
      : previous
  );

  const { data, error: resultError } = await supabase.rpc(
    "showdown_my_answer_result",
    { p_room_code: roomCode }
  );

  if (resultError) {
    setMessage("Answer submitted. Checking the result…");
  } else {
    setRoom((previous) =>
      previous
        ? { ...previous, myAnswerCorrect: data as boolean | null }
        : previous
    );
  }

  setLoading(false);
}

  async function leaveRoom() {
    setRoom(null);
    setRoomCode("");
    setTvMode(false);
    setMessage("");
  }

  const question = room?.question ?? null;
  const timeLimit = question?.round === "Rapid Fire" ? 15 : 20;
  const serverOffset = room?.serverNow
    ? new Date(room.serverNow).getTime() - Date.now()
    : 0;

  const elapsed = question?.startedAt
    ? Math.max(
        0,
        Math.floor(
          (Date.now() + serverOffset - new Date(question.startedAt).getTime()) / 1000
        )
      )
    : 0;

  const remaining = Math.max(0, timeLimit - elapsed);
  const isFinished = Boolean(
    question?.index === 74 && room?.answerRevealed
  );

  const rankedTeams = room
    ? [...TEAMS].sort((a, b) => (room.scores[b.name] ?? 0) - (room.scores[a.name] ?? 0))
    : [...TEAMS];
  const winningTeam = rankedTeams[0];
  const championScore = room?.scores[winningTeam.name] ?? 0;
  const championTeams = rankedTeams.filter((item) => (room?.scores[item.name] ?? 0) === championScore);
  const runnerUpScore = rankedTeams.find((item) => (room?.scores[item.name] ?? 0) < championScore)
    ? (room?.scores[rankedTeams.find((item) => (room?.scores[item.name] ?? 0) < championScore)!.name] ?? 0)
    : null;
  const runnerUpTeams = runnerUpScore === null ? [] : rankedTeams.filter((item) => (room?.scores[item.name] ?? 0) === runnerUpScore);

  const isHost = room?.isHost ?? false;

  async function copyCode() {
    if (!roomCode) return;
    await navigator.clipboard.writeText(roomCode);
    setMessage("Room code copied!");
  }

  return (
    <main className="showdown-shell min-h-screen bg-[#080817] px-4 py-8 text-white sm:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.22),_transparent_60%)]" />

      <div className="relative mx-auto max-w-6xl">
        <header className="brand-header mb-10 flex flex-col gap-5 border-b border-amber-300/20 pb-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.4em] text-amber-300">
              ✦ THE INDIAN EDITION ✦
            </p>
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
              NEW YEAR
              <span className="block bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
                SHOWDOWN 2027
              </span>
            </h1>
            <p className="mt-3 text-sm tracking-wide text-slate-400">
              ONE NIGHT. FOUR TEAMS. 75 QUESTIONS. ONE CHAMPION.
            </p>
          </div>
          <div className="flex h-20 w-20 items-center justify-center self-start rounded-3xl border border-amber-300/30 bg-amber-400/10 shadow-[0_0_45px_rgba(251,191,36,0.12)] sm:self-center">
            <Trophy className="h-11 w-11 text-amber-300" />
          </div>
        </header>

        {message && (
          <div className="mb-6 rounded-xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-slate-200">
            {message}
            <button
              className="ml-3 text-amber-300 underline"
              onClick={() => setMessage("")}
            >
              Dismiss
            </button>
          </div>
        )}

        {!roomCode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="hero-stage py-12 text-center sm:py-16">
              <p className="hero-kicker mb-4 text-xs font-black uppercase tracking-[0.35em] text-amber-200">
                THE ULTIMATE NEW YEAR SHOWDOWN
              </p>
              <h2 className="hero-title text-3xl font-black sm:text-5xl">
                LET THE GAMES BEGIN
              </h2>
              <p className="hero-description mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Gather your team, test your knowledge and compete for the
                ultimate bragging rights this New Year.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {["75 QUESTIONS", "4 TEAMS", "8 PLAYERS", "1 CHAMPION"].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[10px] font-black tracking-widest text-amber-200"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <section className="premium-panel host-panel relative overflow-hidden rounded-3xl border border-amber-300/30 bg-gradient-to-br from-amber-400/15 via-[#211b29] to-[#111126] p-7 shadow-[0_20px_70px_rgba(251,191,36,0.09)] sm:p-9">
                <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" />
                <div className="relative">
                  <div className="mb-7 flex items-center justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-400/15">
                      <Crown className="h-8 w-8 text-amber-300" />
                    </div>
                    <span className="rounded-full border border-amber-300/30 px-3 py-1 text-[10px] font-black tracking-widest text-amber-200">
                      GAME MASTER
                    </span>
                  </div>
                  <p className="mb-2 text-xs font-black tracking-[0.25em] text-amber-300">
                    TAKE CONTROL
                  </p>
                  <h2 className="text-3xl font-black">HOST THE GAME</h2>
                  <p className="mb-8 mt-3 text-sm leading-7 text-slate-300">
                    Create your private game room, invite your guests and
                    control the ultimate showdown.
                  </p>

                  {session && !session.user.is_anonymous ? (
                    <>
                      <p className="mb-5 text-sm text-emerald-300">
                        ✓ Host account signed in. You're ready!
                      </p>
                      <button
                        onClick={createRoom}
                        disabled={loading}
                        className="w-full rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-6 py-4 font-black tracking-wide text-black shadow-lg shadow-amber-500/20 transition hover:brightness-110 disabled:opacity-50"
                      >
                        {loading ? "CREATING..." : "CREATE GAME ROOM →"}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="mb-5 text-xs text-slate-400">
                        HOST ACCESS · SECURE EMAIL LOGIN
                      </p>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Host email address"
                        className="mb-3 w-full rounded-xl border border-amber-200/20 bg-black/40 px-4 py-4 text-sm outline-none transition focus:border-amber-300"
                      />
                      <button
                        onClick={sendHostLogin}
                        disabled={loading || emailSent}
                        className="w-full rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-6 py-4 font-black tracking-wide text-black shadow-lg shadow-amber-500/20 transition hover:brightness-110 disabled:opacity-50"
                      >
                        {loading ? "SENDING..." : emailSent ? "LINK SENT — CHECK EMAIL" : "SEND HOST LOGIN LINK →"}
                      </button>
                    </>
                  )}
                </div>
              </section>

              <section className="premium-panel player-panel relative overflow-hidden rounded-3xl border border-blue-400/30 bg-gradient-to-br from-blue-500/15 via-[#171c32] to-[#111126] p-7 shadow-[0_20px_70px_rgba(59,130,246,0.09)] sm:p-9">
                <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-blue-400/10 blur-3xl" />
                <div className="relative">
                  <div className="mb-7 flex items-center justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-300/30 bg-blue-400/15">
                      <Users className="h-8 w-8 text-blue-300" />
                    </div>
                    <span className="rounded-full border border-blue-300/30 px-3 py-1 text-[10px] font-black tracking-widest text-blue-200">
                      PLAYER ACCESS
                    </span>
                  </div>
                  <p className="mb-2 text-xs font-black tracking-[0.25em] text-blue-300">
                    JOIN YOUR CREW
                  </p>
                  <h2 className="text-3xl font-black">JOIN THE GAME</h2>
                  <p className="mb-6 mt-3 text-sm leading-7 text-slate-300">
                    Enter your room code, choose your team and get ready
                    to battle for the championship.
                  </p>

                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="ENTER ROOM CODE"
                    maxLength={12}
                    className="mb-3 w-full rounded-xl border border-blue-300/20 bg-black/40 px-4 py-4 text-center text-xl font-black tracking-[0.3em] outline-none transition focus:border-blue-300"
                  />
                  <input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Your name"
                    maxLength={24}
                    className="mb-5 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-4 text-sm outline-none transition focus:border-blue-300"
                  />
                  <label className="mb-3 block text-xs font-black uppercase tracking-widest text-slate-400">
                    Choose your team
                  </label>
                  <div className="mb-6 grid grid-cols-2 gap-3">
                    {TEAMS.map((item) => (
                      <button
                        key={item.name}
                        onClick={() => setTeam(item.name)}
                        className={`rounded-xl border p-4 text-sm font-black tracking-wider transition ${item.color} ${team === item.name ? `${item.bg} ${item.text} ring-2 ring-white/20 shadow-lg` : "bg-black/20 text-slate-400 opacity-70 hover:opacity-100"}`}
                      >
                        {item.name.toUpperCase()}
                        {team === item.name && " ✓"}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={joinRoom}
                    disabled={loading}
                    className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-4 font-black tracking-wide text-white shadow-lg shadow-blue-500/20 transition hover:brightness-110 disabled:opacity-50"
                  >
                    {loading ? "JOINING..." : "JOIN THE SHOWDOWN →"}
                  </button>
                </div>
              </section>
            </div>

            <p className="pb-5 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-slate-600">
              MADE FOR ONE UNFORGETTABLE NIGHT · NEW YEAR 2027
            </p>
          </motion.div>
        )}

        {roomCode && room && (
          <div className="space-y-6">
            <section className="room-bar flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Room code
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black tracking-[0.2em] text-amber-300">
                    {roomCode}
                  </span>
                  <button onClick={copyCode} title="Copy room code">
                    <Copy className="h-5 w-5 text-slate-300" />
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setTvMode(!tvMode)}
                  className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-bold"
                >
                  <Tv className="h-4 w-4" />
                  {tvMode ? "Exit display" : "Display mode"}
                </button>
                <button
                  onClick={leaveRoom}
                  className="rounded-xl border border-white/20 p-3"
                  title="Leave room view"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </section>

            {room.myPlayer && (
  <section className={`rounded-2xl border p-5 shadow-xl ${
    TEAMS.find((item) => item.name === room.myPlayer?.team)?.color ?? "border-white/10"
  } ${
    TEAMS.find((item) => item.name === room.myPlayer?.team)?.bg ?? "bg-white/5"
  }`}>
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
      YOUR PLAYER PROFILE
    </p>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className={`text-2xl font-black ${
          TEAMS.find((item) => item.name === room.myPlayer?.team)?.text ?? "text-white"
        }`}>
          YOU ARE ON {room.myPlayer.team.toUpperCase()} TEAM
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          Playing as {room.myPlayer.name}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Teammate: {
            room.players
              .filter((p) => p.team === room.myPlayer?.team && p.id !== room.myPlayer?.id)
              .map((p) => p.name)
              .join(", ") || "Waiting for teammate"
          }
        </p>
      </div>
      <span className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-black">
        YOUR TEAM
      </span>
    </div>
  </section>
)}

            {!tvMode && (
              <section className="lobby-panel rounded-2xl border border-white/10 bg-white/[0.06] p-5">
                {room.status === "waiting" ? (
  <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300">
          Before the showdown
        </p>
        <h2 className="mt-1 flex items-center gap-2 text-xl font-black">
          <Users className="text-amber-300" /> LIVE TEAM LOBBY
        </h2>
      </div>
      <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-sm font-black text-amber-100">
        {room.players.length}/8 PLAYERS
      </span>
    </div>

    <div className="mb-5 h-2 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 transition-all"
        style={{ width: `${(room.players.length / 8) * 100}%` }}
      />
    </div>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {TEAMS.map((item) => {
        const members = room.players.filter((p) => p.team === item.name);

        return (
          <div
            key={item.name}
            className={`team-tile rounded-xl border ${item.color} ${item.bg} p-4`}
          >
            <h3 className={`mb-3 font-black tracking-wider ${item.text}`}>
              {item.name.toUpperCase()} TEAM
            </h3>

            {members.length === 0 && (
              <p className="text-sm text-slate-500">Waiting for players…</p>
            )}

            {members.map((p) => (
              <p
                key={p.id}
                className="mb-2 rounded-lg bg-black/20 px-3 py-2 text-sm"
              >
                {p.name}
              </p>
            ))}

            <p className="mt-3 text-xs font-bold text-slate-400">
              {members.length}/2 PLAYERS
            </p>
          </div>
        );
      })}
    </div>

    <div className="briefing-stage mt-7">
      <div className="text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.42em] text-amber-200">
          {room.players.length === 8
            ? "All teams assembled · 8 of 8 players"
            : `${room.players.length} of 8 players joined`}
        </p>

        <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
          BEFORE WE BEGIN
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          Take a moment to read the rules. The host will start the first
          question when everyone is ready.
        </p>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <div className="briefing-card">
          <p className="briefing-label">01 · GAME FORMAT</p>
          <h3>75 questions. One champion.</h3>
          <ul>
            <li>50 questions in the Main Round</li>
            <li>25 questions in Rapid Fire</li>
            <li>4 teams · 2 players per team</li>
            <li>Both teammates answer independently</li>
          </ul>
        </div>

        <div className="briefing-card">
          <p className="briefing-label">02 · TIME TO ANSWER</p>
          <h3>Think fast. Be precise.</h3>
          <ul>
            <li>Main Round: 20 seconds per question</li>
            <li>Rapid Fire: 15 seconds per question</li>
            <li>One answer per player</li>
            <li>Submit before the timer reaches zero</li>
          </ul>
        </div>

        <div className="briefing-card">
          <p className="briefing-label">03 · POINTS</p>
          <h3>Every answer counts.</h3>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3">
              <p className="text-xs text-emerald-200">EASY</p>
              <p className="mt-1 text-xl font-black">100</p>
            </div>
            <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3">
              <p className="text-xs text-amber-200">MEDIUM</p>
              <p className="mt-1 text-xl font-black">150</p>
            </div>
            <div className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-3">
              <p className="text-xs text-rose-200">HARD</p>
              <p className="mt-1 text-xl font-black">200</p>
            </div>
          </div>

          <ul>
            <li>Incorrect or unanswered: 0 points</li>
            <li>Team total combines both players' points</li>
          </ul>
        </div>

        <div className="briefing-card">
          <p className="briefing-label">04 · PLAY FAIR</p>
          <h3>It's all about the fun.</h3>
          <ul>
            <li>No Google, phones or outside help</li>
            <li>No help from other teams</li>
            <li>Answers lock once submitted</li>
            <li>Correct answers and fun facts appear after the host reveals</li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-200/25 bg-amber-200/[0.06] p-5 text-center">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-200">
          The finish line
        </p>
        <p className="mt-2 text-lg font-black">
          Highest team score wins the championship.
        </p>
        <p className="mt-1 text-sm text-slate-300">
          Champion and runner-up will be celebrated on the final podium.
        </p>
      </div>

      {isHost ? (
        <button
  onClick={() => publishQuestion(0)}
  disabled={loading || room.players.length < 1}
  className="showdown-start-button mt-7 flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-5 text-base font-black tracking-[0.14em] text-[#17120a] disabled:opacity-40"
>
  <Play className="h-5 w-5" />
  {loading ? "GETTING READY…" : "START SHOWDOWN"}
</button>
      ) : (
        <p className="mt-7 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center text-sm font-semibold text-slate-300">
          You're all set. The host will start the showdown shortly.
        </p>
      )}
    </div>
  </>
) : null}
              </section>
            )}

            {question && (
              <section className="question-panel rounded-3xl border border-white/10 bg-[#111126] p-6 shadow-2xl sm:p-9">
                {isFinished ? (
                  <div className="champion-stage py-10 text-center">
                    <Sparkles className="mx-auto mb-4 h-7 w-7 text-amber-200" />
                    <p className="mb-3 text-[10px] font-black uppercase tracking-[0.42em] text-amber-200">The final results are in</p>
                    <h2 className="text-4xl font-black tracking-tight sm:text-6xl">THE PODIUM</h2>
                    <p className="mt-3 text-sm text-slate-300">New Year Showdown 2027 · The Indian Edition</p>

                    <div className="mx-auto mt-9 grid max-w-3xl items-end gap-4 sm:grid-cols-2">
                      <div className="podium-card champion-card order-1 sm:order-1">
                        <Crown className="mx-auto mb-3 h-10 w-10 text-amber-200" />
                        <p className="podium-rank">{championTeams.length > 1 ? "JOINT CHAMPIONS" : "CHAMPION"}</p>
                        {championTeams.map((item) => <p key={item.name} className={`mt-2 text-2xl font-black ${item.text}`}>{item.name.toUpperCase()} TEAM</p>)}
                        <p className="mt-3 text-3xl font-black text-amber-100">{championScore.toLocaleString()}</p>
                        <p className="text-xs font-bold uppercase tracking-widest text-amber-100/70">points</p>
                      </div>
                      <div className="podium-card runner-card order-2 sm:order-2">
                        <Trophy className="mx-auto mb-3 h-9 w-9 text-slate-200" />
                        <p className="podium-rank">RUNNER-UP</p>
                        {runnerUpTeams.length ? runnerUpTeams.map((item) => <p key={item.name} className={`mt-2 text-xl font-black ${item.text}`}>{item.name.toUpperCase()} TEAM</p>) : <p className="mt-2 text-xl font-black text-slate-200">No separate runner-up</p>}
                        <p className="mt-3 text-2xl font-black text-slate-100">{runnerUpScore === null ? "—" : runnerUpScore.toLocaleString()}</p>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-300/70">points</p>
                      </div>
                    </div>

                    <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-white/10 bg-black/20 p-5 text-left">
                      <p className="mb-3 text-center text-[10px] font-black uppercase tracking-[0.35em] text-amber-200">Final team standings</p>
                      <div className="space-y-2">
                        {rankedTeams.map((item, index) => <div key={item.name} className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.035] px-4 py-3"><span className={`font-bold ${item.text}`}>{index + 1}. {item.name} Team</span><span className="font-black tabular-nums">{(room.scores[item.name] ?? 0).toLocaleString()} pts</span></div>)}
                      </div>
                    </div>
                    <p className="mt-9 text-2xl font-black tracking-[0.12em] text-amber-200 sm:text-3xl">HAPPY NEW YEAR 2027!</p>
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.3em] text-slate-400">One night · Four teams · Unforgettable memories</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                          {question.round} · Question {question.index + 1} of 75
                        </p>
                        <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-black ${
                          question.difficulty === "Easy"
                            ? "bg-emerald-400/15 text-emerald-300"
                            : question.difficulty === "Medium"
                              ? "bg-amber-400/15 text-amber-300"
                              : "bg-rose-400/15 text-rose-300"
                        }`}>
                          {question.difficulty}
                        </span>
                      </div>

                      <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 font-black ${
                        remaining <= 5 ? "border-rose-400 text-rose-300" : "border-white/15 text-white"
                      }`}>
                        <Clock3 className="h-5 w-5" />
                        {room.answerRevealed ? "REVEALED" : `${remaining}s`}
                      </div>
                    </div>

                    <div className="mb-6 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all"
                        style={{ width: `${Math.max(0, (remaining / timeLimit) * 100)}%` }}
                      />
                    </div>

                    <h2 className="mb-8 text-2xl font-black leading-relaxed sm:text-4xl">
                      {question.prompt}
                    </h2>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {question.options.map((option, index) => {
                        const selected = room.myAnswer === option;
                        const correct = room.answerRevealed && question.revealedAnswer === option;
                        const selectedCorrect = !isHost && selected && !room.answerRevealed && room.myAnswerCorrect === true;
                        const selectedWrong = !isHost && selected && !room.answerRevealed && room.myAnswerCorrect === false;

                        return (
                          <button
                            key={option}
                            onClick={() => submitAnswer(option)}
                            disabled={isHost || room.answerRevealed || Boolean(room.myAnswer) || remaining <= 0 || loading}
                            className={`answer-option rounded-xl border p-4 text-left text-base font-semibold transition sm:p-5 ${
                              correct || selectedCorrect
                                ? "border-emerald-400 bg-emerald-400/20 text-emerald-100 shadow-[0_0_28px_rgba(34,197,94,0.16)]"
                                : selectedWrong
                                  ? "border-rose-400 bg-rose-400/20 text-rose-100 shadow-[0_0_28px_rgba(244,63,94,0.16)]"
                                  : selected
                                    ? "border-amber-400 bg-amber-400/15"
                                    : "border-white/10 bg-white/5 hover:border-amber-300/50"
                            } disabled:cursor-not-allowed disabled:opacity-80`}
                          >
                            <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-black/30 text-sm font-black">
                              {String.fromCharCode(65 + index)}
                            </span>
                            {option}
                            {(correct || selectedCorrect) && <CheckCircle2 className="float-right h-5 w-5 text-emerald-300" />}
                            {selectedWrong && <span className="float-right text-xs font-black uppercase tracking-wider text-rose-200">Incorrect</span>}
                          </button>
                        );
                      })}
                    </div>

                    {!isHost && room.myAnswer && !room.answerRevealed && (
                      <div className={`mt-5 rounded-2xl border p-4 text-center ${room.myAnswerCorrect === true ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : room.myAnswerCorrect === false ? "border-rose-400/40 bg-rose-400/10 text-rose-200" : "border-amber-300/25 bg-amber-300/10 text-amber-100"}`}>
                        <p className="text-base font-black">{room.myAnswerCorrect === true ? "✓ CORRECT ANSWER!" : room.myAnswerCorrect === false ? "✕ NOT QUITE — INCORRECT" : "ANSWER SUBMITTED"}</p>
                        <p className="mt-1 text-xs">{room.myAnswerCorrect === true ? `This answer is worth ${question.difficulty === "Easy" ? 100 : question.difficulty === "Medium" ? 150 : 200} points. Scores update when the host reveals the answer.` : room.myAnswerCorrect === false ? "No points for this answer. Stay ready for the next question!" : "Checking your answer…"}</p>
                      </div>
                    )}

                    {isHost && !room.answerRevealed && (
                      <button
                        onClick={revealAnswer}
                        disabled={loading}
                        className="mt-7 w-full rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-6 py-4 font-black text-black disabled:opacity-50"
                      >
                        REVEAL ANSWER & AWARD POINTS
                      </button>
                    )}

                    {room.answerRevealed && (
                      <div className="mt-7 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
                        <p className="text-xs font-black uppercase tracking-widest text-emerald-300">
                          Correct answer
                        </p>
                        <p className="mt-2 text-xl font-black">
                          {question.revealedAnswer}
                        </p>
                        {question.funFact && (
                          <div className="mt-5 border-t border-white/10 pt-4">
                            <p className="mb-2 flex items-center gap-2 text-sm font-black text-amber-300">
                              <Sparkles className="h-4 w-4" />
                              DID YOU KNOW?
                            </p>
                            <p className="text-sm leading-6 text-slate-200">
                              {question.funFact}
                            </p>
                          </div>
                        )}

                        {isHost && (
                          <button
                            onClick={() => publishQuestion(question.index + 1)}
                            disabled={loading || question.index >= 74}
                            className="mt-6 w-full rounded-xl bg-white px-6 py-4 font-black text-black disabled:opacity-50"
                          >
                            NEXT QUESTION →
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            {!isFinished && <section className="leaderboard-panel rounded-2xl border border-white/10 bg-white/[0.06] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <Trophy className="text-amber-300" />
                  LIVE LEADERBOARD
                </h2>
                <button onClick={() => refreshRoom(roomCode)} title="Refresh scores">
                  <RefreshCw className="h-4 w-4 text-slate-400" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                {TEAMS.map((item) => (
                  <div key={item.name} className={`team-tile rounded-xl border ${item.color} ${item.bg} p-4`}>
                    <p className={`text-sm font-black ${item.text}`}>
                      {item.name.toUpperCase()}
                    </p>
                    <p className="mt-2 text-3xl font-black">
                      {room.scores[item.name] ?? 0}
                    </p>
                    <p className="text-xs text-slate-400">points</p>
                  </div>
                ))}
              </div>
            </section>}
            <section className="showdown-surface rounded-2xl border p-5 shadow-xl backdrop-blur-xl">
  <div className="mb-5">
    <h2 className="flex items-center gap-2 text-sm font-black tracking-[0.1em] sm:text-base">
      <Users className="text-amber-300" />
      INDIVIDUAL PLAYER SCORES
    </h2>
    <p className="mt-2 text-xs text-slate-400">
      Every player's personal points earned throughout the game.
    </p>
  </div>

  <div className="space-y-3">
    {room.playerScores.map((player, index) => {
      const playerTeam = TEAMS.find((item) => item.name === player.team);
      const isMe = player.playerId === room.myPlayer?.id;

      return (
        <div
          key={player.playerId}
          className={`flex items-center justify-between gap-3 rounded-xl border p-4 ${
            isMe
              ? "border-amber-300/40 bg-amber-300/[0.07]"
              : "border-white/10 bg-white/[0.035]"
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-sm font-black text-slate-500">
              #{index + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate font-bold text-white">
                {player.name} {isMe && "(YOU)"}
              </p>
              <p className={`mt-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                playerTeam?.text ?? "text-slate-400"
              }`}>
                {player.team} TEAM
              </p>
            </div>
          </div>
          <p className="shrink-0 text-xl font-black text-amber-200">
            {player.points.toLocaleString()} 
            <span className="ml-1 text-[10px] font-bold text-slate-400">
              PTS
            </span>
          </p>
        </div>
      );
    })}
  </div>
</section>
          </div>
        )}
      </div>

      <style jsx global>{`
        .showdown-shell {
          --gold: #e8c477;
          --gold-bright: #ffe4a1;
          --ink: #070912;
          position: relative; isolation: isolate; overflow: hidden;
          background:
            radial-gradient(ellipse at 50% -12%, rgba(195,148,62,.24), transparent 36%),
            radial-gradient(ellipse at 0% 38%, rgba(72,66,130,.22), transparent 32%),
            radial-gradient(ellipse at 100% 72%, rgba(31,83,112,.16), transparent 34%),
            linear-gradient(145deg,#080a14 0%,#0c1020 48%,#080a13 100%) !important;
        }
        .showdown-shell:before {
          content:""; position:fixed; inset:0; z-index:-1; pointer-events:none; opacity:.22;
          background-image:radial-gradient(rgba(255,225,164,.8) .65px,transparent .8px);
          background-size:38px 38px; mask-image:linear-gradient(to bottom,black,transparent 92%);
        }
        .showdown-shell:after {
          content:""; position:fixed; inset:12px; z-index:-1; pointer-events:none;
          border:1px solid rgba(226,190,112,.08); border-radius:24px;
        }
        .brand-header {
          position:relative; border:0 !important; padding:1.1rem 0 2rem;
          border-bottom:1px solid rgba(226,190,112,.28) !important;
        }
        .brand-header:after {
          content:""; position:absolute; bottom:-1px; left:0; width:180px; height:2px;
          background:linear-gradient(90deg,#f7d991,transparent); box-shadow:0 0 18px rgba(247,217,145,.45);
        }
        .brand-header h1 { font-size:clamp(2.35rem,5vw,4.1rem); line-height:.94; letter-spacing:-.065em; text-shadow:0 8px 36px rgba(242,190,80,.17); }
        .brand-header > div:last-child {
          width:88px;height:88px;border-radius:26px !important;
          background:linear-gradient(145deg,rgba(255,220,143,.2),rgba(180,119,35,.04)) !important;
          border:1px solid rgba(255,220,143,.3); box-shadow:0 0 0 5px rgba(255,220,143,.025),0 18px 60px rgba(212,158,62,.17),inset 0 1px rgba(255,255,255,.18);
        }
        .hero-stage {
          position:relative; isolation:isolate; overflow:hidden; margin:0 0 2rem;
          border:1px solid rgba(232,196,119,.2); border-radius:32px;
          background:radial-gradient(ellipse at 50% 0%,rgba(214,170,91,.17),transparent 52%),linear-gradient(145deg,rgba(27,27,43,.9),rgba(10,13,27,.94));
          box-shadow:0 28px 90px rgba(0,0,0,.3),inset 0 1px rgba(255,255,255,.08);
        }
        .hero-stage:before,.hero-stage:after { content:"✦"; position:absolute; z-index:-1; color:rgba(245,210,143,.2); font-size:clamp(7rem,18vw,15rem); line-height:1; pointer-events:none; }
        .hero-stage:before { left:3%;top:8%; transform:rotate(-12deg); }
        .hero-stage:after { content:"✧"; right:4%;bottom:-12%; transform:rotate(12deg); }
        .hero-kicker { letter-spacing:.42em; text-shadow:0 0 22px rgba(247,208,130,.35); }
        .hero-title { font-size:clamp(2.1rem,5vw,4rem); line-height:1.02; letter-spacing:-.045em; text-shadow:0 8px 36px rgba(0,0,0,.35); }
        .hero-description { color:rgba(220,222,234,.78) !important; }
        .hero-stage span { border-color:rgba(235,201,137,.2) !important; background:rgba(255,255,255,.035) !important; color:#f4dfb5 !important; padding:.65rem 1.1rem !important; }
        .premium-panel {
          min-height:100%; border-radius:30px !important; padding:clamp(1.5rem,3vw,2.5rem) !important;
          backdrop-filter:blur(20px); box-shadow:0 28px 85px rgba(0,0,0,.36),inset 0 1px rgba(255,255,255,.13) !important;
          transition:transform .28s ease,border-color .28s ease,box-shadow .28s ease;
        }
        .premium-panel:hover { transform:translateY(-5px); box-shadow:0 34px 100px rgba(0,0,0,.46),inset 0 1px rgba(255,255,255,.17) !important; }
        .host-panel { background:radial-gradient(circle at 100% 0%,rgba(231,184,93,.2),transparent 35%),linear-gradient(145deg,rgba(64,48,32,.9),rgba(21,22,37,.97) 58%,rgba(11,14,28,.99)) !important; border:1px solid rgba(239,197,105,.48) !important; }
        .player-panel { background:radial-gradient(circle at 100% 0%,rgba(84,139,219,.2),transparent 35%),linear-gradient(145deg,rgba(28,49,79,.9),rgba(19,25,46,.97) 58%,rgba(11,14,28,.99)) !important; border:1px solid rgba(112,164,245,.42) !important; }
        .premium-panel h2 { font-size:clamp(1.9rem,3vw,2.5rem) !important; letter-spacing:-.045em; }
        .premium-panel input { min-height:56px; border-radius:15px !important; background:rgba(4,7,18,.72) !important; border-color:rgba(255,255,255,.13) !important; box-shadow:inset 0 1px 7px rgba(0,0,0,.35); }
        .premium-panel input:focus { outline:2px solid rgba(231,192,105,.3); outline-offset:1px; }
        .premium-panel button,.room-bar button,.lobby-panel button,.question-panel button { transition:transform .18s ease,filter .18s ease,box-shadow .18s ease; }
        .premium-panel button:hover:not(:disabled),.room-bar button:hover:not(:disabled),.lobby-panel button:hover:not(:disabled),.question-panel button:hover:not(:disabled) { transform:translateY(-2px); filter:brightness(1.1); }
        .premium-panel button[class*="bg-gradient-to-r"] { min-height:58px; border-radius:15px !important; letter-spacing:.055em; box-shadow:0 14px 32px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.25); }
        .room-bar,.lobby-panel,.question-panel,.leaderboard-panel {
          border:1px solid rgba(255,255,255,.11) !important; border-radius:26px !important;
          background:linear-gradient(145deg,rgba(28,30,51,.96),rgba(10,13,27,.98)) !important;
          box-shadow:0 24px 65px rgba(0,0,0,.3),inset 0 1px rgba(255,255,255,.08); backdrop-filter:blur(18px);
        }
        .room-bar { border-color:rgba(232,194,112,.34) !important; background:linear-gradient(110deg,rgba(119,83,34,.24),rgba(19,20,39,.97) 58%) !important; padding:1.4rem 1.6rem !important; }
        .lobby-panel,.leaderboard-panel { padding:1.5rem !important; }
        .lobby-panel h2,.leaderboard-panel h2 { letter-spacing:.035em; font-size:1.2rem; }
        .team-tile { min-height:148px; border-radius:20px !important; background-image:linear-gradient(145deg,rgba(255,255,255,.075),rgba(0,0,0,.24)); box-shadow:inset 0 1px rgba(255,255,255,.11),0 12px 30px rgba(0,0,0,.16); }
        .team-tile p.rounded-lg { border:1px solid rgba(255,255,255,.08); background:rgba(0,0,0,.28); }
        .question-panel { padding:clamp(1.5rem,4vw,3.25rem) !important; border-color:rgba(231,192,105,.28) !important; background:radial-gradient(ellipse at 50% 0%,rgba(163,116,44,.17),transparent 44%),linear-gradient(145deg,#191a30,#0b0e20) !important; }
        .question-panel h2 { font-size:clamp(1.6rem,3.5vw,2.8rem); line-height:1.2; letter-spacing:-.035em; }
        .answer-option { min-height:84px; border-radius:18px !important; border-color:rgba(255,255,255,.13) !important; background:linear-gradient(135deg,rgba(255,255,255,.085),rgba(255,255,255,.025)) !important; box-shadow:inset 0 1px rgba(255,255,255,.09),0 10px 25px rgba(0,0,0,.12); }
        .answer-option:hover:not(:disabled) { border-color:rgba(242,198,105,.72) !important; background:rgba(197,151,64,.16) !important; box-shadow:0 12px 30px rgba(197,151,64,.1); }
        .leaderboard-panel { border-color:rgba(231,192,105,.26) !important; }
        .leaderboard-panel .team-tile { min-height:124px; }
        .leaderboard-panel .team-tile p.mt-2 { font-size:2.4rem; letter-spacing:-.05em; }
        .champion-stage { position:relative; overflow:hidden; border:1px solid rgba(242,198,105,.28); border-radius:28px; padding:clamp(2.5rem,7vw,5rem) 1rem; background:radial-gradient(circle at 50% 30%,rgba(239,190,83,.24),transparent 42%),linear-gradient(145deg,rgba(94,65,29,.24),rgba(10,12,26,.3)); box-shadow:inset 0 1px rgba(255,255,255,.1),0 20px 70px rgba(0,0,0,.25); }
        .champion-stage svg { filter:drop-shadow(0 0 30px rgba(255,204,91,.55)); width:5rem;height:5rem; }
        .briefing-stage { padding:clamp(1rem,3vw,2rem); border:1px solid rgba(232,196,119,.22); border-radius:26px; background:radial-gradient(ellipse at 50% 0%,rgba(192,145,59,.16),transparent 48%),linear-gradient(145deg,rgba(21,24,42,.96),rgba(9,12,25,.98)); }
        .briefing-card { padding:1.35rem; border:1px solid rgba(255,255,255,.11); border-radius:18px; background:linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.018)); box-shadow:inset 0 1px rgba(255,255,255,.07),0 12px 28px rgba(0,0,0,.12); }
        .briefing-label { color:#e9c77f; font-size:.65rem; font-weight:900; letter-spacing:.22em; text-transform:uppercase; }
        .briefing-card h3 { margin-top:.55rem; font-size:1.15rem; font-weight:900; letter-spacing:-.025em; }
        .briefing-card ul { margin-top:.8rem; padding-left:1.1rem; color:rgba(224,226,236,.78); font-size:.83rem; line-height:1.8; list-style:disc; }
        .showdown-start-button { background:linear-gradient(110deg,#f7d991,#d7a94d 48%,#f8df9d); box-shadow:0 14px 38px rgba(210,164,75,.2),inset 0 1px rgba(255,255,255,.55); transition:transform .2s ease,filter .2s ease,box-shadow .2s ease; }
        .showdown-start-button:hover:not(:disabled) { transform:translateY(-2px); filter:brightness(1.06); box-shadow:0 18px 45px rgba(210,164,75,.28); }
        .podium-card { min-height:220px; display:flex; flex-direction:column; justify-content:center; padding:1.5rem 1rem; border-radius:24px; border:1px solid rgba(255,255,255,.14); background:linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.025)); box-shadow:inset 0 1px rgba(255,255,255,.12),0 18px 45px rgba(0,0,0,.22); }
        .champion-card { min-height:270px; border-color:rgba(245,203,111,.48); background:radial-gradient(circle at 50% 0%,rgba(245,203,111,.22),transparent 55%),linear-gradient(145deg,rgba(101,73,31,.35),rgba(17,19,34,.9)); }
        .runner-card { border-color:rgba(203,213,225,.24); background:linear-gradient(145deg,rgba(100,116,139,.2),rgba(17,19,34,.92)); }
        .podium-rank { font-size:.65rem; font-weight:900; letter-spacing:.24em; color:rgba(239,226,197,.75); }
        @media(max-width:640px) { .showdown-shell:after { inset:5px; border-radius:14px; } .brand-header { margin-bottom:1.5rem !important; } .hero-stage { border-radius:24px; padding-left:1rem;padding-right:1rem; } .premium-panel { border-radius:23px !important; } }
        @media(prefers-reduced-motion:reduce) { .premium-panel,.premium-panel button,.room-bar button,.lobby-panel button,.question-panel button { transition:none !important; } }
      `}</style>
    </main>
  );
}
